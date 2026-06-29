'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import Link from 'next/link';
import './CardNav.css';

export interface CardNavItem {
  label: string;
  description?: string;
  bgColor: string;
  textColor: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

interface CardNavProps {
  items: CardNavItem[];
  className?: string;
  ease?: string;
  /** Content shown in the top-right sign-in area */
  authSlot?: React.ReactNode;
}

const CardNav: React.FC<CardNavProps> = ({
  items,
  className = '',
  ease = 'power3.out',
  authSlot,
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const contentEl = navEl.querySelector('.card-nav-content') as HTMLElement;
    if (contentEl) {
      const wasVisibility = contentEl.style.visibility;
      const wasPointerEvents = contentEl.style.pointerEvents;
      const wasPosition = contentEl.style.position;
      const wasHeight = contentEl.style.height;

      contentEl.style.visibility = 'visible';
      contentEl.style.pointerEvents = 'auto';
      contentEl.style.position = 'static';
      contentEl.style.height = 'auto';

      // Force reflow
      contentEl.offsetHeight;

      const topBar = 56;
      const padding = 16;
      const contentHeight = contentEl.scrollHeight;

      contentEl.style.visibility = wasVisibility;
      contentEl.style.pointerEvents = wasPointerEvents;
      contentEl.style.position = wasPosition;
      contentEl.style.height = wasHeight;

      return topBar + contentHeight + padding;
    }

    return 260;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    const validCards = cardsRef.current.filter(Boolean);

    gsap.set(navEl, { height: 56, overflow: 'hidden' });
    gsap.set(validCards, { y: 30, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.35,
      ease,
    });

    tl.to(
      validCards,
      { y: 0, opacity: 1, duration: 0.35, ease, stagger: 0.06 },
      '-=0.1'
    );

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items?.length]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const handleCardClick = (item: CardNavItem) => {
    // Close menu first, then navigate
    const tl = tlRef.current;
    if (tl && isExpanded) {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => {
        setIsExpanded(false);
        item.onClick?.();
      });
      tl.reverse();
    } else {
      item.onClick?.();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? 'open' : ''}`}
      >
        <div className="card-nav-top">
          {/* Jackie branding — left */}
          <Link href="/" className="card-nav-logo">
            Jackie
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            {/* Auth slot — center-right */}
            {authSlot}

            {/* Hamburger — right */}
            <div
              className={`card-nav-hamburger ${isHamburgerOpen ? 'open' : ''}`}
              onClick={toggleMenu}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleMenu();
                }
              }}
              role="button"
              aria-label={isExpanded ? 'Close menu' : 'Open menu'}
              aria-expanded={isExpanded}
              tabIndex={0}
            >
              <div className="card-nav-hamburger-line" />
              <div className="card-nav-hamburger-line" />
            </div>
          </div>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).map((item, idx) => {
            const cardContent = (
              <>
                <div>
                  <div className="card-nav-card-label">{item.label}</div>
                  {item.description && (
                    <div className="card-nav-card-desc">{item.description}</div>
                  )}
                </div>
                <svg
                  className="card-nav-card-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={`${item.label}-${idx}`}
                  href={item.href}
                  style={{
                    textDecoration: 'none',
                    color: item.textColor,
                  }}
                  onClick={() => {
                    // Close menu on navigate
                    const tl = tlRef.current;
                    if (tl && isExpanded) {
                      setIsHamburgerOpen(false);
                      tl.eventCallback('onReverseComplete', () =>
                        setIsExpanded(false)
                      );
                      tl.reverse();
                    }
                  }}
                >
                  <div
                    className="card-nav-card"
                    ref={setCardRef(idx)}
                    style={{
                      backgroundColor: item.bgColor,
                      color: item.textColor,
                    }}
                  >
                    {cardContent}
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={`${item.label}-${idx}`}
                className="card-nav-card"
                ref={setCardRef(idx)}
                style={{
                  backgroundColor: item.bgColor,
                  color: item.textColor,
                }}
                onClick={() => handleCardClick(item)}
              >
                {cardContent}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;
