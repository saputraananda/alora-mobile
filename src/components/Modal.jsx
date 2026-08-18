import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Mobile-Scoped Clean Popup Modal Component
 */
export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  icon,
  hideActionButton = false,
  actionButtonText = 'Mengerti'
}) {
  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[26px] p-5 max-w-[340px] w-full shadow-2xl relative border border-slate-100 flex flex-col cursor-default"
      >
        {/* Top Header Row with Close (X) Button */}
        <div className="w-full flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon && <div className="p-1.5 rounded-xl bg-slate-100 text-navy-950">{icon}</div>}
            {title && <h3 className="text-[15px] font-black text-navy-950 tracking-tight">{title}</h3>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center transition flex-shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Content Body */}
        <div className="w-full text-slate-600 text-xs leading-relaxed my-2">
          {children}
        </div>

        {/* Single Clean Action Button (Only rendered if hideActionButton is false) */}
        {!hideActionButton && (
          <div className="w-full mt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-[14px] bg-navy-950 text-white text-xs font-bold hover:bg-navy-900 shadow-sm transition"
            >
              {actionButtonText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
