import React from 'react';
import aloraMobileWhiteLogo from '../assets/images/aloramobile-white.webp';

/**
 * Alora Logo Component using aloramobile-white.webp
 * 
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {string} [props.className='']
 */
export default function AloraLogo({ size = 'md', className = '' }) {
  const sizeClass = {
    sm: 'max-h-7',
    md: 'max-h-9',
    lg: 'max-h-14'
  }[size] || 'max-h-9';

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={aloraMobileWhiteLogo} 
        alt="Alora Mobile" 
        className={`w-auto ${sizeClass} object-contain drop-shadow-sm`}
      />
    </div>
  );
}
