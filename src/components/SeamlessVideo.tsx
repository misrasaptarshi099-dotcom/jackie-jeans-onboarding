'use client';

import React, { useRef, useEffect } from 'react';

interface SeamlessVideoProps {
  src: string;
  className?: string;
  fadeDuration?: number; // duration of the crossfade in seconds
  fallbackImage?: string; // fallback image url if video fails
}

export default function SeamlessVideo({ src, className = '', fadeDuration = 1.0, fallbackImage = '' }: SeamlessVideoProps) {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const activeVideoRef = useRef(1);

  useEffect(() => {
    const v1 = video1Ref.current;
    const v2 = video2Ref.current;
    if (!v1 || !v2) return;

    let rafId: number;
    
    // Initial start
    v1.play().catch(() => {});
    v1.style.opacity = '1';
    v2.style.opacity = '0';

    const checkTime = () => {
      const active = activeVideoRef.current === 1 ? v1 : v2;
      const inactive = activeVideoRef.current === 1 ? v2 : v1;
      
      if (active.duration) {
        const timeLeft = active.duration - active.currentTime;
        
        // If we are within the fade window before the video ends
        if (timeLeft <= fadeDuration) {
          if (inactive.paused) {
            inactive.currentTime = 0;
            inactive.play().catch(() => {});
          }
          
          const fadeProgress = 1 - (timeLeft / fadeDuration);
          
          active.style.opacity = (1 - fadeProgress).toString();
          inactive.style.opacity = fadeProgress.toString();
        } else {
           // Ensure correct states if we just swapped or are mid-playback
           if (!inactive.paused && inactive.currentTime > 0) {
              inactive.pause();
              inactive.currentTime = 0;
           }
           active.style.opacity = '1';
           inactive.style.opacity = '0';
        }
      }
      
      rafId = requestAnimationFrame(checkTime);
    };
    
    rafId = requestAnimationFrame(checkTime);
    return () => cancelAnimationFrame(rafId);
  }, [fadeDuration]);

  const handleEnded = () => {
    activeVideoRef.current = activeVideoRef.current === 1 ? 2 : 1;
  };

  return (
    <div className={`relative ${className}`}>
      <video
        ref={video1Ref}
        src={src}
        className="absolute inset-0 w-full h-full object-cover scale-105"
        muted
        playsInline
        onEnded={handleEnded}
        onError={(e) => {
          if (fallbackImage) {
            (e.target as HTMLVideoElement).style.display = 'none';
            if (video2Ref.current) video2Ref.current.style.display = 'none';
            const parent = (e.target as HTMLElement).parentElement;
            if (parent) {
              parent.style.backgroundImage = `url('${fallbackImage}')`;
              parent.style.backgroundSize = 'cover';
              parent.style.backgroundPosition = 'center';
            }
          }
        }}
      />
      <video
        ref={video2Ref}
        src={src}
        className="absolute inset-0 w-full h-full object-cover scale-105"
        muted
        playsInline
        onEnded={handleEnded}
      />
    </div>
  );
}
