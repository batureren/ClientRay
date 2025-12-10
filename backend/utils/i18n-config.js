// utils/i18n-config.js
const i18next = require('i18next');
const FsBackend = require('i18next-fs-backend');
const path = require('path');

const localesPath = path.join(__dirname, '..', 'locales');

i18next
  .use(FsBackend)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'tr', 'fr', 'es'],
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
      loadPath: path.join(localesPath, '{{lng}}.json'),
    },
    preload: ['en', 'tr', 'fr', 'es'],
  });

module.exports = i18next;