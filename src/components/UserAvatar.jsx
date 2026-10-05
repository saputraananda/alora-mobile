import React, { useState, useEffect } from 'react';
import { getAvatarUrl } from '../utils/avatarUrl.js';

function getInitials(name) {
  if (!name) return 'AL';
  const parts = String(name).trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase() || 'AL';
}

/**
 * Reusable Avatar Component
 * Menampilkan foto profil jika tersedia, atau fallback ke inisial jika foto tidak ada / error.
 */
export default function UserAvatar({
  src,
  name,
  className = '',
  imgClassName = '',
  initialsClassName = '',
  alt = 'Foto Profil',
}) {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = getAvatarUrl(src);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const showImage = Boolean(resolvedUrl && !hasError);

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center select-none ${className}`}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={alt}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        <span className={`font-black uppercase tracking-tight ${initialsClassName}`}>
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
