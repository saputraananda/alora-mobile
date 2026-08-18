import React from 'react';
import ScrollToTop from './ScrollToTop.jsx';

/**
 * Mobile-First Container Component
 * Standard Section 1.2 & 2.1 ReferensiDesign.md
 */
export default function MobileContainer({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans select-none overflow-x-hidden">
      <div
        id="mobile-scroll-container"
        className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative overflow-x-hidden overflow-y-auto"
      >
        <ScrollToTop />
        {children}
      </div>
    </div>
  );
}
