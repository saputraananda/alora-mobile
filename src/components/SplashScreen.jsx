import React, { useEffect, useState } from 'react';
import aloraMobileWhiteLogo from '../assets/images/aloramobile-white.png';

/**
 * Ultra-Minimal Elegant Splash Screen Component
 * Focused on logo & soft rounded typography snugly fit under logo graphic
 */
export default function SplashScreen({ onFinish }) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // 2.0s: Start smooth shrink & fade-out animation
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2000);

    // 2.8s: Notify parent to unmount splash screen
    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`fixed inset-0 z-50 bg-[#050B14] flex items-center justify-center overflow-hidden transition-all duration-700 ease-in-out ${
      isFadingOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'
    }`}>
      {/* Background Layer 1: Deep Navy Radial Gradient Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />

      {/* Background Layer 2: Subtle Luxury Grain / Noise Overlay ("Gremek-gremek" texture effect) */}
      <div 
        className="absolute inset-0 opacity-[0.07] pointer-events-none z-10 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Background Layer 3: Central Soft Ambient Glow Behind Logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-blue-600/25 via-indigo-500/20 to-sky-400/25 rounded-full blur-[110px] pointer-events-none animate-pulse" style={{ animationDuration: '3s' }} />

      {/* Main Center Content: Logo + Soft Rounded Typography (Tight Negative Spacing) */}
      <div className={`relative z-20 flex flex-col items-center justify-center p-6 text-center transition-all duration-700 transform ${
        isFadingOut ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
      }`}>
        {/* Freestanding Logo Image */}
        <img 
          src={aloraMobileWhiteLogo} 
          alt="Alora Mobile Logo" 
          className="w-44 sm:w-52 h-auto object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-float-slow"
        />

        {/* Soft Rounded Typography with tight negative top margin to eliminate image whitespace */}
        <h1 
          className="text-xl sm:text-2xl font-bold tracking-wider text-white drop-shadow-md select-none -mt-5 sm:-mt-6"
          style={{ fontFamily: "'Outfit', 'Quicksand', 'Plus Jakarta Sans', sans-serif" }}
        >
          Alora Mobile
        </h1>
      </div>
    </div>
  );
}
