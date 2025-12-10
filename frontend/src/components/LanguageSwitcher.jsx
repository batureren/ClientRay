import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const api = useApi();
  const [isUpdating, setIsUpdating] = useState(false);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
  ];

  const changeLanguage = async (langCode) => {
    if (i18n.language === langCode || isUpdating) return;

    setIsUpdating(true);
    try {
      i18n.changeLanguage(langCode);
      await api.put('/users/language', { language: langCode });
    } catch (error) {
      console.error("Failed to update language preference:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const currentLanguageName = languages.find(lang => lang.code === i18n.language)?.name || 'English';

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900" disabled={isUpdating}>
        {isUpdating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Globe className="h-4 w-4" />
        )}
        {currentLanguageName}
      </button>

      {/* Dropdown Menu */}
      <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all w-32 z-50">
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            disabled={isUpdating}
            className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${
              i18n.language === lang.code ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;