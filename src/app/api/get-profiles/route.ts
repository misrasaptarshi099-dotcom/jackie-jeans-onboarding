import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase-admin';
import { rateLimiter } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  // Rate Limit: 100 requests per minute
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || !auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let userId: string;
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (tokenErr) {
      console.error('Failed to verify user ID token:', tokenErr);
      return NextResponse.json({ error: 'Unauthorized or invalid session token' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
    }

    // Fetch all quizzes from user subcollection
    const snapshot = await db.collection('fit_profiles')
      .doc(userId)
      .collection('quizzes')
      .get();

    const profiles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()?.toISOString() || null
    })).sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ success: true, profiles });
  } catch (err: any) {
    console.error('Error fetching profiles:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
