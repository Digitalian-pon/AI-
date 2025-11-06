import React from 'react';
import { DownloadIcon, RotateCcwIcon, SparklesIcon, ClapperboardIcon } from './Icons';
import { useI18n } from '../i18n';

interface VideoResultProps {
  title: string;
  videoUrl: string;
  onRestart: () => void;
}

const VideoResult: React.FC<VideoResultProps> = ({ title, videoUrl, onRestart }) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto py-10">
      <div className="flex items-center gap-3 mb-2">
        <SparklesIcon className="h-10 w-10 text-yellow-400" />
        <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">
          {t('resultTitle')}
        </h2>
      </div>
      {title && (
        <div className="flex items-center gap-2 text-gray-400 mb-6">
            <ClapperboardIcon className="h-5 w-5" />
            <h3 className="text-lg font-medium">{title}</h3>
        </div>
      )}

      <div className="w-full aspect-video bg-black rounded-lg shadow-2xl shadow-purple-500/20 overflow-hidden border-2 border-purple-500/50 mb-8">
        {videoUrl && (
          <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
        )}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <a
          href={videoUrl}
          download="ai_music_video.mp4"
          className="flex-1 flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1"
        >
          <DownloadIcon className="h-6 w-6 mr-2" />
          {t('resultDownloadButton')}
        </a>
        <button
          onClick={onRestart}
          className="flex-1 flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-colors duration-300 bg-gray-700 hover:bg-gray-600 border border-gray-600"
        >
          <RotateCcwIcon className="h-6 w-6 mr-2" />
          {t('resultCreateAnotherButton')}
        </button>
      </div>
    </div>
  );
};

export default VideoResult;
