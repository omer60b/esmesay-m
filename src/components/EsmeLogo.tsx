import React, { useState } from 'react';
import esmeLogoImg from '../assets/images/esme_logo.jpg';

interface EsmeLogoProps {
  className?: string;
  variant?: 'light' | 'dark' | 'auto';
  showSlogan?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const EsmeLogo: React.FC<EsmeLogoProps> = ({
  className = '',
  size = 'md'
}) => {
  const [imageError, setImageError] = useState(false);

  let heightClass = 'h-9';
  if (size === 'sm') heightClass = 'h-7';
  if (size === 'lg') heightClass = 'h-12';
  if (size === 'xl') heightClass = 'h-16';

  if (imageError) {
    return (
      <div className={`inline-flex items-center justify-center font-extrabold tracking-wider bg-rose-600 text-white px-3 py-1 rounded-md shadow-xs select-none ${heightClass} ${className}`}>
        <span className="text-sm font-black tracking-widest">EŞME</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center select-none ${className}`}>
      {/* Orijinal Esme Kurumsal Logosu (Vite asset import + fallbacks) */}
      <img
        src={esmeLogoImg}
        alt="Esme"
        referrerPolicy="no-referrer"
        onError={(e) => {
          // If the hashed asset fails, try the root public copy, else fallback to stylized badge
          const target = e.currentTarget as HTMLImageElement;
          if (target.src.indexOf('esme_logo.jpg') === -1) {
            target.src = '/esme_logo.jpg';
          } else {
            setImageError(true);
          }
        }}
        className={`${heightClass} w-auto max-w-full object-contain drop-shadow-xs rounded-sm`}
      />
    </div>
  );
};

