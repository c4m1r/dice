import { useState } from 'react';
import { Language, languages, getTranslations } from '../app/i18n';
import { useAppStore } from '../app/store';

export const WelcomeScreen: React.FC = () => {
  const { settings, updateSettings } = useAppStore();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const t = getTranslations(selectedLanguage);

  const handleContinue = () => {
    updateSettings({ language: selectedLanguage, welcomeShown: true });
  };

  if (settings.welcomeShown) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-white">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🎲</h1>
          <h2 className="text-3xl font-bold mb-2">{t.welcome.title}</h2>
          <p className="text-gray-400">{t.welcome.subtitle}</p>
        </div>

        {/* Language Selection */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-center">{t.welcome.selectLanguage}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedLanguage === lang.code
                    ? 'border-blue-500 bg-blue-500 bg-opacity-20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="text-4xl mb-2">{lang.flag}</div>
                <div className="font-medium">{lang.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-xl font-bold transition-colors"
        >
          {t.welcome.continue}
        </button>
      </div>
    </div>
  );
};
