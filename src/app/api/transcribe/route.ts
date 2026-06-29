import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rate-limiter';

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

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY is missing' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // Guard: Reject oversized audio before buffering
    if (audioFile.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ error: 'Audio file too large. Max size is 10MB.' }, { status: 400 });
    }

    // Convert Blob to ArrayBuffer for fetch
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Call Deepgram REST API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s deadline

    try {
      const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': audioFile.type || 'audio/webm',
        },
        body: buffer,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Deepgram API Error:', errorText);
        return NextResponse.json({ error: 'Deepgram transcription failed' }, { status: response.status });
      }

      const data = await response.json();
      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

      return NextResponse.json({ transcript });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: unknown) {
    console.error('Error in transcribe route:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
