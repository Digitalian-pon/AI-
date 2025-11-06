import React from 'react';
import { Scene } from '../types';
import { ClockIcon, PackageCheckIcon, StopCircleIcon, FilmIcon, Wand2Icon } from './Icons';
import { useI18n } from '../i18n';

interface LoaderProps {
  statusMessage: string;
  progress: number;
  scenes: Scene[];
}

const Loader: React.FC<LoaderProps> = ({ statusMessage, progress, scenes }) => {
  const { t } = useI18n();
  const getStatusIcon = (status: Scene['status']) => {
    switch (status) {
      case 'completed':
        return <PackageCheckIcon className="h-5 w-5 text-green-400" />;
      case 'failed':
        return <StopCircleIcon className="h-5 w-5 text-red-400" />;
      case 'generating':
         return <ClockIcon className="h-5 w-5 text-yellow-400 animate-spin" />;
      case 'pending':
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto py-10">
      <div className="flex items-center text-purple-400 mb-6">
        <Wand2Icon className="h-10 w-10 mr-4 animate-pulse" />
        <h2 className="text-3xl font-bold">{t('loaderTitle')}</h2>
      </div>
      <p className="text-gray-400 mb-8 text-center">
        {t('loaderSubtitle')}
      </p>

      <div className="w-full bg-gray-700 rounded-full h-4 mb-2 overflow-hidden border border-gray-600">
        <div
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="h-8 flex items-center">
        <p className="text-lg font-semibold text-gray-300">{statusMessage}</p>
      </div>
      
      <div className="w-full bg-gray-800/50 p-4 rounded-lg border border-gray-700 max-h-80 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-3 text-gray-200 flex items-center">
            <FilmIcon className="h-5 w-5 mr-2" />
            {t('loaderSceneProgress')}
        </h3>
        <ul className="space-y-3">
          {scenes.map((scene) => (
            <li key={scene.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
              <div className="flex items-center overflow-hidden">
                <img src={URL.createObjectURL(scene.image)} alt={`scene ${scene.id}`} className="w-12 h-9 object-cover rounded mr-4 flex-shrink-0" />
                <p className="text-sm text-gray-300 truncate pr-4">
                  <span className="font-semibold text-gray-200">{t('scene')} {scene.id + 1}:</span> {scene.lyric}
                </p>
              </div>
              <div className="flex-shrink-0">
                {getStatusIcon(scene.status)}
              </div>
            </li>
          ))}
        </ul>
        {scenes.some(s => s.status === 'failed') && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-md text-red-300 text-sm">
                {t('loaderFailedScenesWarning')}
            </div>
        )}
      </div>
    </div>
  );
};

export default Loader;