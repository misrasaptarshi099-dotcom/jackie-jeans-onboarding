import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';

// Answers schema validation matching the front-end interface structure
const answersSchema = z.object({
  height: z.string().min(3).max(10),
  weight: z.string().max(10).optional(),
  waist: z.string().min(2).max(10),
  hip: z.string().min(2).max(10),
  waistFit: z.string().min(2).max(30).optional().or(z.literal('')),
  rise: z.string().min(2).max(30).optional().or(z.literal('')),
  thighFit: z.string().min(2).max(30).optional().or(z.literal('')),
  brands: z.array(z.string().max(50)),
  brandSizes: z.record(z.string(), z.string().max(10)),
  frustrations: z.array(z.string().max(50)),
});

const generateProfileSchema = z.object({
  answers: answersSchema,
});

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

  try {
    const body = await req.json();
    const parsed = generateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile data payload structure' }, { status: 400 });
    }

    const { answers } = parsed.data;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined. Returning mock fit profile.');
      return NextResponse.json({
        summary: `Based on your height of ${answers.height || "5'6\""} and waist size of ${answers.waist || '28"'}, you have a classic fit. We recommend mid-rise cuts to avoid any gaping at the waistband.`,
        fitProfile: {
          primaryIssue: answers.frustrations?.[0] || 'Waist gap',
          recommendedRise: answers.rise || 'Mid Rise',
          recommendedCut: 'Straight Cut',
          avoidCuts: ['Super Skinny'],
          sizingNote: 'Fits true to size. If between sizes, size down.',
          inseamNote: '30 inches',
        },
        jackieSays: `Hey there! Since you measure ${answers.height || "5'6\""} with a ${answers.waist || '28"'} waist, I'd suggest our mid-rise straight cut to keep things comfortable without any gap at the back.`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are Jackie, a denim fit expert. A customer just completed their fit quiz.
Given their answers, generate a fit profile.

Customer answers: ${JSON.stringify(answers)}

Be specific to their actual numbers. Never generic. Reference their measurements directly.

Return ONLY valid JSON, no markdown, no preamble:
{
  "summary": "2-3 sentence personalized fit analysis referencing their actual measurements",
  "fitProfile": {
    "primaryIssue": "",
    "recommendedRise": "",
    "recommendedCut": "",
    "avoidCuts": [],
    "sizingNote": "",
    "inseamNote": ""
  },
  "jackieSays": "1-2 sentences Jackie speaks out loud - warm, confident, specific to their numbers"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '';
    const clean = responseText.replace(/```json|```/g, '').trim();
    return NextResponse.json(JSON.parse(clean));
  } catch (err: any) {
    console.error('Error in generate-profile API route:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
