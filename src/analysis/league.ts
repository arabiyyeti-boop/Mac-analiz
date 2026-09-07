// src/analysis/league.ts - League Baselines & Historical Goal Distributions
import { LeagueModelResult } from '@/types';
import { analysisConfig } from '@/config/analysisConfig';

interface LeagueStatsData {
  avgGoals: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
  over25Rate: number;
  bttsRate: number;
}

const KNOWN_LEAGUES: Record<string, LeagueStatsData> = {
  // Premier League (England)
  PL: { avgGoals: 2.85, homeWinRate: 0.46, drawRate: 0.24, awayWinRate: 0.30, over25Rate: 0.58, bttsRate: 0.54 },
  // La Liga (Spain)
  PD: { avgGoals: 2.55, homeWinRate: 0.44, drawRate: 0.28, awayWinRate: 0.28, over25Rate: 0.48, bttsRate: 0.49 },
  // Bundesliga (Germany)
  BL1: { avgGoals: 3.12, homeWinRate: 0.45, drawRate: 0.23, awayWinRate: 0.32, over25Rate: 0.62, bttsRate: 0.58 },
  // Serie A (Italy)
  SA: { avgGoals: 2.65, homeWinRate: 0.43, drawRate: 0.27, awayWinRate: 0.30, over25Rate: 0.51, bttsRate: 0.52 },
  // Ligue 1 (France)
  FL1: { avgGoals: 2.70, homeWinRate: 0.44, drawRate: 0.26, awayWinRate: 0.30, over25Rate: 0.53, bttsRate: 0.50 },
  // Süper Lig (Turkey)
  TSL: { avgGoals: 2.76, homeWinRate: 0.46, drawRate: 0.25, awayWinRate: 0.29, over25Rate: 0.54, bttsRate: 0.53 },
  // UEFA Champions League
  CL: { avgGoals: 3.05, homeWinRate: 0.48, drawRate: 0.22, awayWinRate: 0.30, over25Rate: 0.61, bttsRate: 0.56 },
  // Eredivisie (Netherlands)
  DED: { avgGoals: 3.18, homeWinRate: 0.47, drawRate: 0.21, awayWinRate: 0.32, over25Rate: 0.64, bttsRate: 0.59 },
  // Primeira Liga (Portugal)
  PPL: { avgGoals: 2.58, homeWinRate: 0.45, drawRate: 0.26, awayWinRate: 0.29, over25Rate: 0.49, bttsRate: 0.48 },
};

export function getLeagueBaseline(leagueCode?: string, leagueName?: string): LeagueModelResult {
  const code = (leagueCode || '').toUpperCase();
  const name = leagueName || 'Standard League';

  // Search by code or substring match in name
  let stats = KNOWN_LEAGUES[code];
  if (!stats && leagueName) {
    const lower = leagueName.toLowerCase();
    if (lower.includes('premier')) stats = KNOWN_LEAGUES.PL;
    else if (lower.includes('laliga') || lower.includes('la liga')) stats = KNOWN_LEAGUES.PD;
    else if (lower.includes('bundesliga')) stats = KNOWN_LEAGUES.BL1;
    else if (lower.includes('serie a')) stats = KNOWN_LEAGUES.SA;
    else if (lower.includes('ligue 1')) stats = KNOWN_LEAGUES.FL1;
    else if (lower.includes('süper lig') || lower.includes('super lig')) stats = KNOWN_LEAGUES.TSL;
    else if (lower.includes('champions')) stats = KNOWN_LEAGUES.CL;
    else if (lower.includes('eredivisie')) stats = KNOWN_LEAGUES.DED;
  }

  // Fallback to analysisConfig defaults
  const defaults = analysisConfig.leagueDefaults;
  const activeStats = stats || {
    avgGoals: defaults.avgTotalGoals,
    homeWinRate: defaults.homeWinRate,
    drawRate: defaults.drawRate,
    awayWinRate: defaults.awayWinRate,
    over25Rate: defaults.over25Rate,
    bttsRate: defaults.bttsRate,
  };

  return {
    leagueName: name,
    avgGoals: activeStats.avgGoals,
    homeWinRate: activeStats.homeWinRate,
    drawRate: activeStats.drawRate,
    awayWinRate: activeStats.awayWinRate,
    over25Rate: activeStats.over25Rate,
    bttsRate: activeStats.bttsRate,
  };
}
