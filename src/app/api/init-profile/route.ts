import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || !auth || !db) {
      return NextResponse.json({ error: 'Unauthorized or Firestore missing' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Create or update parent document with user metadata
    const userDocRef = db.collection('fit_profiles').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      await userDocRef.set({
        email: decodedToken.email || null,
        createdAt: new Date(),
      });
      console.log(`Initialized user profile document for ${userId}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error initializing profile:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
