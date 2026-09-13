// src/components/TeamLogo.tsx - High-Fidelity Club Logo with Canonical Verification & Neutral ⚽ Fallback
import React, { useState, useEffect } from 'react';
import { canonicalEntityManager } from '@/entity/CanonicalEntityManager';

interface TeamLogoProps {
  teamName: string;
  crestUrl?: string;
  canonicalTeamId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: { box: 'w-5 h-5 min-w-5', font: 'text-[10px]', img: 'w-3.5 h-3.5' },
  sm: { box: 'w-7 h-7 min-w-7', font: 'text-xs', img: 'w-5 h-5' },
  md: { box: 'w-9 h-9 min-w-9', font: 'text-sm', img: 'w-7 h-7' },
  lg: { box: 'w-12 h-12 min-w-12', font: 'text-lg', img: 'w-9 h-9' },
  xl: { box: 'w-16 h-16 min-w-16', font: 'text-2xl', img: 'w-12 h-12' },
};

export const TeamLogo: React.FC<TeamLogoProps> = ({
  teamName,
  crestUrl,
  canonicalTeamId,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  // Verify logo ownership via CanonicalEntityManager (Sections 11, 12, 87, 233, 242)
  const verification = canonicalEntityManager.verifyLogo(teamName, crestUrl, canonicalTeamId);

  // If a conflict is detected or image errored, suppress wrong logo image
  const effectiveCrest = !imageError && !verification.conflictDetected && verification.effectiveLogoUrl;

  useEffect(() => {
    setImageError(false);
  }, [crestUrl, teamName, canonicalTeamId]);

  if (effectiveCrest) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/50 p-1 shrink-0 overflow-hidden shadow-xs ${sizeConfig.box} ${className}`}
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

  // Neutral ⚽ Football Avatar Fallback (Strict requirement: no monograms, no fake/guessed logos)
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/50 shrink-0 select-none shadow-xs ${sizeConfig.box} ${className}`}
      title={`${teamName}`}
    >
      <span className={`${sizeConfig.font} leading-none drop-shadow-xs select-none`} role="img" aria-label="Futbol Topu">
        ⚽
      </span>
    </div>
  );
};
