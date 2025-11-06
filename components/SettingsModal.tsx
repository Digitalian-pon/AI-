import React, { useState, useEffect } from 'react';
import { XIcon, SettingsIcon, CheckIcon, LanguagesIcon } from './Icons';
import { useI18n } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  delay: number;
  setDelay: (delay: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, delay, setDelay }) => {
  const { t, language, setLanguage } = useI18n();
  const [localDelay, setLocalDelay] = useState(delay);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setLocalDelay(delay);
  }, [delay, isOpen]);

  const handleSave = () => {
    setDelay(localDelay);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6 text-white m-4 relative animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <XIcon className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="h-7 w-7 text-purple-400" />
          <h2 className="text-2xl font-bold">{t('settingsTitle')}</h2>
        </div>

        <div className="space-y-6">
           <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
              <LanguagesIcon className="h-5 w-5 mr-2" />
              {t('settingsLanguageLabel')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('ja')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                  language === 'ja'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                日本語
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                English
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="delay-input" className="block text-sm font-medium text-gray-300">
              {t('settingsDelayLabel')}
            </label>
            <input
              type="number"
              id="delay-input"
              value={localDelay}
              onChange={(e) => setLocalDelay(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="mt-2 w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500"
              min="0"
            />
            <p className="mt-2 text-xs text-gray-400">{t('settingsDelayDescription')}</p>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center justify-center font-semibold py-2 px-5 rounded-lg transition-all duration-300 w-32 ${showSuccess ? 'bg-green-600' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50'}`}
          >
            {showSuccess ? (
              <>
                <CheckIcon className="h-5 w-5 mr-2" /> {t('settingsSaved')}
              </>
            ) : (
              t('settingsSaveButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;