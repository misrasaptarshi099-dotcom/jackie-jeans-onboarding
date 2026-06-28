import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db, auth } from '@/lib/firebase-admin';

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or code format' }, { status: 400 });
    }

    const { email, otp } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Mock Fallback if Firebase Service Account credentials are not configured
    if (!db || !auth) {
      console.warn('Firebase Admin SDK is not initialized. Using mock verify credentials.');
      if (otp === '123456' || otp === '000000') { // Let 123456 or 000000 work locally
        return NextResponse.json({
          success: true,
          customToken: 'mock_custom_token',
          uid: 'mock_uid_123456',
          message: 'Authenticated in development mock mode.',
        });
      }
      // Simple match for console OTP testing: if local database has it or we bypass it
      return NextResponse.json({ error: 'Incorrect code. In mock dev mode, use 123456.' }, { status: 400 });
    }

    // 1. Retrieve stored OTP document
    const docRef = db.collection('verification_otps').doc(normalizedEmail);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'No verification code requested for this email' }, { status: 400 });
    }

    const data = doc.data();
    if (!data) {
      return NextResponse.json({ error: 'Could not read verification data' }, { status: 400 });
    }

    // 2. Check expiration
    if (Date.now() > data.expiresAt) {
      await docRef.delete();
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // 3. Verify OTP code
    const hashed = hashOtp(otp.trim());
    if (hashed !== data.codeHash) {
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
    }

    // 4. Delete the code to prevent reuse
    await docRef.delete();

    // 5. Get or Create user in Firebase Auth
    let uid: string = '';
    try {
      const existingUser = await auth.getUserByEmail(normalizedEmail);
      uid = existingUser.uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/user-not-found') {
        // Create new user account passwordless
        const newUser = await auth.createUser({
          email: normalizedEmail,
          displayName: normalizedEmail.split('@')[0],
        });
        uid = newUser.uid;
        console.log(`Created new Firebase user with email ${normalizedEmail}. UID: ${uid}`);
      } else {
        throw authErr;
      }
    }

    // 6. Generate Firebase Custom Token
    const customToken = await auth.createCustomToken(uid);

    return NextResponse.json({
      success: true,
      customToken,
      uid,
    });
  } catch (err: any) {
    console.error('Error verifying OTP code:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
