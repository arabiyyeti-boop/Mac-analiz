// src/utils/leagueHierarchy.ts - League Classification & Hierarchy

export interface LeagueCategory {
  id: string;
  name: string;
  flag: string;
  priority: number;
}

export const LEAGUE_CATEGORIES: Record<string, LeagueCategory> = {
  UEFA: { id: 'UEFA', name: 'UEFA Kupaları', flag: '🇪🇺', priority: 1 },
  TURKEY: { id: 'TURKEY', name: 'Türkiye', flag: '🇹🇷', priority: 2 },
  ENGLAND: { id: 'ENGLAND', name: 'İngiltere', flag: '🇬🇧', priority: 3 },
  SPAIN: { id: 'SPAIN', name: 'İspanya', flag: '🇪🇸', priority: 4 },
  ITALY: { id: 'ITALY', name: 'İtalya', flag: '🇮🇹', priority: 5 },
  GERMANY: { id: 'GERMANY', name: 'Almanya', flag: '🇩🇪', priority: 6 },
  FRANCE: { id: 'FRANCE', name: 'Fransa', flag: '🇫🇷', priority: 7 },
  PORTUGAL: { id: 'PORTUGAL', name: 'Portekiz', flag: '🇵🇹', priority: 8 },
  NETHERLANDS: { id: 'NETHERLANDS', name: 'Hollanda', flag: '🇳🇱', priority: 9 },
  OTHER_EUROPE: { id: 'OTHER_EUROPE', name: 'Diğer Avrupa', flag: '🌐', priority: 10 },
  OTHER_WORLD: { id: 'OTHER_WORLD', name: 'Diğer Ligler', flag: '🌍', priority: 11 },
};

export function classifyLeague(leagueName: string, country?: string): LeagueCategory {
  const normName = (leagueName || '').toLowerCase();
  const normCountry = (country || '').toLowerCase();

  // UEFA
  if (
    normName.includes('champions league') ||
    normName.includes('europa league') ||
    normName.includes('conference league') ||
    normName.includes('şampiyonlar') ||
    normName.includes('konferans') ||
    normName.includes('uefa')
  ) {
    return LEAGUE_CATEGORIES.UEFA;
  }

  // Turkey
  if (
    normCountry.includes('tur') ||
    normCountry.includes('türk') ||
    normName.includes('süper lig') ||
    normName.includes('super lig') ||
    normName.includes('1. lig') ||
    normName.includes('turkey')
  ) {
    return LEAGUE_CATEGORIES.TURKEY;
  }

  // England
  if (
    normCountry.includes('england') ||
    normCountry.includes('ingiltere') ||
    (normName.includes('premier league') && !normCountry.includes('scot')) ||
    (normName.includes('championship') && !normCountry.includes('united states') && !normCountry.includes('usa') && !normName.includes('usl') && !normName.includes('american')) ||
    normName.includes('fa cup') ||
    normName.includes('efl')
  ) {
    return LEAGUE_CATEGORIES.ENGLAND;
  }

  // Spain
  if (
    normCountry.includes('spain') ||
    normCountry.includes('ispanya') ||
    normName.includes('la liga') ||
    normName.includes('laliga') ||
    normName.includes('segunda') ||
    normName.includes('copa del rey')
  ) {
    return LEAGUE_CATEGORIES.SPAIN;
  }

  // Italy
  if (
    normCountry.includes('italy') ||
    normCountry.includes('italya') ||
    normName.includes('serie a') ||
    normName.includes('serie b') ||
    normName.includes('coppa italia')
  ) {
    return LEAGUE_CATEGORIES.ITALY;
  }

  // Germany
  if (
    normCountry.includes('germany') ||
    normCountry.includes('almanya') ||
    normName.includes('bundesliga') ||
    normName.includes('dfb')
  ) {
    return LEAGUE_CATEGORIES.GERMANY;
  }

  // France
  if (
    normCountry.includes('france') ||
    normCountry.includes('fransa') ||
    normName.includes('ligue 1') ||
    normName.includes('ligue 2') ||
    normName.includes('coupe de france')
  ) {
    return LEAGUE_CATEGORIES.FRANCE;
  }

  // Portugal
  if (
    normCountry.includes('portugal') ||
    normCountry.includes('portekiz') ||
    normName.includes('primeira') ||
    normName.includes('liga portugal') ||
    normName.includes('taca')
  ) {
    return LEAGUE_CATEGORIES.PORTUGAL;
  }

  // Netherlands
  if (
    normCountry.includes('netherlands') ||
    normCountry.includes('hollanda') ||
    normName.includes('eredivisie') ||
    normName.includes('knvb')
  ) {
    return LEAGUE_CATEGORIES.NETHERLANDS;
  }

  // Other Europe vs Other World
  const europeanCountries = [
    'belgium', 'austria', 'scotland', 'switzerland', 'greece', 'denmark', 'sweden',
    'norway', 'poland', 'czech', 'croatia', 'serbia', 'romania', 'ukraine', 'russia'
  ];

  if (europeanCountries.some(c => normCountry.includes(c) || normName.includes(c))) {
    return LEAGUE_CATEGORIES.OTHER_EUROPE;
  }

  return LEAGUE_CATEGORIES.OTHER_WORLD;
}

/**
 * Section 6: Strict negative filter against youth, reserve, women, amateur, lower tiers and friendlies
 */
export function isNegativeFilteredMatch(
  leagueName: string,
  homeTeamName?: string,
  awayTeamName?: string,
  country?: string
): boolean {
  const combined = `${leagueName} ${homeTeamName || ''} ${awayTeamName || ''} ${country || ''}`.toLowerCase();

  // 1. Youth / Junior / Academy / Age groups
  if (
    /\b(u[-_\s]?\d{1,2}|youth|junior|academy|gençlik|genc|u15|u16|u17|u18|u19|u20|u21|u23)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  // 2. Reserve / B-Teams / II Teams
  if (
    /\b(reserve|reserves|rezerv|b\s*team|b\s*tak[ıi]m[ıi]|team\s*b|\bii\b)\b/i.test(combined)
  ) {
    return true;
  }

  // 3. Women / Kadınlar
  if (
    /\b(women|women's|womens|kadın|kadınlar|kadin|kadinlar|feminin|femmes|damen|femenil|femenino)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  // 4. Amateur / Regional / 3rd tier and lower / Non-League
  if (
    /\b(amateur|amatör|regional|bölgesel|oberliga|tercera|promocion|3\.?\s*lig|4\.?\s*lig|5\.?\s*lig|national\s*2|national\s*3|serie\s*c|serie\s*d|league\s*one|league\s*two|national\s*league|non[- ]league)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  // 5. Friendly / Test / Hazırlık
  if (
    /\b(friendly|friendlies|haz[ıi]rl[ıi]k|club\s*friendly|international\s*friendly|test\s*match)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Section 5, 7 & 8: Main Bulletin Tier 1, Tier 2, and UEFA Premier Competitions.
 * Rejects ambiguous competitions (Rule 7) and non-main UEFA events (Rule 8).
 */
export function isMainBulletinCompetition(
  leagueName: string,
  country?: string,
  homeTeamName?: string,
  awayTeamName?: string
): boolean {
  if (!leagueName || leagueName.trim().length === 0) return false;

  // Immediate negative filter check
  if (isNegativeFilteredMatch(leagueName, homeTeamName, awayTeamName, country)) {
    return false;
  }

  const norm = leagueName.toLowerCase().trim();
  const normCountry = (country || '').toLowerCase().trim();

  // 1. UEFA: Strictly the 3 premier European club tournaments (Section 8)
  const isChampionsLeague = norm.includes('champions league') || norm.includes('şampiyonlar ligi');
  const isEuropaLeague = norm.includes('europa league') || norm.includes('avrupa ligi');
  const isConferenceLeague = norm.includes('conference league') || norm.includes('konferans ligi');

  if (isChampionsLeague || isEuropaLeague || isConferenceLeague) {
    // Strictly exclude youth/women/sub-competitions (Rule 8)
    if (
      norm.includes('youth') ||
      norm.includes('women') ||
      norm.includes('kadın') ||
      norm.includes('u19') ||
      norm.includes('u21')
    ) {
      return false;
    }
    return true;
  }

  // If named UEFA but not one of the top 3, exclude
  if (norm.includes('uefa')) {
    return false;
  }

  // 2. Domestic Tier 1 and Tier 2 of known countries
  // Turkey
  if (normCountry.includes('tur') || normCountry.includes('türk') || norm.includes('türkiye') || norm.includes('turkey')) {
    if (norm.includes('süper lig') || norm.includes('super lig')) return true; // Tier 1
    if (norm.includes('1. lig') || norm.includes('1.lig')) return true; // Tier 2
    return false;
  }

  // England
  if (normCountry.includes('england') || normCountry.includes('ingiltere')) {
    if (norm.includes('premier league')) return true; // Tier 1
    if (norm.includes('championship')) return true; // Tier 2
    return false;
  }

  // Spain
  if (normCountry.includes('spain') || normCountry.includes('ispanya')) {
    if (norm.includes('la liga') || norm.includes('laliga') || norm.includes('primera division')) return true; // Tier 1
    if (norm.includes('segunda') || norm.includes('la liga 2') || norm.includes('laliga 2')) return true; // Tier 2
    return false;
  }

  // Italy
  if (normCountry.includes('italy') || normCountry.includes('italya')) {
    if (norm.includes('serie a')) return true; // Tier 1
    if (norm.includes('serie b')) return true; // Tier 2
    return false;
  }

  // Germany
  if (normCountry.includes('germany') || normCountry.includes('almanya')) {
    if (norm.includes('2. bundesliga') || norm.includes('2.bundesliga')) return true; // Tier 2
    if (norm.includes('bundesliga')) return true; // Tier 1
    return false;
  }

  // France
  if (normCountry.includes('france') || normCountry.includes('fransa')) {
    if (norm.includes('ligue 1')) return true; // Tier 1
    if (norm.includes('ligue 2')) return true; // Tier 2
    return false;
  }

  // Portugal
  if (normCountry.includes('portugal') || normCountry.includes('portekiz')) {
    if (norm.includes('primeira') || (norm.includes('liga portugal') && !norm.includes('2'))) return true; // Tier 1
    if (norm.includes('liga portugal 2') || norm.includes('segunda liga') || norm.includes('ligapro')) return true; // Tier 2
    return false;
  }

  // Netherlands
  if (normCountry.includes('netherlands') || normCountry.includes('hollanda')) {
    if (norm.includes('eredivisie')) return true; // Tier 1
    if (norm.includes('eerste divisie')) return true; // Tier 2
    return false;
  }

  // Brazil (football-data.org Tier 1 BSA)
  if (normCountry.includes('brazil') || normCountry.includes('brezilya')) {
    if (norm.includes('série a') || norm.includes('serie a') || norm.includes('brasileiro') || norm.includes('brasileirão')) return true; // Tier 1
    if (norm.includes('série b') || norm.includes('serie b')) return true; // Tier 2
    return false;
  }

  // Tier 1 and 2 in other verified football federations
  const isTier1 =
    norm.includes('premier league') ||
    norm.includes('premiership') ||
    norm.includes('super league') ||
    norm.includes('superliga') ||
    norm.includes('pro league') ||
    norm.includes('first division') ||
    norm.includes('1. division') ||
    norm.includes('division 1') ||
    norm.includes('ekstraklasa') ||
    norm.includes('allsvenskan') ||
    norm.includes('eliteserien') ||
    norm.includes('major league soccer') ||
    norm.includes('mls') ||
    norm.includes('j1 league') ||
    norm.includes('brasileiro') ||
    norm.includes('campeonato brasileiro') ||
    norm.includes('serie a');

  const isTier2 =
    norm.includes('championship') ||
    norm.includes('challenge league') ||
    norm.includes('second division') ||
    norm.includes('2. division') ||
    norm.includes('division 2') ||
    norm.includes('superettan') ||
    norm.includes('usl championship') ||
    norm.includes('j2 league') ||
    norm.includes('2. liga');

  if (isTier1 || isTier2) {
    // Make sure it's not a domestic cup competition or lower tier
    if (!norm.includes('cup') && !norm.includes('kupa') && !norm.includes('pokal') && !norm.includes('trophy')) {
      return true;
    }
  }

  // Rule 7: Unverified / ambiguous competition -> Exclude from main bulletin
  return false;
}
