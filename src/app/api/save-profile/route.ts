import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, auth } from '@/lib/firebase-admin';
import { rateLimiter } from '@/lib/rate-limiter';

// Strict input validation schema to prevent script injection and malformed inputs
const profileSchema = z.object({
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
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile data payload' }, { status: 400 });
    }

    const fitData = parsed.data;

    // Check for authorization header (optional user authentication link)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ') && auth) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await auth.verifyIdToken(token);
        userId = decodedToken.uid;
        console.log(`Verified save-profile ID Token for user: ${userId}`);
      } catch (tokenErr) {
        console.error('Failed to verify user ID token:', tokenErr);
        return NextResponse.json({ error: 'Unauthorized or invalid session token' }, { status: 401 });
      }
    }

    // Check if Firestore connection is initialized
    if (!db) {
      console.warn(
        'Firestore is not initialized. Saving fit profile locally (mock/dry run success).'
      );
      return NextResponse.json({
        success: true,
        local: true,
        userId,
        message: 'Saved locally in dry-run mode (Firestore variables not configured).',
      });
    }

    // Firestore rejects undefined values, so we sanitize the object first
    const sanitizedData = JSON.parse(JSON.stringify(fitData));

    // Handle FIFO 3-Quiz Limit for Authenticated Users
    const targetUserId = userId || 'guest';
    const quizzesCollection = db.collection('fit_profiles').doc(targetUserId).collection('quizzes');

    if (userId) {
      const snapshot = await quizzesCollection.get();

      if (snapshot.size >= 3) {
        // Sort in memory to avoid composite index requirements
        const docs = [...snapshot.docs].sort((a, b) => {
          const timeA = a.data().createdAt?.toDate()?.getTime() || 0;
          const timeB = b.data().createdAt?.toDate()?.getTime() || 0;
          return timeA - timeB; // Ascending (oldest first)
        });

        // We need to delete the oldest (snapshot.size - 2) quizzes to make room for the 3rd
        const deleteCount = snapshot.size - 2;
        const batch = db.batch();
        for (let i = 0; i < deleteCount; i++) {
          batch.delete(docs[i].ref);
        }
        await batch.commit();
        console.log(`Deleted ${deleteCount} old quizzes for user ${userId} to maintain 3-quiz FIFO limit.`);
      }
    }
    
    // Save to Firestore nested quizzes collection
    const docRef = await quizzesCollection.add({
      ...sanitizedData,
      createdAt: new Date(),
    });

    console.log(`Saved fit profile successfully in Firestore. DocID: ${docRef.id}`);

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (err: any) {
    console.error('Error saving fit profile in API route:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
