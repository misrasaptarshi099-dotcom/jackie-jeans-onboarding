import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { rateLimiter } from '@/lib/rate-limiter';

const requestSchema = z.object({
  transcript: z.string(),
  questionId: z.string(),
  questionType: z.string(),
  options: z.array(z.string()).optional(),
  optional: z.boolean().optional(),
  activeBrand: z.string().optional(), // For Q9 size query context
  answersState: z.any().optional(), // Full current state of answers
  allQuestions: z.array(z.any()).optional(), // All available questions
});

// A local regex parser fallback to make the app fully testable without Gemini keys
function localRegexFallback(
  transcript: string,
  questionId: string,
  questionType: string,
  options?: string[],
  optional?: boolean,
  activeBrand?: string
) {
  const text = transcript.toLowerCase().trim();

  // Base helper to wrap fallback answers into the new schema
  const wrapFallback = (
    fieldId: string,
    value: unknown,
    displayText: string,
    needsClarification: boolean = false,
    clarificationPrompt: string = ''
  ) => {
    return {
      updates: value !== null ? { [fieldId]: value } : {},
      action: needsClarification ? 'REPEAT' : 'NEXT',
      displayText,
      needsClarification,
      clarificationPrompt,
    };
  };

  // Handle skip keyword
  if (optional && (text.includes('skip') || text.includes('pass') || text.includes('next') || text.includes('no'))) {
    return wrapFallback(questionId, 'skip', "No problem, we'll skip that one.");
  }

  // Handle manual fallback back/previous commands
  if (text.includes('go back') || text.includes('previous')) {
    return {
      updates: {},
      action: 'PREVIOUS',
      displayText: 'Sure, going back.',
      needsClarification: false,
      clarificationPrompt: ''
    };
  }

  if (questionId === 'height') {
    // Parse height only when both feet and inches are confidently extracted
    const numbers = text.match(/\b(10|11|12|[0-9])\b/g);
    let feet: number | null = null;
    let inches: number | null = null;

    // Word-based feet detection
    if (text.includes('four') && text.includes('foot')) feet = 4;
    else if (text.includes('five') && text.includes('foot')) feet = 5;
    else if (text.includes('six') && text.includes('foot')) feet = 6;

    if (numbers && numbers.length >= 2) {
      feet = parseInt(numbers[0]);
      inches = parseInt(numbers[1]);
    } else if (feet !== null && numbers && numbers.length === 1) {
      // Feet parsed from words, inches from the single number
      inches = parseInt(numbers[0]);
    }

    if (feet !== null && inches !== null && feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11) {
      const formatted = `${feet}'${inches}"`;
      if (options && options.includes(formatted)) {
        return wrapFallback(questionId, formatted, `Got it, ${feet} foot ${inches}.`);
      }
    }
    return wrapFallback(questionId, null, '', true, 'Sorry, what was your height? For example, five foot six.');
  }

  if (questionId === 'weight') {
    const num = text.match(/\d+/);
    if (num) {
      return wrapFallback(questionId, num[0], `Got it, ${num[0]} pounds.`);
    }
    return wrapFallback(questionId, null, '', true, "Sorry, what was your weight? You can also say 'skip'.");
  }

  if (questionId === 'waist' || questionId === 'hip') {
    const numMatch = text.match(/\b(2[4-9]|3[0-9]|4[0-9]|5[0-2])\b/) || text.match(/\b(3[2-9]|4[0-9]|5[0-9]|60)\b/);
    if (numMatch) {
      const formatted = `${numMatch[0]}"`;
      return wrapFallback(questionId, formatted, `Understood, ${numMatch[0]} inches.`);
    }
    const prompt = questionId === 'waist'
      ? 'Sorry, what is your waist size in inches? For example, twenty eight inches.'
      : 'Sorry, what is your hip size in inches? For example, thirty eight inches.';
    return wrapFallback(questionId, null, '', true, prompt);
  }

  if (['waistFit', 'rise', 'thighFit'].includes(questionId) && options) {
    // 1. Try full phrase match first (e.g. "high rise" vs "mid rise")
    for (const opt of options) {
      if (text.includes(opt.toLowerCase())) {
        return wrapFallback(questionId, opt, `Got it, ${opt}.`);
      }
    }
    // 2. Fall back to discriminating word tokens, excluding generic words
    const genericWords = new Set(['rise', 'fit', 'cut', 'the', 'a', 'an', 'is', 'my', 'i']);
    for (const opt of options) {
      const words = opt.toLowerCase().split(' ');
      if (words.filter(w => !genericWords.has(w)).some(word => text.includes(word))) {
        return wrapFallback(questionId, opt, `Got it, ${opt}.`);
      }
    }
    return wrapFallback(questionId, null, '', true, 'Sorry, could you choose from the options? E.g., snug, relaxed.');
  }

  if (questionId === 'brands' && options) {
    const matched: string[] = [];
    options.forEach(brand => {
      const cleanBrand = brand.toLowerCase().replace(/['&]/g, ' ');
      const cleanText = text.replace(/['&]/g, ' ');
      if (cleanText.includes(cleanBrand.split(' ')[0])) {
        matched.push(brand);
      }
    });

    if (matched.length > 0) {
      return wrapFallback(questionId, matched, `Recorded ${matched.join(' and ')}.`);
    }
    return wrapFallback(questionId, null, '', true, 'Sorry, which denim brands have you bought before?');
  }

  if (questionId === 'brandSizes' && options) {
    const num = text.match(/\b(2[3-9]|3[0-4])\b/);
    if (num) {
      return wrapFallback(questionId, num[0], `Size ${num[0]} in ${activeBrand || 'denim'}.`);
    }
    return wrapFallback(questionId, null, '', true, `Sorry, what size did you wear in ${activeBrand || 'that brand'}?`);
  }

  if (questionId === 'frustrations' && options) {
    const matched: string[] = [];
    options.forEach(frust => {
      const words = frust.toLowerCase().split(' ');
      if (words.some(w => text.includes(w))) {
        matched.push(frust);
      }
    });
    if (matched.length > 0) {
      return wrapFallback(questionId, matched, `Understood, struggling with ${matched.join(', ')}.`);
    }
    return wrapFallback(questionId, null, '', true, 'Sorry, what is your biggest fit frustration when buying denim?');
  }

  return wrapFallback(questionId, null, '', true, "Sorry, could you repeat that? I didn't quite catch your answer.");
}

export async function POST(req: NextRequest) {
  // Rate Limit: 100 requests per minute for easier development testing
  const limitRes = rateLimiter(req, 100, 60 * 1000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((limitRes.reset - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  // 1. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input payload' }, { status: 400 });
  }

  const { transcript, questionId, questionType, options, optional, activeBrand, answersState } = parsed.data;

  // 2. Retrieve Gemini API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not defined. Falling back to local regex matching.');
    const fallbackResult = localRegexFallback(transcript, questionId, questionType, options, optional, activeBrand);
    return NextResponse.json(fallbackResult);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Construct strict system instructions and prompt
    const systemInstruction = `
You are a highly intelligent state manager for a conversational voice AI (Jackie Jeans).
Your job is to read the user's transcript and figure out what fields of their sizing profile need to be updated, and how to navigate the quiz flow.

CURRENT QUIZ STATE:
- Current Question ID: "${questionId}"
- Expected Type: "${questionType}"
- Optional: ${optional ? 'true' : 'false'}
- Valid Options for current question: ${options ? JSON.stringify(options) : 'None (number/text expected)'}
- Active Brand (if applicable): "${activeBrand || ''}"
- Current Profile State: ${answersState ? JSON.stringify(answersState) : '{}'}

CRITICAL RULES:
1. Identify ANY information in the transcript that answers ANY question in the quiz, even if it's not the current question! (e.g. if they say "I don't know my waist, but my height is 5 foot 8", update the height).
2. The user can navigate:
   - "go back", "previous question", "I made a mistake" -> action: "PREVIOUS"
   - "what did you say?", "repeat" -> action: "REPEAT"
   - Normally answering the current question (or skipping it) -> action: "NEXT"
   - Answering ONLY a previous question but NOT the current one -> action: "STAY"
3. If they say "skip" and the current question is optional, update the current question's field to "skip" and action "NEXT".
4. If they ask to go back, action MUST be "PREVIOUS" even if they don't provide an update.

You MUST return a JSON object with this EXACT schema:
{
  "updates": {
    "key": "value" // Map of field ID (e.g. 'height', 'waist') to the new validated value. Only include fields that changed.
  },
  "action": "NEXT" | "PREVIOUS" | "REPEAT" | "STAY",
  "displayText": "A friendly confirmation phrase for the voice stylist to say back. Keep it conversational. E.g. 'Got it, updated your height to five foot eight.', or 'Sure, going back.'",
  "needsClarification": true if user answer is ambiguous, irrelevant, or invalid (and not a repeat request), false otherwise,
  "clarificationPrompt": "A polite spoken question to clarify if needsClarification is true."
}
`;

    const userPrompt = `
User spoken transcript: "${transcript}"
Analyze the transcript and return the JSON response. Do not include any markdown styling, only valid JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1, // low temperature for deterministic parsing
      },
    });

    const responseText = response.text || '';
    
    try {
      const parsedJson = JSON.parse(responseText);
      const geminiResponseSchema = z.object({
        updates: z.record(z.string(), z.any()).optional().default({}),
        action: z.enum(['NEXT', 'PREVIOUS', 'REPEAT', 'STAY']),
        displayText: z.string(),
        needsClarification: z.boolean().optional().default(false),
        clarificationPrompt: z.string().optional().default(''),
      });
      const validated = geminiResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        console.error('Gemini output failed validation. Falling back to local regex matching.');
        const fallbackResult = localRegexFallback(transcript, questionId, questionType, options, optional, activeBrand);
        return NextResponse.json(fallbackResult);
      }
      return NextResponse.json(validated.data);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON output. Raw text:', responseText, parseError);
      const fallbackResult = localRegexFallback(transcript, questionId, questionType, options, optional, activeBrand);
      return NextResponse.json(fallbackResult);
    }
  } catch (err: unknown) {
    console.error('Error processing answer with Gemini, falling back to regex:', err);
    const fallbackResult = localRegexFallback(transcript, questionId, questionType, options, optional, activeBrand);
    return NextResponse.json(fallbackResult);
  }
}
