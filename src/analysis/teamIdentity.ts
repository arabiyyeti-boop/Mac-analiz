// src/analysis/teamIdentity.ts - Team Normalization, Canonical Aliasing, Logos & Branding
import { CanonicalEntityManager } from '../entity/CanonicalEntityManager';

export interface TeamBranding {
  id: string | number;
  canonicalName: string;
  shortName: string;
  aliases: string[];
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  crestUrl: string;
  country: string;
  leagueId?: string | number;
}

export const KNOWN_TEAMS_BRANDING: Record<string, TeamBranding> = {
  // Turkish Süper Lig
  galatasaray: {
    id: 610,
    canonicalName: 'Galatasaray',
    shortName: 'GS',
    aliases: ['galatasaray sk', 'galatasaray a.s.', 'galatasaray istanbul', 'gala'],
    primaryColor: '#A90432', // Crimson
    secondaryColor: '#FDB912', // Gold
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/610.png',
    country: 'Turkey',
  },
  fenerbahce: {
    id: 600,
    canonicalName: 'Fenerbahçe',
    shortName: 'FB',
    aliases: ['fenerbahce sk', 'fenerbahce istanbul', 'fener'],
    primaryColor: '#002D72', // Navy
    secondaryColor: '#FFED00', // Yellow
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/600.png',
    country: 'Turkey',
  },
  besiktas: {
    id: 603,
    canonicalName: 'Beşiktaş',
    shortName: 'BJK',
    aliases: ['besiktas jk', 'besiktas istanbul', 'kartal'],
    primaryColor: '#111827', // Black
    secondaryColor: '#E5E7EB', // White
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/603.png',
    country: 'Turkey',
  },
  trabzonspor: {
    id: 605,
    canonicalName: 'Trabzonspor',
    shortName: 'TS',
    aliases: ['trabzonspor kulubu', 'trabzon'],
    primaryColor: '#800020', // Claret
    secondaryColor: '#5BC0BE', // Sky Blue
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/605.png',
    country: 'Turkey',
  },
  basaksehir: {
    id: 608,
    canonicalName: 'Başakşehir',
    shortName: 'İBFK',
    aliases: ['istanbul basaksehir', 'basaksehir fk', 'm. basaksehir'],
    primaryColor: '#F26522', // Orange
    secondaryColor: '#1A2B4C', // Navy
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/608.png',
    country: 'Turkey',
  },
  samsunspor: {
    id: 609,
    canonicalName: 'Samsunspor',
    shortName: 'SAM',
    aliases: ['yilport samsunspor', 'samsun'],
    primaryColor: '#DC2626',
    secondaryColor: '#FFFFFF',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/609.png',
    country: 'Turkey',
  },
  eyupspor: {
    id: 611,
    canonicalName: 'Eyüpspor',
    shortName: 'EYÜP',
    aliases: ['ikas eyupspor', 'eyup'],
    primaryColor: '#581C87', // Purple
    secondaryColor: '#FACC15', // Yellow
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/611.png',
    country: 'Turkey',
  },

  // Premier League
  manchestercity: {
    id: 65,
    canonicalName: 'Manchester City',
    shortName: 'MCI',
    aliases: ['man city', 'mancity', 'manchester c.'],
    primaryColor: '#6CABDD',
    secondaryColor: '#1C2C5B',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/65.png',
    country: 'England',
  },
  arsenal: {
    id: 57,
    canonicalName: 'Arsenal',
    shortName: 'ARS',
    aliases: ['arsenal fc', 'the gunners'],
    primaryColor: '#EF0107',
    secondaryColor: '#063672',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/57.png',
    country: 'England',
  },
  liverpool: {
    id: 64,
    canonicalName: 'Liverpool',
    shortName: 'LIV',
    aliases: ['liverpool fc', 'the reds'],
    primaryColor: '#C8102E',
    secondaryColor: '#00B2A9',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/64.png',
    country: 'England',
  },
  chelsea: {
    id: 61,
    canonicalName: 'Chelsea',
    shortName: 'CHE',
    aliases: ['chelsea fc', 'the blues'],
    primaryColor: '#034694',
    secondaryColor: '#EE242C',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/61.png',
    country: 'England',
  },
  manchesterunited: {
    id: 66,
    canonicalName: 'Manchester United',
    shortName: 'MUN',
    aliases: ['man united', 'man utd', 'manchester utd', 'mufc'],
    primaryColor: '#DA291C',
    secondaryColor: '#FBE122',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/66.png',
    country: 'England',
  },
  tottenham: {
    id: 73,
    canonicalName: 'Tottenham Hotspur',
    shortName: 'TOT',
    aliases: ['tottenham', 'spurs', 'tottenham hotspur fc'],
    primaryColor: '#132257',
    secondaryColor: '#FFFFFF',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/73.png',
    country: 'England',
  },

  // La Liga
  realmadrid: {
    id: 86,
    canonicalName: 'Real Madrid',
    shortName: 'RMA',
    aliases: ['real madrid cf', 'los blancos'],
    primaryColor: '#00529F',
    secondaryColor: '#EE9600',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/86.png',
    country: 'Spain',
  },
  barcelona: {
    id: 81,
    canonicalName: 'Barcelona',
    shortName: 'BAR',
    aliases: ['fc barcelona', 'barca'],
    primaryColor: '#004D98',
    secondaryColor: '#A50044',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/81.png',
    country: 'Spain',
  },
  atleticomadrid: {
    id: 78,
    canonicalName: 'Atletico Madrid',
    shortName: 'ATM',
    aliases: ['atletico de madrid', 'atletico', 'atleti'],
    primaryColor: '#CB3524',
    secondaryColor: '#272E61',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/78.png',
    country: 'Spain',
  },

  // Bundesliga
  bayernmunich: {
    id: 5,
    canonicalName: 'Bayern Munich',
    shortName: 'BAY',
    aliases: ['fc bayern munchen', 'bayern', 'bayern munchen'],
    primaryColor: '#DC052D',
    secondaryColor: '#0066B2',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/5.png',
    country: 'Germany',
  },
  borussiadortmund: {
    id: 4,
    canonicalName: 'Borussia Dortmund',
    shortName: 'BVB',
    aliases: ['bvb 09', 'dortmund', 'borussia dortmund 09'],
    primaryColor: '#FDE100',
    secondaryColor: '#111827',
    textColor: '#111827',
    crestUrl: 'https://crests.football-data.org/4.png',
    country: 'Germany',
  },
  bayerleverkusen: {
    id: 3,
    canonicalName: 'Bayer Leverkusen',
    shortName: 'B04',
    aliases: ['leverkusen', 'bayer 04 leverkusen'],
    primaryColor: '#E32221',
    secondaryColor: '#111827',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/3.png',
    country: 'Germany',
  },

  // Serie A
  intermilan: {
    id: 108,
    canonicalName: 'Inter Milan',
    shortName: 'INT',
    aliases: ['inter', 'fc internazionale milano', 'internazionale'],
    primaryColor: '#00579C',
    secondaryColor: '#111827',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/108.png',
    country: 'Italy',
  },
  acmilan: {
    id: 98,
    canonicalName: 'AC Milan',
    shortName: 'MIL',
    aliases: ['milan', 'rossoneri'],
    primaryColor: '#FB090B',
    secondaryColor: '#111827',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/98.png',
    country: 'Italy',
  },
  juventus: {
    id: 109,
    canonicalName: 'Juventus',
    shortName: 'JUV',
    aliases: ['juve', 'juventus fc'],
    primaryColor: '#111827',
    secondaryColor: '#F3F4F6',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/109.png',
    country: 'Italy',
  },

  // Portugal & Others
  benfica: {
    id: 1903,
    canonicalName: 'Benfica',
    shortName: 'SLB',
    aliases: ['sl benfica', 'benfica lissabon'],
    primaryColor: '#E30613',
    secondaryColor: '#FFFFFF',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/1903.png',
    country: 'Portugal',
  },
  moreirense: {
    id: 583,
    canonicalName: 'Moreirense',
    shortName: 'MOR',
    aliases: ['moreirense fc'],
    primaryColor: '#006837',
    secondaryColor: '#FFFFFF',
    textColor: '#FFFFFF',
    crestUrl: 'https://crests.football-data.org/583.png',
    country: 'Portugal',
  },
};

export class TeamIdentityService {
  /**
   * Normalizes team name by stripping accents, lowercase, punctuation, and common suffixes.
   */
  public static normalizeTeamName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      // Replace Turkish characters
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      // Remove common legal entity prefixes/suffixes (preserving identifying club names like City, United, etc.)
      .replace(/\b(sk|fk|a\.s\.|as|fc|cf|sc|kulubu|spor|kulübü)\b/gi, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Resolves canonical branding (colors, short name, crest) for any team name.
   */
  public static resolveBranding(rawName: string, crestOverride?: string): TeamBranding {
    const normalized = this.normalizeTeamName(rawName);

    // 1. Direct match
    if (KNOWN_TEAMS_BRANDING[normalized]) {
      const match = KNOWN_TEAMS_BRANDING[normalized];
      return {
        ...match,
        crestUrl: crestOverride || match.crestUrl,
      };
    }

    // 2. Alias match
    for (const branding of Object.values(KNOWN_TEAMS_BRANDING)) {
      if (
        this.normalizeTeamName(branding.canonicalName) === normalized ||
        branding.aliases.some((a) => this.normalizeTeamName(a) === normalized)
      ) {
        return {
          ...branding,
          crestUrl: crestOverride || branding.crestUrl,
        };
      }
    }

    // 3. Fallback procedural branding
    const initials = this.getInitials(rawName);
    const hash = this.stringToColorHash(rawName);

    return {
      id: `gen_${normalized}`,
      canonicalName: rawName,
      shortName: initials,
      aliases: [rawName],
      primaryColor: hash.primary,
      secondaryColor: hash.secondary,
      textColor: '#FFFFFF',
      crestUrl: crestOverride || '',
      country: 'Global',
    };
  }

  /**
   * Computes deterministic match confidence between two team strings (0 to 1)
   * Uses CanonicalEntityManager entity resolution and token-set overlap, avoiding naive substring matching.
   */
  public static matchConfidence(nameA: string, nameB: string, countryA?: string, countryB?: string): number {
    if (!nameA || !nameB) return 0;

    const normA = this.normalizeTeamName(nameA);
    const normB = this.normalizeTeamName(nameB);

    if (!normA || !normB) return 0;
    if (normA === normB) return 1.0;

    // Resolve both entities through CanonicalEntityManager
    const em = CanonicalEntityManager.getInstance();
    const resA = em.resolveTeam({ name: nameA, country: countryA });
    const resB = em.resolveTeam({ name: nameB, country: countryB });

    // Country conflict guard: if country context exists and conflicts, reject
    if (resA.reason === 'COUNTRY_CONFLICT' || resB.reason === 'COUNTRY_CONFLICT') {
      return 0;
    }

    // Known canonical records check
    if (resA.team && resB.team) {
      if (resA.team.canonicalTeamId === resB.team.canonicalTeamId) {
        return Math.min(resA.confidence, resB.confidence);
      }
      // Both are known but DIFFERENT canonical clubs (e.g., Manchester City vs Manchester United)
      // Never match them! Return 0.0
      return 0;
    }

    // Token-set Jaccard similarity (deterministic token sets, NO naive substring matching)
    const tokensA = new Set(normA.split(/\s+/).filter((t) => t.length > 1));
    const tokensB = new Set(normB.split(/\s+/).filter((t) => t.length > 1));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    // Reject low or ambiguous token overlap
    if (jaccard < 0.65) {
      return 0;
    }

    // High token overlap, refine with Levenshtein
    const lev = this.levenshteinSimilarity(normA, normB);
    return Math.max(jaccard, lev);
  }

  public static getInitials(name: string): string {
    if (!name) return 'FC';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 3).toUpperCase();
  }

  private static stringToColorHash(str: string): { primary: string; secondary: string } {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      { primary: '#2563EB', secondary: '#1E40AF' }, // Blue
      { primary: '#DC2626', secondary: '#991B1B' }, // Red
      { primary: '#059669', secondary: '#065F46' }, // Emerald
      { primary: '#7C3AED', secondary: '#5B21B6' }, // Purple
      { primary: '#D97706', secondary: '#92400E' }, // Amber
      { primary: '#0891B2', secondary: '#155E75' }, // Cyan
      { primary: '#4F46E5', secondary: '#3730A3' }, // Indigo
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  private static levenshteinSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;

    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return (longerLength - costs[s2.length]) / longerLength;
  }
}

/**
 * Item 127: Canonical Team Identity Model
 */
export interface CanonicalTeamIdentity {
  id: string;
  name: string;
  normalizedName: string;
  shortName: string;
  aliases: string[];
  country?: string;
  leagueId?: string;
  logoUrl?: string;
  logoSource?: 'VERIFIED_API' | 'LOCAL_CANONICAL' | 'CDN' | 'NONE';
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  updatedAt?: string;
}

/**
 * Item 129: Team Logo Cache
 * teamId, logoUrl, logoSource, cachedAt
 */
export interface LogoCacheEntry {
  teamId: string;
  logoUrl: string;
  logoSource: 'VERIFIED_API' | 'LOCAL_CANONICAL' | 'CDN' | 'NONE';
  cachedAt: string;
  expiresAt: number;
}

export class LogoCache {
  private static cache: Map<string, LogoCacheEntry> = new Map();
  private static readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  public static get(teamId: string): LogoCacheEntry | null {
    if (!teamId) return null;
    const key = String(teamId).toLowerCase().trim();
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  public static set(
    teamId: string,
    logoUrl: string,
    logoSource: 'VERIFIED_API' | 'LOCAL_CANONICAL' | 'CDN' | 'NONE' = 'VERIFIED_API',
    ttlMs: number = this.DEFAULT_TTL_MS
  ): void {
    if (!teamId) return;
    const key = String(teamId).toLowerCase().trim();
    this.cache.set(key, {
      teamId: key,
      logoUrl,
      logoSource,
      cachedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  public static has(teamId: string): boolean {
    return this.get(teamId) !== null;
  }

  public static clear(): void {
    this.cache.clear();
  }

  public static size(): number {
    return this.cache.size;
  }
}

/**
 * Item 135: Duplicate Fixture Protection - Canonical Fixture Key
 */
export function createCanonicalFixtureKey(
  homeTeamId: string | number,
  awayTeamId: string | number,
  kickoffDate: string,
  competitionId?: string | number
): string {
  const dateStr = kickoffDate ? kickoffDate.split('T')[0] : 'unknown_date';
  const homeStr = TeamIdentityService.normalizeTeamName(String(homeTeamId));
  const awayStr = TeamIdentityService.normalizeTeamName(String(awayTeamId));
  const compStr = competitionId ? `_${competitionId}` : '';
  return `${homeStr}_vs_${awayStr}_${dateStr}${compStr}`;
}

/**
 * Item 136: Source Conflict Detection between Providers
 */
export function detectSourceConflict(
  matchA: { homeTeam: string; awayTeam: string; kickoff: string; league?: string },
  matchB: { homeTeam: string; awayTeam: string; kickoff: string; league?: string },
  providerA: string,
  providerB: string
): Array<{
  type: 'TEAM_MISMATCH' | 'KICKOFF_DISCREPANCY' | 'LEAGUE_MISMATCH' | 'STATUS_CONFLICT';
  message: string;
  severity: 'WARNING' | 'BLOCKING';
  providerA: string;
  providerB: string;
  field: string;
  valueA: any;
  valueB: any;
}> {
  const conflicts: Array<{
    type: 'TEAM_MISMATCH' | 'KICKOFF_DISCREPANCY' | 'LEAGUE_MISMATCH' | 'STATUS_CONFLICT';
    message: string;
    severity: 'WARNING' | 'BLOCKING';
    providerA: string;
    providerB: string;
    field: string;
    valueA: any;
    valueB: any;
  }> = [];

  // 1. Kickoff discrepancy > 30 minutes
  const timeA = new Date(matchA.kickoff).getTime();
  const timeB = new Date(matchB.kickoff).getTime();
  if (!isNaN(timeA) && !isNaN(timeB)) {
    const diffMin = Math.abs(timeA - timeB) / (1000 * 60);
    if (diffMin > 30) {
      conflicts.push({
        type: 'KICKOFF_DISCREPANCY',
        message: `Maç başlama saati uyumsuzluğu: ${providerA} (${matchA.kickoff}) vs ${providerB} (${matchB.kickoff}). Fark: ${Math.round(diffMin)} dk.`,
        severity: diffMin > 180 ? 'BLOCKING' : 'WARNING',
        providerA,
        providerB,
        field: 'kickoff',
        valueA: matchA.kickoff,
        valueB: matchB.kickoff,
      });
    }
  }

  // 2. Team confidence check
  const homeConf = TeamIdentityService.matchConfidence(matchA.homeTeam, matchB.homeTeam);
  if (homeConf < 0.6) {
    conflicts.push({
      type: 'TEAM_MISMATCH',
      message: `Ev sahibi takım eşleşme güveni düşük (${Math.round(homeConf * 100)}%): "${matchA.homeTeam}" vs "${matchB.homeTeam}"`,
      severity: 'BLOCKING',
      providerA,
      providerB,
      field: 'homeTeam',
      valueA: matchA.homeTeam,
      valueB: matchB.homeTeam,
    });
  }

  const awayConf = TeamIdentityService.matchConfidence(matchA.awayTeam, matchB.awayTeam);
  if (awayConf < 0.6) {
    conflicts.push({
      type: 'TEAM_MISMATCH',
      message: `Deplasman takımı eşleşme güveni düşük (${Math.round(awayConf * 100)}%): "${matchA.awayTeam}" vs "${matchB.awayTeam}"`,
      severity: 'BLOCKING',
      providerA,
      providerB,
      field: 'awayTeam',
      valueA: matchA.awayTeam,
      valueB: matchB.awayTeam,
    });
  }

  return conflicts;
}
