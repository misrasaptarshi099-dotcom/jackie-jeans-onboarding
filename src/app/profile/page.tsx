'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { auth } from '@/lib/firebase-client';
import { onAuthStateChanged } from 'firebase/auth';
import Navigation from '@/components/Navigation';
import BubblyButton from '@/components/BubblyButton';

interface Profile {
  id: string;
  createdAt: string;
  height: string;
  weight?: string;
  waist: string;
  hip: string;
  waistFit?: string;
  rise?: string;
  thighFit?: string;
  brands: string[];
  brandSizes: Record<string, string>;
  frustrations: string[];
}

export default function ProfilePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        return;
      }
      
      try {
        const token = await u.getIdToken();
        const res = await fetch('/api/get-profiles', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch profiles');
        }
        
        const data = await res.json();
        setProfiles(data.profiles || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error loading profiles');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background font-body text-white relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none z-0" />
      
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        
        {/* Dashboard Title Header */}
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between text-center md:text-left gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-3 text-pure-white">
              My Denim Profiles
            </h1>
            <p className="text-white/50 max-w-2xl text-base md:text-lg">
              A historical log of your personalized voice styling sessions and custom measurements.
            </p>
          </div>
          {profiles.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 self-center md:self-end shadow-[0_4px_20px_rgba(200,169,110,0.05)]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>History: {profiles.length} / 3 Quizzes</span>
            </div>
          )}
        </div>

        {/* Dynamic States */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary/25 border-t-primary"></div>
            <p className="text-sm text-white/40 tracking-widest uppercase">Fetching Profile Data...</p>
          </div>
        ) : !user ? (
          <div className="text-center py-20 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-[32px] p-10 max-w-lg mx-auto shadow-2xl">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold mb-3 text-pure-white">Account Access Locked</h2>
            <p className="text-white/50 text-sm mb-8">Please log in to view and manage your custom denim fit profiles.</p>
            <a href="/signin" className="inline-block">
              <BubblyButton variant="primary" className="px-8! py-3! font-semibold text-xs tracking-wider uppercase">
                Sign In
              </BubblyButton>
            </a>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl max-w-2xl mx-auto text-center font-semibold text-sm">
            {error}
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-24 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-[32px] p-10 max-w-lg mx-auto shadow-2xl">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold mb-3 text-pure-white">No Profiles Initialized</h2>
            <p className="text-white/50 text-sm mb-8">We haven't received your sizing profile details yet. Let's chat and find your fit.</p>
            <a href="/voice" className="inline-block">
              <BubblyButton variant="primary" className="px-8! py-3! font-semibold text-xs tracking-wider uppercase">
                Start Voice Quiz
              </BubblyButton>
            </a>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile, i) => (
              <motion.div 
                key={profile.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-[32px] p-8 hover:border-primary/30 transition-all duration-300 relative overflow-hidden group shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:shadow-[0_16px_48px_rgba(200,169,110,0.1)]"
              >
                {/* Decorative background geometry */}
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-300 pointer-events-none">
                  <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L20 6V18L12 22L4 18V6L12 2ZM12 4.2L6 7.2V16.8L12 19.8L18 16.8V7.2L12 4.2Z" />
                  </svg>
                </div>
                
                {/* Top header within card */}
                <div className="text-xs text-white/40 font-semibold mb-6 flex items-center justify-between">
                  <span className="tracking-widest uppercase">
                    {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {i === 0 ? (
                    <span className="bg-primary/20 text-primary border border-primary/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-[0_2px_10px_rgba(200,169,110,0.2)]">
                      LATEST
                    </span>
                  ) : (
                    <span className="border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                      PREVIOUS
                    </span>
                  )}
                </div>

                {/* Sizing measurements block */}
                <div className="space-y-6 relative z-10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-colors">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Waist</p>
                      <p className="font-display font-semibold text-2xl text-pure-white">{profile.waist}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-colors">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Hip</p>
                      <p className="font-display font-semibold text-2xl text-pure-white">{profile.hip}</p>
                    </div>
                  </div>

                  {/* Secondary stats */}
                  <div className="flex gap-8 items-center bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                    <div>
                      <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-0.5">Height</p>
                      <p className="font-semibold text-sm text-pure-white">{profile.height}</p>
                    </div>
                    {profile.weight && (
                      <div className="border-l border-white/10 pl-8">
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-0.5">Weight</p>
                        <p className="font-semibold text-sm text-pure-white">{profile.weight} lbs</p>
                      </div>
                    )}
                  </div>

                  {/* Previous fits block */}
                  {Object.keys(profile.brandSizes || {}).length > 0 && (
                    <div className="pt-4 border-t border-white/5">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-3">Recorded Fit Sizes</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(profile.brandSizes).map(([brand, size]) => (
                          <span 
                            key={brand} 
                            className="text-[11px] font-medium bg-white/5 text-white/80 px-3.5 py-1.5 rounded-full border border-white/10 hover:border-primary/40 hover:text-primary transition-all duration-300"
                          >
                            {brand}: <span className="font-bold text-pure-white">{size}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frustrations/Pain points */}
                  {profile.frustrations && profile.frustrations.length > 0 && (
                    <div className="pt-4 border-t border-white/5">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2">Pain Points</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.frustrations.map((frust) => (
                          <span 
                            key={frust}
                            className="text-[10px] bg-red-500/5 text-red-300 border border-red-500/10 px-2.5 py-1 rounded-lg"
                          >
                            {frust}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
