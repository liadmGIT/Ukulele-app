import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { SETTING_KEYS, getSetting, setSetting } from '@/db';

import en from './locales/en.json';
import he from './locales/he.json';

export const SUPPORTED_LANGUAGES = ['he', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const RTL_LANGUAGES: readonly Language[] = ['he'];

export function isRtlLanguage(language: Language): boolean {
  return RTL_LANGUAGES.includes(language);
}

/**
 * Hebrew is the product default. The device locale only gets a say when it is
 * a language we actually ship.
 */
function resolveInitialLanguage(): Language {
  const stored = getSetting(SETTING_KEYS.language);
  if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
    return stored as Language;
  }

  const deviceCode = Localization.getLocales()[0]?.languageCode;
  if (deviceCode === 'en') return 'en';
  return 'he';
}

/**
 * Must run before the first render. `I18nManager.forceRTL` only takes effect on
 * the next app launch, so we apply it here and let `changeLanguage` report when
 * a restart is needed.
 */
export function initI18n(): Language {
  const language = resolveInitialLanguage();
  const shouldBeRtl = isRtlLanguage(language);

  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.forceRTL(shouldBeRtl);
  }

  void i18n.use(initReactI18next).init({
    resources: {
      he: { translation: he },
      en: { translation: en },
    },
    lng: language,
    fallbackLng: 'he',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  return language;
}

/**
 * Switches language and persists it.
 *
 * @returns `true` when the layout direction changed, meaning the app has to be
 * restarted for the new direction to take effect.
 */
export async function changeLanguage(language: Language): Promise<boolean> {
  setSetting(SETTING_KEYS.language, language);
  await i18n.changeLanguage(language);

  const shouldBeRtl = isRtlLanguage(language);
  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.forceRTL(shouldBeRtl);
    return true;
  }
  return false;
}

export default i18n;
