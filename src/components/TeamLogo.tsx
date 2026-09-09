// src/components/TeamLogo.tsx - High-Fidelity Club Logo & Resilient SVG Fallback Component with Canonical Verification
import React, { useState, useEffect } from 'react';
import { canonicalEntityManager } from '@/entity/CanonicalEntityManager';

interface TeamLogoProps {
  teamName: string;
  crestUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: { box: 'w-5 h-5 min-w-5', font: 'text-[9px]', img: 'w-4 h-4' },
  sm: { box: 'w-7 h-7 min-w-7', font: 'text-[11px]', img: 'w-5 h-5' },
  md: { box: 'w-9 h-9 min-w-9', font: 'text-xs', img: 'w-7 h-7' },
  lg: { box: 'w-12 h-12 min-w-12', font: 'text-sm', img: 'w-9 h-9' },
  xl: { box: 'w-16 h-16 min-w-16', font: 'text-base', img: 'w-12 h-12' },
};

export const TeamLogo: React.FC<TeamLogoProps> = ({
  teamName,
  crestUrl,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  // Verify logo ownership via CanonicalEntityManager (Sections 11, 12, 87, 233, 242)
  const verification = canonicalEntityManager.verifyLogo(teamName, crestUrl);

  // If a conflict is detected or image errored, suppress wrong logo image
  const effectiveCrest = !imageError && !verification.conflictDetected && verification.effectiveLogoUrl;

  useEffect(() => {
    setImageError(false);
  }, [crestUrl, teamName]);

  if (effectiveCrest) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/50 p-1 shrink-0 overflow-hidden shadow-sm ${sizeConfig.box} ${className}`}
        title={`${teamName} (Doğrulanmış Logo)`}
      >
        <img
          src={effectiveCrest}
          alt={`${teamName} arması`}
          className={`object-contain transition-opacity duration-200 ${sizeConfig.img}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Graceful SVG Monogram Fallback with Canonical Team Colors
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl font-black shrink-0 select-none shadow-sm border border-white/10 ${sizeConfig.box} ${sizeConfig.font} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${verification.primaryColor} 0%, ${verification.secondaryColor} 100%)`,
        color: verification.textColor,
      }}
      title={`${teamName} (Monogram Fallback)`}
    >
      <span className="drop-shadow-sm font-mono tracking-tighter">{verification.fallbackInitials}</span>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/25 via-transparent to-white/15 pointer-events-none" />
    </div>
  );
};
