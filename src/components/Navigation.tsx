'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase-client';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function Navigation() {
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  return (
    <header className="w-full px-4 md:px-8 py-6">
      <div className="max-w-7xl mx-auto bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-full px-8 py-4 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <Link href="/" className="font-display text-xl text-primary font-bold tracking-[0.15em] uppercase">
          Jackie
        </Link>
        
        <nav className="flex items-center gap-6 md:gap-8 text-[11px] font-body text-white/60 tracking-widest font-semibold uppercase">
          <Link href="/" className="hover:text-primary transition-colors duration-300">
            Home
          </Link>
          {user ? (
            <>
              <Link 
                href="/profile" 
                className="text-primary hover:text-white transition-colors duration-300"
              >
                My Profile
              </Link>
              <button 
                onClick={handleSignOut}
                className="hover:text-red-400 transition-colors duration-300 cursor-pointer uppercase"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link 
              href="/signin" 
              className="hover:text-primary transition-colors duration-300"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
