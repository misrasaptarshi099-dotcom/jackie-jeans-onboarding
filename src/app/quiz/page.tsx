'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion';
import { questions, Question } from '@/lib/questions';
import BubblyButton from '@/components/BubblyButton';
import { auth } from '@/lib/firebase-client';

interface Answers {
  height: string;
  weight: string;
  waist: string;
  hip: string;
  waistFit: string;
  rise: string;
  thighFit: string;
  brands: string[];
  brandSizes: Record<string, string>;
  frustrations: string[];
}

export interface JackieProfile {
  summary: string;
  fitProfile: {
    primaryIssue: string;
    recommendedRise: string;
    recommendedCut: string;
    avoidCuts: string[];
    sizingNote: string;
    inseamNote: string;
  };
  jackieSays: string;
}

export default function ManualQuiz({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  // Quiz state
  const [currentIdx, setCurrentIdx] = useState(0); // 0 to 9 corresponding to questions
  const [currentBrandIdx, setCurrentBrandIdx] = useState(0); // For Q9 dynamic brand sizes loop
  const [answers, setAnswers] = useState<Answers>({
    height: '5\'6"',
    weight: '',
    waist: '28"',
    hip: '38"',
    waistFit: '',
    rise: '',
    thighFit: '',
    brands: [],
    brandSizes: {},
    frustrations: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1); // 1 = forward, -1 = backward
  const [jackieProfile, setJackieProfile] = useState<JackieProfile | null>(null);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);

  const currentQuestion = questions[currentIdx];

  // Total steps for progress bar
  const totalLogicalSteps = 10;
  const progressPercent = ((currentIdx + 1) / totalLogicalSteps) * 100;

  // Handlers for going forward / backward
  const handleNext = () => {
    setDirection(1);

    // Q8 -> Q9 transition
    if (currentQuestion.id === 'brands') {
      if (answers.brands.length > 0) {
        setCurrentIdx(8); // Go to Brand Sizes
        setCurrentBrandIdx(0);
      } else {
        // Skip Brand Sizes if no brands selected
        setCurrentIdx(9); // Go to Frustrations
      }
      return;
    }

    // Q9 (Brand Sizes) loop
    if (currentQuestion.id === 'brandSizes') {
      if (currentBrandIdx < answers.brands.length - 1) {
        setCurrentBrandIdx(currentBrandIdx + 1);
      } else {
        setCurrentIdx(9); // Go to Frustrations
      }
      return;
    }

    // Last Question (Q10) -> Submit
    if (currentQuestion.id === 'frustrations') {
      handleSubmit();
      return;
    }

    // Standard progression
    setCurrentIdx(currentIdx + 1);
  };

  const handleBack = () => {
    setDirection(-1);

    // Q10 -> Q9 transition
    if (currentQuestion.id === 'frustrations') {
      if (answers.brands.length > 0) {
        setCurrentIdx(8);
        setCurrentBrandIdx(answers.brands.length - 1);
      } else {
        setCurrentIdx(7); // Go back to Q8 (Brands)
      }
      return;
    }

    // Q9 (Brand Sizes) loop
    if (currentQuestion.id === 'brandSizes') {
      if (currentBrandIdx > 0) {
        setCurrentBrandIdx(currentBrandIdx - 1);
      } else {
        setCurrentIdx(7); // Go back to Q8 (Brands)
      }
      return;
    }

    // Exit Quiz / Go to Landing Page
    if (currentIdx === 0) {
      if (onClose) {
        onClose();
      } else {
        router.push('/');
      }
      return;
    }

    // Standard regression
    setCurrentIdx(currentIdx - 1);
  };

  // Submit answers to server side, then complete
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Fetch user ID Token if logged in
      const currentUser = auth.currentUser;
      let token: string | null = null;
      if (currentUser) {
        try {
          token = await currentUser.getIdToken();
        } catch (tokenErr) {
          console.error('Failed to retrieve user ID token:', tokenErr);
        }
      }

      const saveHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        saveHeaders['Authorization'] = `Bearer ${token}`;
      }

      // Save profile and generate fit profile in parallel
      const [saveRes, profileRes] = await Promise.all([
        fetch('/api/save-profile', {
          method: 'POST',
          headers: saveHeaders,
          body: JSON.stringify(answers),
        }).catch(err => {
          console.error('Failed to save profile to Firestore:', err);
          return null;
        }),
        fetch('/api/generate-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        }).catch(err => {
          console.error('Failed to generate profile with Gemini:', err);
          return null;
        })
      ]);

      if (saveRes && saveRes.ok) {
        const saveData = await saveRes.json();
        if (saveData.success && saveData.id) {
          setSavedProfileId(saveData.id);
        }
      } else if (saveRes && !saveRes.ok) {
        console.warn('DB Save Warning: API response not ok.');
      }

      if (profileRes && profileRes.ok) {
        const profileData = await profileRes.json();
        setJackieProfile(profileData);
        try {
          localStorage.setItem('jackieProfile', JSON.stringify(profileData));
        } catch (e) {
          console.error('Failed to write to localStorage:', e);
        }
      }
    } catch (err) {
      console.error('Unhandled error during submission:', err);
    } finally {
      setIsSubmitting(false);
      setIsCompleted(true);
    }
  };

  // Redirect to final vercel app with secure opaque profileId
  const handleRedirect = () => {
    const params = new URLSearchParams();
    if (savedProfileId) {
      params.set('profileId', savedProfileId);
    }
    const currentUser = auth.currentUser;
    if (currentUser) {
      params.set('userId', currentUser.uid);
    }

    // Use window.location.href for external redirects as Next.js router.push expects internal paths
    window.location.href = `https://jackie-jeans.vercel.app/?${params.toString()}`;
  };

  // Slide Animation Configurations
  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: shouldReduceMotion ? 0 : dir * 150,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.25, ease: 'easeInOut' },
    },
    exit: (dir: number) => ({
      x: shouldReduceMotion ? 0 : -dir * 150,
      opacity: 0,
      transition: { duration: 0.25, ease: 'easeInOut' },
    }),
  };

  // State modifiers
  const selectSingleOption = (id: string, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: option,
    }));
    // Auto-advance for cards (fit, rise, thigh) since they are single tap selection
    if (['waistFit', 'rise', 'thighFit'].includes(id)) {
      // Small timeout for user visual feedback before moving on
      setTimeout(() => {
        setDirection(1);
        setCurrentIdx((prevIdx) => prevIdx + 1);
      }, 200);
    }
  };

  const toggleMultiSelect = (id: 'brands' | 'frustrations', option: string) => {
    setAnswers((prev) => {
      const currentList = prev[id] || [];
      const updatedList = currentList.includes(option)
        ? currentList.filter((item) => item !== option)
        : [...currentList, option];

      // Clean up brandSizes if a brand is deselected
      const updatedSizes = { ...prev.brandSizes };
      if (id === 'brands' && currentList.includes(option)) {
        delete updatedSizes[option];
      }

      return {
        ...prev,
        [id]: updatedList,
        brandSizes: updatedSizes,
      };
    });
  };

  const setBrandSize = (brand: string, size: string) => {
    setAnswers((prev) => ({
      ...prev,
      brandSizes: {
        ...prev.brandSizes,
        [brand]: size,
      },
    }));
  };

  // Rendering input elements per type
  const renderInput = () => {
    switch (currentQuestion.type) {
      case 'dropdown': {
        const selectValue = answers[currentQuestion.id as keyof Answers] as string;
        return (
          <div className="w-full relative my-8">
            <select
              value={selectValue}
              onChange={(e) => selectSingleOption(currentQuestion.id, e.target.value)}
              className="w-full bg-neutral-900 border-b border-primary/40 focus:border-primary text-2xl py-4 text-center font-display text-pure-white outline-none transition-colors appearance-none cursor-pointer"
            >
              {currentQuestion.options?.map((opt) => (
                <option key={opt} value={opt} className="bg-neutral-900 text-lg">
                  {opt}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
              ↓
            </div>
          </div>
        );
      }

      case 'number':
        return (
          <div className="w-full flex flex-col items-center gap-6 my-6">
            <input
              type="number"
              placeholder="lbs"
              value={answers.weight}
              onChange={(e) => setAnswers({ ...answers, weight: e.target.value })}
              className="w-full max-w-[160px] bg-neutral-900 border-b border-primary/40 focus:border-primary text-3xl py-3 text-center text-pure-white outline-none transition-colors"
            />
            <button
              onClick={() => {
                setAnswers((prev) => ({ ...prev, weight: '' }));
                handleNext();
              }}
              className="text-white/40 hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider mt-2"
            >
              Skip &rarr;
            </button>
          </div>
        );

      case 'card': {
        const cardValue = answers[currentQuestion.id as keyof Answers] as string;
        return (
          <div className="w-full flex flex-col gap-3 my-6">
            {currentQuestion.options?.map((opt) => {
              const active = cardValue === opt;
              return (
                <BubblyButton
                  key={opt}
                  variant="card"
                  onClick={() => selectSingleOption(currentQuestion.id, opt)}
                  className={
                    active
                      ? 'border-primary bg-primary/10 text-pure-white shadow-[0_0_12px_rgba(229,196,135,0.2)]'
                      : 'border-white/12 bg-white/5 text-white/70 hover:bg-white/8 hover:text-pure-white'
                  }
                >
                  {opt}
                </BubblyButton>
              );
            })}
          </div>
        );
      }

      case 'multi-select':
        if (currentQuestion.id === 'brands') {
          return (
            <div className="w-full my-6">
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {currentQuestion.options?.map((brand) => {
                  const active = answers.brands.includes(brand);
                  return (
                    <BubblyButton
                      key={brand}
                      variant="blank"
                      onClick={() => toggleMultiSelect('brands', brand)}
                      className={`py-3 px-4 rounded-lg border text-center font-body text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-between ${
                        active
                          ? 'border-primary bg-primary/10 text-pure-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/8'
                      }`}
                    >
                      <span className="truncate">{brand}</span>
                      {active && <span className="text-primary text-[10px]">✓</span>}
                    </BubblyButton>
                  );
                })}
              </div>
            </div>
          );
        }

        // Q10 frustrations
        return (
          <div className="w-full flex flex-col gap-2.5 my-6">
            {currentQuestion.options?.map((frustration) => {
              const active = answers.frustrations.includes(frustration);
              return (
                <BubblyButton
                  key={frustration}
                  variant="blank"
                  onClick={() => toggleMultiSelect('frustrations', frustration)}
                  className={`w-full py-4 px-6 rounded-xl border text-left font-body text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-between ${
                    active
                      ? 'border-primary bg-primary/10 text-pure-white'
                      : 'border-white/12 bg-white/5 text-white/70 hover:bg-white/8'
                  }`}
                >
                  <span>{frustration}</span>
                  {active && <span className="text-primary">✓</span>}
                </BubblyButton>
              );
            })}
          </div>
        );

      case 'dynamic-size': {
        // Q9: loop through selected brands
        const currentBrand = answers.brands[currentBrandIdx];
        if (!currentBrand) return null;
        
        const sizeSelected = answers.brandSizes[currentBrand] || '';
        return (
          <div className="w-full my-6">
            <h4 className="font-body text-xs text-primary uppercase tracking-widest font-semibold mb-4 text-center">
              What size did you wear in {currentBrand}?
            </h4>
            <div className="grid grid-cols-4 gap-2.5">
              {currentQuestion.options?.map((size) => {
                const active = sizeSelected === size;
                return (
                  <BubblyButton
                    key={size}
                    variant="blank"
                    onClick={() => setBrandSize(currentBrand, size)}
                    className={`py-3 rounded-lg border text-center font-body text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      active
                        ? 'border-primary bg-primary/15 text-pure-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8'
                    }`}
                  >
                    {size}
                  </BubblyButton>
                );
              })}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Action Button Rendering (Next/Skip)
  const renderActionButtons = () => {
    // Single tap selectors auto advance, so we don't display action buttons
    if (['waistFit', 'rise', 'thighFit'].includes(currentQuestion.id)) {
      return null;
    }

    // Dynamic brand size screen requires select validation
    if (currentQuestion.id === 'brandSizes') {
      const activeBrand = answers.brands[currentBrandIdx];
      const hasSelectedSize = answers.brandSizes[activeBrand];
      return (
        <BubblyButton
          variant="primary"
          onClick={handleNext}
          disabled={!hasSelectedSize}
          className="w-full h-12"
        >
          Next &rarr;
        </BubblyButton>
      );
    }

    // Standard buttons
    const isNextDisabled =
      (currentQuestion.id === 'frustrations' && answers.frustrations.length === 0);

    const buttonLabel = currentQuestion.id === 'frustrations' ? 'Finish' : 'Next';

    return (
      <BubblyButton
        variant="primary"
        onClick={handleNext}
        disabled={isNextDisabled}
        className="w-full h-12"
      >
        {buttonLabel} &rarr;
      </BubblyButton>
    );
  };

  // Completion screen rendering
  if (isCompleted) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center p-8 bg-background text-on-surface">
        <div className="w-full max-w-[420px] bg-neutral-900 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
          
          {/* Drawing checkmark SVG */}
          <div className="w-20 h-20 mb-6 flex items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <svg
              className="w-10 h-10 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="font-display text-2xl font-bold text-pure-white mb-2">
            Your fit profile is ready.
          </h2>
          <p className="font-body text-xs text-white/50 mb-6 leading-relaxed">
            We've calibrated our recommendations to match your unique measurements and fit preferences.
          </p>

          {jackieProfile?.jackieSays && (
            <div className="w-full bg-white/5 border border-white/5 rounded-xl p-4 mb-6 text-left relative overflow-hidden">
              <span className="absolute top-1 left-2 text-3xl font-serif text-primary/20 leading-none">“</span>
              <p className="font-body text-xs text-white/80 italic leading-relaxed pl-5 pr-2">
                {jackieProfile.jackieSays}
              </p>
            </div>
          )}

          {/* Fit summary */}
          <div className="w-full border-t border-white/10 py-5 flex flex-col gap-3.5 mb-8 text-left font-body text-xs">
            <div className="flex justify-between">
              <span className="text-white/40">Height & Inseam</span>
              <span className="text-pure-white font-semibold">{answers.height}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Waist Size</span>
              <span className="text-pure-white font-semibold">{answers.waist}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Hip Width</span>
              <span className="text-pure-white font-semibold">{answers.hip}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Thigh Preference</span>
              <span className="text-pure-white font-semibold">{answers.thighFit} Fit</span>
            </div>
          </div>

          <BubblyButton
            variant="primary"
            onClick={handleRedirect}
            className="w-full h-12 rounded-xl font-body text-xs font-semibold tracking-wider uppercase hover:bg-pure-white"
          >
            See Your Recommendations &rarr;
          </BubblyButton>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-background text-on-surface flex flex-col items-center justify-between p-6">
      
      {/* Top Progress Bar & Exit Button */}
      <div className="w-full max-w-[460px] flex flex-col gap-4 mt-2">
        <div className="flex justify-between items-center w-full">
          <BubblyButton
            variant="outline"
            onClick={handleBack}
            className="w-10 h-10 text-white/80"
            aria-label="Back"
          >
            &larr;
          </BubblyButton>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to exit? Your current progress will be lost.')) {
                if (onClose) {
                  onClose();
                } else {
                  router.push('/');
                }
              }
            }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors uppercase tracking-wider font-semibold cursor-pointer"
          >
            Exit
          </button>
        </div>

        {/* Thin Gold Progress Bar */}
        <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question Card Container */}
      <main className="w-full flex-1 flex items-center justify-center max-h-[500px]">
        <div className="w-full max-w-[420px] bg-neutral-900 border border-white/8 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={currentQuestion.id === 'brandSizes' ? `brandSize-${currentBrandIdx}` : currentQuestion.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full flex flex-col"
            >
              {/* Question Index Label */}
              <span className="font-body text-[10px] text-primary tracking-[0.25em] uppercase font-semibold mb-2">
                Question {currentIdx + 1} of {totalLogicalSteps}
              </span>

              {/* Main Headline */}
              <h2 className="font-display text-xl md:text-2xl text-pure-white font-bold leading-snug">
                {currentQuestion.text}
              </h2>

              {/* Render Type Picker */}
              {renderInput()}

              {/* Action Button */}
              {renderActionButtons()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="font-body text-xs text-white/70 mt-4 tracking-wider uppercase font-semibold">
            Calibrating Your Fit...
          </span>
        </div>
      )}

      {/* Placeholder Footer for visual symmetry */}
      <div className="h-6" />
    </div>
  );
}
