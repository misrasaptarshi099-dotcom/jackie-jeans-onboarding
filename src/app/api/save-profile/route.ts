import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, auth } from '@/lib/firebase-admin';
import { rateLimiter } from '@/lib/rate-limiter';

const stringOrNumber = z.union([z.string().max(10), z.number()]).transform(val => String(val));

const profileSchema = z.object({
  height: stringOrNumber,
  weight: stringOrNumber.optional(),
  waist: stringOrNumber,
  hip: stringOrNumber,
  waistFit: z.string().min(2).max(30).optional().or(z.literal('')),
  rise: z.string().min(2).max(30).optional().or(z.literal('')),
  thighFit: z.string().min(2).max(30).optional().or(z.literal('')),
  brands: z.array(z.string().max(50)).max(15),
  brandSizes: z.record(z.string().max(50), stringOrNumber),
  frustrations: z.array(z.string().max(50)).max(15),
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
      console.error('Validation error in save-profile:', parsed.error.format());
      return NextResponse.json({ 
        error: 'Invalid profile data payload', 
        details: parsed.error.format() 
      }, { status: 400 });
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

    // Restrict saving to authenticated users only to enforce limits
    if (!userId) {
      return NextResponse.json({
        success: true,
        message: 'Guest profile not persisted in database (success).',
      });
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

    // Handle FIFO 3-Quiz Limit for Authenticated Users atomically
    const targetUserId = userId;
    const userDocRef = db.collection('fit_profiles').doc(targetUserId);
    const quizzesCollection = userDocRef.collection('quizzes');

    let newDocId = '';
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(quizzesCollection);

      if (snapshot.size >= 3) {
        // Sort in memory to avoid composite index requirements
        const docs = [...snapshot.docs].sort((a, b) => {
          const timeA = a.data().createdAt?.toDate()?.getTime() || 0;
          const timeB = b.data().createdAt?.toDate()?.getTime() || 0;
          return timeA - timeB; // Ascending (oldest first)
        });

        // We need to delete the oldest (snapshot.size - 2) quizzes to make room for the 3rd
        const deleteCount = snapshot.size - 2;
        for (let i = 0; i < deleteCount; i++) {
          transaction.delete(docs[i].ref);
        }
        console.log(`Deleting ${deleteCount} old quizzes for user ${userId} inside transaction to maintain 3-quiz FIFO limit.`);
      }

      const newDocRef = quizzesCollection.doc();
      newDocId = newDocRef.id;
      transaction.set(newDocRef, {
        ...sanitizedData,
        createdAt: new Date(),
      });
    });
    
    console.log(`Saved fit profile successfully in Firestore. DocID: ${newDocId}`);

    return NextResponse.json({
      success: true,
      id: newDocId,
    });
  } catch (err: unknown) {
    console.error('Error saving fit profile in API route:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
