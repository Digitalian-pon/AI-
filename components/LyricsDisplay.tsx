import React from 'react';
import { Scene } from '../types';
import { ListVideoIcon, Wand2Icon, FlameIcon } from './Icons';
import { useI18n } from '../i18n';

interface LyricsDisplayProps {
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  onContinue: () => void;
  onBack: () => void;
  statusMessage: string;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ scenes, setScenes, onContinue, onBack, statusMessage }) => {
  const { t } = useI18n();
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2">
          <ListVideoIcon className="h-8 w-8 text-purple-400" />
          <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            {t('lyricsDisplayTitle')}
          </h2>
        </div>
        <p className="mt-3 text-gray-400 max-w-2xl mx-auto">
          {t('lyricsDisplaySubtitle')}
        </p>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 sm:p-6 max-h-[60vh] overflow-y-auto">
        <div className="space-y-6">
          {scenes.map((scene, index) => (
            <div key={scene.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start bg-gray-700/30 p-4 rounded-md">
              <div className="md:col-span-1">
                 <img src={URL.createObjectURL(scene.image)} alt={`Scene ${index}`} className="w-full aspect-video object-cover rounded-lg" />
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-purple-300 font-semibold mb-1">{t('scene')} {index + 1}</p>
                <p className="text-lg text-gray-200 mb-3 italic">"{scene.lyric}"</p>
                <div className="flex items-start gap-2">
                  <Wand2Icon className="h-5 w-5 text-yellow-400 mt-1 flex-shrink-0" />
                  <p className="text-sm text-gray-400 bg-gray-900/50 p-2 rounded">{scene.prompt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
       {statusMessage && (
        <div className="text-center mt-4 text-yellow-400 animate-pulse">{statusMessage}</div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
        <button onClick={onBack} className="py-3 px-6 bg-gray-600 rounded-lg font-semibold hover:bg-gray-500 transition-colors">
          {t('backButton')}
        </button>
        <button
          onClick={onContinue}
          disabled={!!statusMessage}
          className="w-full max-w-xs mx-auto flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          <FlameIcon className="h-6 w-6 mr-2" />
          {t('generateVideoButton')}
        </button>
      </div>
    </div>
  );
};

export default LyricsDisplay;