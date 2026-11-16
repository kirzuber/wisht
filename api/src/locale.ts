/** Supported product locales. User preference is independent of the language of a Wish. */
export const supportedLocales = ['en', 'ru', 'fr', 'es'] as const;
export type Locale = (typeof supportedLocales)[number];
export const localeLabels: Record<Locale, string> = {
  en: 'English', ru: 'Русский', fr: 'Français', es: 'Español',
};
export const intlLocales: Record<Locale, string> = {
  en: 'en-CA', ru: 'ru-RU', fr: 'fr-CA', es: 'es-ES',
};
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && supportedLocales.includes(value as Locale);
}
/** Browser language negotiation; an explicit language choice is never inferred from the Wish text. */
export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== 'string') return 'en';
  const language=value.toLowerCase().split(/[-_]/)[0];
  return isLocale(language) ? language : 'en';
}
/** Locale instructions are controlled by the application, never by the user's text. */
export function languageInstruction(locale: Locale): string {
  const instructions: Record<Locale,string> = {
    en: 'Write every user-visible draft field in natural English.',
    ru: 'Write every user-visible draft field in natural Russian. Address the person respectfully using «Вы».',
    fr: 'Write every user-visible draft field in natural French. Use respectful «vous» and idiomatic wording.',
    es: 'Write every user-visible draft field in natural Spanish (Spain). Use natural European Spanish without literal translations.',
  };
  return `Selected interface locale: ${locale}. ${instructions[locale]} Do not copy the language of the original goal if it differs. Keep JSON field names and schema identifiers in English. Do not translate the person's original source note. The selected locale controls generated questions, drafts, unknowns, boundaries and next-Deed text.`;
}
