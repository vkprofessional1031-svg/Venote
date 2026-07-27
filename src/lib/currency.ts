export function getCurrencySymbolFromLocale(): string {
  if (typeof navigator === 'undefined') return '$';
  
  const lang = navigator.language;
  if (!lang) return '$';

  // Some browsers might return just 'en' instead of 'en-US'
  const region = lang.includes('-') ? lang.split('-')[1].toUpperCase() : lang.toUpperCase();
  
  const currencyMap: Record<string, string> = {
    US: '$',
    IN: '₹',
    GB: '£',
    UK: '£',
    EU: '€',
    FR: '€',
    DE: '€',
    IT: '€',
    ES: '€',
    NL: '€',
    JP: '¥',
    CA: 'C$',
    AU: 'A$',
    NZ: 'NZ$',
    CN: '¥',
    KR: '₩',
    RU: '₽',
    BR: 'R$',
    ZA: 'R',
    SG: 'S$',
    AE: 'د.إ',
    SA: '﷼',
  };

  return currencyMap[region] || '$';
}
