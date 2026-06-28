import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebase-admin';
import { rateLimiter } from '@/lib/rate-limiter';

const sendOtpSchema = z.object({
  email: z.string().email(),
});

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 OTPs per hour per IP
  const limitRes = rateLimiter(req, 5, 60 * 60 * 1000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: 'Too many OTP requests. Please try again in an hour.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if Firestore connection is initialized
    if (!db) {
      return NextResponse.json({ error: 'Database is not initialized.' }, { status: 500 });
    }

    // Generate 6-digit code
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    // Save hashed code in Firestore
    await db.collection('verification_otps').doc(normalizedEmail).set({
      codeHash: hashOtp(code),
      expiresAt,
      createdAt: new Date(),
    });

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    // Console fallback if Nodemailer details are not configured yet
    if (!emailUser || !emailPass) {
      console.warn('EMAIL_USER or EMAIL_PASS not configured in .env.local.');
      console.log(`\n============================================\n[DEVELOPMENT FALLBACK] OTP Code for ${normalizedEmail}: ${code}\n============================================\n`);
      return NextResponse.json({
        success: true,
        fallback: true,
        message: 'OTP logged to server console (development mode).',
      });
    }

    // Send email using Gmail Nodemailer transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    await transporter.sendMail({
      from: `"Jackie Jeans" <${emailUser}>`,
      to: normalizedEmail,
      subject: 'Your Jackie Jeans Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0a0a0a; color: #ffffff; border-radius: 16px; border: 1px solid #C8A96E;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.15em; color: #C8A96E;">JACKIE</span>
          </div>
          <h2 style="color: #ffffff; text-align: center; margin-bottom: 8px;">Your Stylist Login Code</h2>
          <p style="color: #a0a0a0; text-align: center; margin-bottom: 24px; font-size: 14px;">Use this code to verify your email and save your custom fit profile. It will expire in <strong>10 minutes</strong>.</p>
          <div style="background: rgba(200, 169, 110, 0.1); border-radius: 12px; padding: 24px; text-align: center; border: 2px solid #C8A96E; margin-bottom: 24px;">
            <span style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #C8A96E; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #606060; text-align: center; font-size: 11px;">If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in send-otp API route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
