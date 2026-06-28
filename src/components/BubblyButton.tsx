'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface BubblyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'card' | 'outline' | 'blank';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export default function BubblyButton({
  children,
  className = '',
  variant = 'primary',
  onClick,
  disabled,
  ...props
}: BubblyButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Size should cover the diagonal of the button
    const size = Math.max(rect.width, rect.height) * 2;
    
    // Coordinates relative to the button
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const newRipple: Ripple = {
      id: Date.now() + Math.random(),
      x,
      y,
      size,
    };

    setRipples((prev) => [...prev, newRipple]);

    if (onClick) {
      onClick(e);
    }
  };

  const removeRipple = (id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  };

  let baseStyles = 'relative overflow-hidden cursor-pointer select-none outline-none flex items-center justify-center transition-shadow duration-300';
  let variantStyles = '';

  if (variant === 'primary') {
    variantStyles = 'bg-primary disabled:bg-white/10 text-black disabled:text-white/40 rounded-xl font-body text-xs font-semibold tracking-wider uppercase hover:shadow-[0_0_20px_rgba(229,196,135,0.4)]';
  } else if (variant === 'secondary') {
    variantStyles = 'border border-white text-white bg-transparent rounded-full font-body text-xs font-semibold tracking-wider uppercase hover:bg-white/10 backdrop-blur-md';
  } else if (variant === 'outline') {
    variantStyles = 'border border-white/10 hover:border-white/20 bg-white/5 text-white/70 hover:bg-white/8 rounded-full flex items-center justify-center';
  } else if (variant === 'card') {
    variantStyles = 'w-full py-4.5 px-6 rounded-xl border text-left font-body text-sm font-semibold transition-all duration-200';
  }

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.03 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 450, damping: 18 }}
      className={`${baseStyles} ${variantStyles} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      {...(props as any)}
    >
      <span className="relative z-10 flex items-center justify-center gap-2 w-full h-full">
        {children}
      </span>

      {/* Ripple Animation Overlays */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 pointer-events-none animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
          onAnimationEnd={() => removeRipple(ripple.id)}
        />
      ))}
    </motion.button>
  );
}
