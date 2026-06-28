'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';
import BubblyButton from '@/components/BubblyButton';
import SplitText from '@/components/SplitText';
import LogoLoop from '@/components/LogoLoop';

import ManualQuiz from './quiz/page';
import VoiceQuiz from './voice/page';
import { auth } from '@/lib/firebase-client';
import { onAuthStateChanged, signOut } from 'firebase/auth';

interface Testimonial {
  quote: string;
  author: string;
  details: string;
  image: string;
}

const testimonials: Testimonial[] = [
  {
    quote: "Finally. No more waist gap in my denim shorts. They hug my curves just right.",
    author: "Priya M.",
    details: "size 28 waist / 38 hip (Denim Jorts)",
    image: "/images/jorts.png"
  },
  {
    quote: "Finding loose-fit and baggy jeans that actually fit my waist and don't bunch up was impossible until now.",
    author: "Sarah K.",
    details: "size 32 waist / 44 hip (Baggy Jeans)",
    image: "/images/baggy.png"
  },
  {
    quote: "From cropped flares to raw-edge jorts, every style fits like it was custom tailored.",
    author: "Elena R.",
    details: "size 26 waist / 34 hip (Flared Crops)",
    image: "/images/cropped.png"
  }
];

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const [statValue, setStatValue] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [activeOverlay, setActiveOverlay] = useState<'none' | 'quiz' | 'voice'>('none');
  const [statTriggered, setStatTriggered] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const statRef = useRef<HTMLDivElement>(null);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { scrollYProgress: heroScroll, scrollY } = useScroll();
  const heroY = useTransform(heroScroll, [0, 0.5], [0, 150]);
  const heroOpacity = useTransform(heroScroll, [0, 0.3], [1, 0]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 150) {
      setNavHidden(true);
    } else {
      setNavHidden(false);
    }
  });

  useEffect(() => {
    if (activeOverlay !== 'none') {
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
    }
    return () => { document.documentElement.style.overflow = ''; };
  }, [activeOverlay]);

  useEffect(() => {
    if (!statRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !statTriggered) {
          setStatTriggered(true);
          let start = 0;
          const end = 68;
          const stepTime = Math.floor(800 / end);
          const timer = setInterval(() => {
            start += 1;
            setStatValue(start);
            if (start >= end) clearInterval(timer);
          }, stepTime);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(statRef.current);
    return () => observer.disconnect();
  }, [statTriggered]);

  const startAutoplay = () => {
    if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    autoplayTimerRef.current = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
  };

  const stopAutoplay = () => {
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  };

  useEffect(() => {
    startAutoplay();
    return stopAutoplay;
  }, []);

  const handleTestimonialClick = (index: number) => {
    stopAutoplay();
    setActiveTestimonial(index);
    startAutoplay();
  };

  const dividerLogos = [
    { node: <span className="text-white/80 font-display italic text-2xl mx-6">your fit, perfected</span> },
    { node: <span className="text-primary font-body text-xl mx-2">⨯</span> },
    { node: <span className="text-white/80 font-display italic text-2xl mx-6">worn forever</span> },
    { node: <span className="text-primary font-body text-xl mx-2">⨯</span> },
    { node: <span className="text-white/80 font-display italic text-2xl mx-6">98% confidence</span> },
    { node: <span className="text-primary font-body text-xl mx-2">⨯</span> },
    { node: <span className="text-white/80 font-display italic text-2xl mx-6">no more guessing</span> },
    { node: <span className="text-primary font-body text-xl mx-2">⨯</span> },
  ];

  return (
    <div className="bg-background min-h-screen">
      
      {/* HEADER: Simple frosted glass navbar — no GlassSurface SVG filter */}
      <motion.header
        variants={{ visible: { y: 0, opacity: 1 }, hidden: { y: '-100%', opacity: 0 } }}
        animate={navHidden ? 'hidden' : 'visible'}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="fixed top-0 left-0 w-full z-50 px-4 md:px-8 py-3"
      >
        <div className="max-w-7xl mx-auto bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-full px-8 py-3 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <Link href="/" className="font-display text-xl text-primary font-bold tracking-[0.15em] uppercase">
            Jackie
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[11px] font-body text-white/60 tracking-widest font-semibold uppercase">
            <button onClick={() => setActiveOverlay('quiz')} className="hover:text-primary transition-colors duration-300 cursor-pointer">Fit Quiz</button>
            <button onClick={() => setActiveOverlay('voice')} className="hover:text-primary transition-colors duration-300 cursor-pointer">Voice AI</button>
            {user ? (
        <div className="flex items-center gap-8">
          <Link href="/profile" className="hover:text-primary transition-colors duration-300 cursor-pointer">My Profile</Link>
          <button onClick={handleSignOut} className="hover:text-primary transition-colors duration-300 cursor-pointer">Sign Out</button>
        </div>
      ) : (<Link href="/signin" className="hover:text-primary transition-colors duration-300 cursor-pointer">Sign In</Link>
            )}
          </nav>
        </div>
      </motion.header>

      {/* HERO */}
      <section className="section w-full relative flex flex-col justify-end p-8 md:p-16 min-h-screen">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 z-0">
          <video
            className="w-full h-full object-cover scale-105"
            src="/hero.mp4"
            autoPlay loop muted playsInline
            onError={(e) => {
              (e.target as HTMLVideoElement).style.display = 'none';
              const parent = (e.target as HTMLElement).parentElement;
              if (parent) {
                parent.style.backgroundImage = `url('/images/cropped.png')`;
                parent.style.backgroundSize = 'cover';
                parent.style.backgroundPosition = 'center';
              }
            }}
          />
        </motion.div>
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#131313] via-black/40 to-transparent" />

        <div className="relative z-20 w-full max-w-5xl pb-32 pt-20 flex flex-col items-start text-left">

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
            className="font-body text-[52px] md:text-[72px] lg:text-[88px] text-pure-white font-bold leading-[1.05] tracking-tighter mb-8"
          >
            Denim that actually fits.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
            className="font-body text-lg md:text-2xl text-white/80 mb-12"
          >
            10 questions. Your perfect jeans, jorts, or loose fits.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="flex flex-col sm:flex-row w-full sm:w-auto gap-5 justify-start items-center"
          >
            {user ? (
              <BubblyButton
                variant="primary"
                onClick={() => setActiveOverlay('quiz')}
                className="!w-64 !h-14 !rounded-full !border-0 text-xs tracking-widest font-bold"
              >
                TAKE THE QUIZ
              </BubblyButton>
            ) : (
              <Link href="/signin">
                <BubblyButton
                  variant="primary"
                  className="!w-64 !h-14 !rounded-full !border-0 text-xs tracking-widest font-bold"
                >
                  TAKE THE QUIZ
                </BubblyButton>
              </Link>
            )}
            <BubblyButton
              variant="secondary"
              onClick={() => setActiveOverlay('voice')}
              className="!w-64 !h-14 !rounded-full !border-white/20 !bg-white/5 hover:!bg-white/10 !backdrop-blur-sm text-xs tracking-widest font-bold"
            >
              <svg className="w-4 h-4 fill-current mr-2" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              TRY VOICE MODE
            </BubblyButton>
          </motion.div>
        </div>
      </section>

      {/* MARQUEE DIVIDER */}
      <div className="w-full py-5 bg-[#0a0a0a] border-y border-white/5 relative z-30 overflow-hidden">
        {/* @ts-ignore - LogoLoop is .jsx */}
        <LogoLoop logos={dividerLogos} speed={80} direction="left" pauseOnHover={true} />
      </div>

      {/* PROBLEM */}
      <section ref={statRef} className="section w-full relative flex flex-col justify-center px-8 md:px-16 bg-[#131313]">
        <motion.div 
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 1 }}
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 mix-blend-luminosity" 
          style={{ backgroundImage: `url('/images/problem.png')` }} 
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#131313] via-black/60 to-[#131313]" />

        <div className="relative z-20 w-full max-w-xl flex flex-col items-start text-left">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-body text-[11px] text-primary tracking-[0.25em] uppercase font-semibold mb-3 text-left"
          >
            THE PROBLEM
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="font-body text-[40px] md:text-[56px] text-pure-white font-bold leading-[1.1] tracking-tight mb-6 text-left"
          >
            The waist fits. The hips don't.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="font-body text-sm md:text-base text-white/60 leading-relaxed mb-10 max-w-md"
          >
            Most denim bottomwear is designed for a single body shape. Yours isn't that shape. Our fit algorithm accounts for the nuances of your curves, rise preference, and style cut.
          </motion.p>
          <div className="flex flex-col items-start">
            <motion.span
              className="font-display text-[72px] md:text-[96px] text-primary font-bold leading-none tracking-tighter"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              {statValue}%
            </motion.span>
            <motion.span 
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="font-body text-[10px] text-white/50 uppercase tracking-[0.2em] mt-2 block"
            >
              of women return jeans due to fit
            </motion.span>
          </div>
        </div>
      </section>

      {/* REAL FITS */}
      <section className="section w-full relative flex flex-col justify-center items-center px-4 md:px-12 py-24 bg-[#131313]">
        
        <div className="w-full max-w-6xl mb-12">
          <SplitText
            text="Reviews"
            tag="h2"
            splitType="words"
            className="font-display text-[44px] md:text-[56px] text-pure-white font-bold leading-tight"
          />
        </div>

        {/* The Card */}
        <div 
          className="relative w-full max-w-6xl rounded-[32px] overflow-hidden bg-[#1a1a1a] shadow-2xl flex flex-col md:flex-row group"
          onMouseEnter={stopAutoplay}
          onMouseLeave={startAutoplay}
        >
          {/* Card Content (Left) */}
          <div className="relative z-20 w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-[#1a1a1a]">
            <motion.h3 
              key={`quote-${activeTestimonial}`}
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              className="font-display text-3xl md:text-4xl lg:text-5xl text-pure-white font-semibold leading-[1.2] mb-8"
            >
              {testimonials[activeTestimonial].quote}
            </motion.h3>
            <motion.div 
              key={`author-${activeTestimonial}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            >
              <span className="font-body text-base text-primary font-bold block mb-1">
                — {testimonials[activeTestimonial].author}
              </span>
              <span className="font-body text-sm text-white/50">
                {testimonials[activeTestimonial].details}
              </span>
            </motion.div>
            
            {/* Controls */}
            <div className="mt-12 flex items-center gap-3">
              {testimonials.map((_, idx) => (
                <div
                  key={idx}
                  onClick={() => handleTestimonialClick(idx)}
                  className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                    activeTestimonial === idx ? 'bg-primary w-8' : 'bg-white/20 hover:bg-white/40 w-2'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Card Image (Right) */}
          <div className="relative w-full md:w-1/2 aspect-square md:aspect-auto overflow-hidden bg-black flex items-center justify-center">
             <AnimatePresence mode="wait">
               <motion.img
                 key={activeTestimonial}
                 src={testimonials[activeTestimonial].image}
                 alt="Review"
                 initial={{ opacity: 0, filter: 'blur(10px)' }}
                 animate={{ opacity: 1, filter: 'blur(0px)' }}
                 exit={{ opacity: 0, transition: { duration: 0.4 } }}
                 transition={{ duration: 0.6, ease: "easeOut" }}
                 className="absolute inset-0 w-full h-full object-contain md:object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
               />
             </AnimatePresence>
          </div>
        </div>
      </section>

      {/* YOUR CHOICE */}
      <section className="section w-full relative flex flex-col justify-center px-6 md:px-12 py-24 bg-[#0f0f0f]">
        <div className="absolute inset-0 z-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{ backgroundImage: `url('/images/paths.png')` }} />
        
        <div className="relative z-20 w-full max-w-4xl mx-auto flex flex-col items-center">
          <SplitText
            text="YOUR CHOICE"
            delay={20}
            className="font-body text-[11px] text-primary tracking-[0.25em] uppercase font-semibold mb-3"
          />
          <SplitText 
            text="Two ways to find your fit." 
            tag="h2"
            splitType="words" 
            delay={30} 
            className="font-display text-[32px] md:text-[48px] text-pure-white font-bold text-center mb-16"
          />

          <div className="flex flex-col md:flex-row w-full gap-6">
            {/* Manual Quiz Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
              onClick={() => setActiveOverlay('quiz')}
              className="w-full md:w-1/2 bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] hover:border-primary/40 rounded-3xl p-8 md:p-10 flex flex-col items-center text-center cursor-pointer transition-all duration-500 hover:bg-white/[0.06] hover:-translate-y-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-black/40 border border-primary/30 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-black transition-all duration-300">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl font-semibold text-pure-white mb-3">Manual Quiz</h3>
              <p className="font-body text-sm text-white/50 mb-8 leading-relaxed">
                Tap through 10 quick questions about your metrics and styling preferences.
              </p>
              <span className="text-primary font-body text-xs tracking-widest uppercase font-semibold group-hover:translate-x-2 transition-transform flex items-center gap-2 mt-auto">
                Start <span>&rarr;</span>
              </span>
            </motion.div>

            {/* Voice Mode Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} viewport={{ once: true }}
              onClick={() => setActiveOverlay('voice')}
              className="w-full md:w-1/2 bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] hover:border-primary/40 rounded-3xl p-8 md:p-10 flex flex-col items-center text-center cursor-pointer transition-all duration-500 hover:bg-white/[0.06] hover:-translate-y-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-black/40 border border-primary/30 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-black transition-all duration-300">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl font-semibold text-pure-white mb-3">Voice Mode</h3>
              <p className="font-body text-sm text-white/50 mb-8 leading-relaxed">
                Speak naturally. Jackie listens. Chat directly with your digital fit stylist.
              </p>
              <span className="text-primary font-body text-xs tracking-widest uppercase font-semibold group-hover:translate-x-2 transition-transform flex items-center gap-2 mt-auto">
                Talk <span>&rarr;</span>
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="w-full relative flex flex-col justify-center px-8 md:px-16 text-center min-h-screen bg-black overflow-hidden">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0.5 }} whileInView={{ scale: 1, opacity: 0.8 }} transition={{ duration: 1.5 }}
          className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url('/images/cta.png')` }} 
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0f0f0f] via-black/80 to-transparent" />

        <div className="relative z-20 w-full max-w-xl mx-auto flex flex-col items-center">
          <SplitText
            text="Your perfect denim is waiting."
            tag="h2"
            splitType="words"
            delay={20}
            className="font-body text-[48px] md:text-[64px] text-primary font-bold leading-[1.05] tracking-tight mb-4"
          />
          <motion.p 
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="font-body text-base text-white/50 mb-12"
          >
            Takes less than 3 minutes.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            {user ? (
              <BubblyButton onClick={() => setActiveOverlay('quiz')} variant="primary" className="!w-64 !h-14 group text-xs font-bold tracking-widest">
                <span className="flex items-center justify-center gap-2">
                  FIND MY FIT
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </BubblyButton>
            ) : (
              <Link href="/signin">
                <BubblyButton variant="primary" className="!w-64 !h-14 group text-xs font-bold tracking-widest">
                  <span className="flex items-center justify-center gap-2">
                    FIND MY FIT
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                </BubblyButton>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Quiz / Voice overlays */}
      <AnimatePresence>
        {activeOverlay === 'quiz' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-background"
          >
            <ManualQuiz onClose={() => setActiveOverlay('none')} />
          </motion.div>
        )}
        {activeOverlay === 'voice' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-background"
          >
            <VoiceQuiz onClose={() => setActiveOverlay('none')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
