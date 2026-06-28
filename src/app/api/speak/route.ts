import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rate-limiter';

const speakSchema = z.object({
  text: z.string().min(1).max(500),
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

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    console.warn('ELEVENLABS_API_KEY is not defined. Returning fallback header indicator.');
    // Let client know to use a local fallback if ElevenLabs is offline / not set up
    return new Response(JSON.stringify({ fallback: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Voice-Fallback': 'true' },
    });
  }

  try {
    const body = await req.json();
    const parsed = speakSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid text payload' }, { status: 400 });
    }

    const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Sarah (Premade, free-tier eligible female voice)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: parsed.data.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error response:', errorText);
      console.warn('Falling back to local client text synthesis simulation.');
      return new Response(JSON.stringify({ fallback: true, error: 'ElevenLabs API Error' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Voice-Fallback': 'true' },
      });
    }

    // Stream the raw audio data back to the client
    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('Error proxying ElevenLabs TTS:', err);
    return new Response(JSON.stringify({ fallback: true, error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Voice-Fallback': 'true' },
    });
  }
}
