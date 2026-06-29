'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import BubblyButton from '@/components/BubblyButton';
import SplitText from '@/components/SplitText';
import { auth, googleProvider } from '@/lib/firebase-client';
import { signInWithPopup, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const isSigningInRef = useRef(false);

  // Redirect if already authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !isSigningInRef.current) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setIsOtpSent(true);
      if (data.fallback) {
        setSuccessMsg('Dev Mode: 6-digit code has been logged to your server terminal console.');
      } else {
        setSuccessMsg('Verification code sent! Please check your email inbox.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      isSigningInRef.current = true;
      // Log in on client using Custom Token
      await signInWithCustomToken(auth, data.customToken);
      
      // Initialize an empty profile for the user if it's their first time
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        const initRes = await fetch('/api/init-profile', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!initRes.ok) {
          await auth.signOut();
          throw new Error('Failed to initialize profile document. Please try again.');
        }
      }

      router.push('/');
    } catch (err: any) {
      isSigningInRef.current = false;
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      isSigningInRef.current = true;
      await signInWithPopup(auth, googleProvider);
      
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        const initRes = await fetch('/api/init-profile', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!initRes.ok) {
          await auth.signOut();
          throw new Error('Failed to initialize profile document. Please try again.');
        }
      }

      router.push('/');
    } catch (err: any) {
      isSigningInRef.current = false;
      console.error('Google Sign-In failed:', err);
      // Suppress showing standard cancellation error
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err.message || 'Google login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Background Video/Image */}
      <div className="absolute inset-0 z-0">
        <video
          className="w-full h-full object-cover opacity-30"
          src="/hero.mp4"
          autoPlay loop muted playsInline
          onError={(e) => {
            (e.target as HTMLVideoElement).style.display = 'none';
            const parent = (e.target as HTMLElement).parentElement;
            if (parent) {
              parent.style.backgroundImage = `url('/images/cta.png')`;
              parent.style.backgroundSize = 'cover';
              parent.style.backgroundPosition = 'center';
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-[#131313]/90" />
      </div>

      {/* Glass card container */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-[32px] p-10 shadow-[0_8px_64px_rgba(0,0,0,0.5)]"
      >
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="mb-8 block font-display text-3xl text-primary font-bold tracking-[0.15em] uppercase hover:text-white transition-colors duration-300">
            Jackie
          </Link>
          
          <SplitText 
            text="Welcome Back" 
            tag="h1"
            className="font-display text-2xl md:text-3xl text-pure-white font-semibold mb-2" 
            delay={50}
          />
          <p className="font-body text-xs text-white/50 mb-6">Access your fit profile and saved items.</p>

          {/* Feedback Messages */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs font-body mb-4 text-left"
              >
                {errorMsg}
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full bg-primary/10 border border-primary/20 text-primary rounded-xl p-3 text-xs font-body mb-4 text-left"
              >
                {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email OTP Login flow */}
          {!isOtpSent ? (
            <form className="w-full flex flex-col gap-3 mb-6" onSubmit={handleSendOtp}>
              <input 
                type="email" 
                placeholder="Email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-body text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
              />
              <BubblyButton 
                type="submit"
                variant="primary" 
                disabled={isLoading}
                className="!w-full !h-12 !rounded-xl !mt-2 !border-0 font-body text-xs font-semibold tracking-wider uppercase"
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </BubblyButton>
            </form>
          ) : (
            <form className="w-full flex flex-col gap-3 mb-6" onSubmit={handleVerifyOtp}>
              <div className="w-full text-left mb-1">
                <span className="text-[10px] text-white/40 font-body uppercase tracking-wider">Verifying: {email}</span>
              </div>
              <input 
                type="text" 
                maxLength={6}
                placeholder="Enter 6-digit code" 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                disabled={isLoading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm font-body text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 text-center tracking-[0.5em] font-mono"
              />
              <BubblyButton 
                type="submit"
                variant="primary" 
                disabled={isLoading}
                className="!w-full !h-12 !rounded-xl !mt-2 !border-0 font-body text-xs font-semibold tracking-wider uppercase"
              >
                {isLoading ? 'Verifying...' : 'Verify & Sign In'}
              </BubblyButton>
              <button
                type="button"
                onClick={() => setIsOtpSent(false)}
                className="text-[10px] text-primary/70 hover:text-primary transition-colors font-body mt-2 uppercase tracking-widest cursor-pointer"
              >
                ← Edit email address
              </button>
            </form>
          )}

          {/* Social login divider */}
          <div className="w-full flex items-center justify-center gap-3 mb-6">
            <div className="h-[1px] bg-white/10 flex-1" />
            <span className="text-[10px] font-body text-white/30 uppercase tracking-widest">or</span>
            <div className="h-[1px] bg-white/10 flex-1" />
          </div>

          {/* Google Sign In Button */}
          <BubblyButton
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="!w-full !h-12 !rounded-xl border border-white/10 flex items-center justify-center gap-3 font-body text-xs font-semibold text-pure-white"
          >
            {/* Google Icon SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-7.989 0-4.412 3.535-7.99 7.866-7.99 2.46 0 4.105 1.025 5.047 1.926l3.245-3.123C18.465 2.158 15.635 1 12.24 1 5.926 1 1 5.925 1 12s4.926 11 11.24 11c6.59 0 11.01-4.633 11.01-11.2 0-.756-.08-1.332-.178-1.815H12.24z"
              />
            </svg>
            Continue with Google
          </BubblyButton>
          
          <div className="text-[9px] text-white/20 tracking-[0.2em] uppercase font-body mt-10">
            Secured by Jackie Auth
          </div>
        </div>
      </motion.div>
    </div>
  );
}
