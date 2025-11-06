import React, { useState } from 'react';
import { Scene } from '../types';
import { ListVideoIcon, Wand2Icon, FlameIcon, ClipboardCopyIcon, CheckIcon, RefreshCwIcon, ClockIcon, ClapperboardIcon, MicVocalIcon } from './Icons';
import { useI18n } from '../i18n';

interface LyricsDisplayProps {
  title: string;
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  onContinue: () => void;
  onBack: () => void;
  statusMessage: string;
  onRegeneratePrompt: (sceneId: number) => Promise<void>;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ title, scenes, setScenes, onContinue, onBack, statusMessage, onRegeneratePrompt }) => {
  const { t } = useI18n();
  const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const handleCopyPrompt = (prompt: string, id: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>, id: number) => {
    const newScenes = scenes.map(scene =>
      scene.id === id ? { ...scene, prompt: e.target.value } : scene
    );
    setScenes(newScenes);
  };

  const handleLipSyncToggle = (id: number) => {
    setScenes(prevScenes =>
      prevScenes.map(scene =>
        scene.id === id ? { ...scene, lipSync: !scene.lipSync } : scene
      )
    );
  };

  const handleRegenerate = async (id: number) => {
    setRegeneratingId(id);
    await onRegeneratePrompt(id);
    setRegeneratingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2">
          <ListVideoIcon className="h-8 w-8 text-purple-400" />
          <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            {t('lyricsDisplayTitle')}
          </h2>
        </div>
        {title && (
            <div className="mt-4 inline-flex items-center gap-2 bg-gray-800/50 py-2 px-4 rounded-lg border border-gray-700">
                <ClapperboardIcon className="h-5 w-5 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-200">{title}</h3>
            </div>
        )}
        <p className="mt-3 text-gray-400 max-w-2xl mx-auto">
          {t('lyricsDisplaySubtitle_withLipSync')}
        </p>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 sm:p-6 max-h-[60vh] overflow-y-auto">
        <div className="space-y-6">
          {scenes.map((scene, index) => (
            <div key={scene.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start bg-gray-900/40 p-4 rounded-lg border border-gray-700">
              <div className="md:col-span-1">
                 <img src={URL.createObjectURL(scene.image)} alt={`Scene ${index}`} className="w-full aspect-video object-cover rounded-lg" />
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-purple-300 font-semibold mb-1">{t('scene')} {index + 1}</p>
                <p className="text-lg text-gray-200 mb-3 italic">"{scene.lyric}"</p>
                <div className="flex items-start gap-2">
                  <Wand2Icon className="h-5 w-5 text-yellow-400 mt-2 flex-shrink-0" />
                  <div className="w-full">
                    <label htmlFor={`prompt-${scene.id}`} className="sr-only">
                      {t('promptForScene', { sceneNum: index + 1 })}
                    </label>
                    <textarea
                      id={`prompt-${scene.id}`}
                      value={scene.prompt}
                      onChange={(e) => handlePromptChange(e, scene.id)}
                      rows={3}
                      className="w-full text-sm text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-600 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder={t('promptEditPlaceholder')}
                    />
                    <div className="flex items-center justify-between gap-2 mt-2">
                        <div 
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => handleLipSyncToggle(scene.id)}
                          title={t('lipSyncTooltip')}
                        >
                            <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${scene.lipSync ? 'bg-purple-600' : 'bg-gray-600'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${scene.lipSync ? 'translate-x-5' : ''}`} />
                            </div>
                            <MicVocalIcon className={`h-5 w-5 transition-colors ${scene.lipSync ? 'text-purple-400' : 'text-gray-400'}`} />
                            <span className={`text-xs font-semibold transition-colors ${scene.lipSync ? 'text-purple-300' : 'text-gray-400'}`}>{t('lipSyncToggle')}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <button onClick={() => handleCopyPrompt(scene.prompt, scene.id)} title={t('copyPromptTooltip')} className="flex items-center text-xs py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-gray-300">
                            {copiedPromptId === scene.id ? <CheckIcon className="h-4 w-4 text-green-400"/> : <ClipboardCopyIcon className="h-4 w-4"/>}
                          </button>
                          <button onClick={() => handleRegenerate(scene.id)} disabled={regeneratingId === scene.id} title={t('regeneratePromptTooltip')} className="flex items-center text-xs py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-gray-300 disabled:opacity-50 disabled:cursor-wait">
                            {regeneratingId === scene.id ? <ClockIcon className="h-4 w-4 animate-spin"/> : <RefreshCwIcon className="h-4 w-4"/>}
                          </button>
                       </div>
                    </div>
                  </div>
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
          disabled={!!statusMessage || scenes.some(s => s.prompt === t('promptGenerating'))}
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
