import { NextRequest, NextResponse } from 'next/server';
import { DeepgramClient } from '@deepgram/sdk';
import { rateLimiter } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  // Rate Limit: 10 requests per minute
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
    console.warn('DEEPGRAM_API_KEY is not defined. Returning mock token for offline testing.');
    // Return a dummy token so the voice flow UI loads for offline / local-only tests
    return NextResponse.json({ token: 'mock_token_for_local_testing' });
  }

  try {
    const deepgram = new DeepgramClient({ apiKey });

    // Fetch projects to retrieve the active project ID automatically
    const projectsResult = await deepgram.manage.v1.projects.list();
    if (!projectsResult || !projectsResult.projects || projectsResult.projects.length === 0) {
      console.error('Deepgram getProjects error: No projects returned');
      return NextResponse.json(
        { error: 'Failed to retrieve Deepgram projects.' },
        { status: 500 }
      );
    }

    const projectId = projectsResult.projects[0].project_id;
    if (!projectId) {
      console.error('Deepgram getProjects error: Project ID is undefined');
      return NextResponse.json(
        { error: 'Failed to retrieve Deepgram project ID.' },
        { status: 500 }
      );
    }

    // Create a temporary key valid for 60 seconds with write-only permissions
    const tempKey = await deepgram.manage.v1.projects.keys.create(
      projectId,
      {
        comment: 'Temporary client-side connection token',
        scopes: ['usage:write'],
        time_to_live_in_seconds: 60,
      }
    );

    if (!tempKey || !tempKey.key) {
      console.error('Deepgram createKey error: Key is undefined in response');
      return NextResponse.json(
        { error: 'Failed to generate temporary Deepgram token.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ token: tempKey.key });
  } catch (err: unknown) {
    console.error('Error generating Deepgram token:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
