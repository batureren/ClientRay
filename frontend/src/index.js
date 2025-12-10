import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import tr from './locales/tr.json'

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  tr: { translation: tr }
}

i18n
  .use(LanguageDetector) 
  .use(initReactI18next) 
  .init({
    resources,
    fallbackLng: 'en',
    
    interpolation: {
      escapeValue: false 
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },
    backend: {
      loadPath: '/locales/{{lng}}.json'
    }
  })

export default i18n