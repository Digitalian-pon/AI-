
import React from 'react';
import { DownloadIcon, RotateCcwIcon } from './Icons';

interface VideoResultProps {
  videoUrl: string;
  audioUrl: string | null;
  onReset: () => void;
}

const VideoResult: React.FC<VideoResultProps> = ({ videoUrl, audioUrl, onReset }) => {
  return (
    <div className="flex flex-col items-center space-y-6">
      <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        ビデオが完成しました！
      </h2>
      
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
        <video src={videoUrl} controls autoPlay loop muted className="w-full h-full object-contain" />
      </div>
      
      {audioUrl && (
        <div className="w-full">
            <p className="text-sm text-gray-400 mb-2 text-center">アップロードした楽曲を再生して、ビデオと一緒にお楽しみください。</p>
            <audio src={audioUrl} controls className="w-full" />
        </div>
      )}
      
      <div className="w-full flex flex-col sm:flex-row gap-4">
        <a
          href={videoUrl}
          download="ai_music_video.mp4"
          className="flex-1 flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-green-500/50"
        >
          <DownloadIcon className="h-6 w-6 mr-2" />
          ビデオをダウンロード
        </a>
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gray-600 hover:bg-gray-700"
        >
          <RotateCcwIcon className="h-6 w-6 mr-2" />
          新しく作る
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center pt-2">
        注意：生成されたビデオには音声が含まれていません。ダウンロード後、動画編集ソフトで楽曲と結合してください。
      </p>
    </div>
  );
};

export default VideoResult;
