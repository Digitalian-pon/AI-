import React, { useState, useEffect, useRef } from 'react';
import { DownloadIcon, RotateCcwIcon } from './Icons';

interface VideoResultProps {
  videoUrls: string[];
  audioUrl: string | null;
  onReset: () => void;
}

const VideoResult: React.FC<VideoResultProps> = ({ videoUrls, audioUrl, onReset }) => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleVideoEnded = () => {
    if (currentVideoIndex < videoUrls.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    } else {
      // Loop sequence
      setCurrentVideoIndex(0);
      if(audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => console.error("Video autoplay failed:", error));
    }
  }, [currentVideoIndex]);
  
  // Sync audio with the start of the first video
  useEffect(() => {
      if (audioRef.current && videoUrls.length > 0) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(error => console.error("Audio autoplay failed:", error));
      }
  }, [audioUrl, videoUrls]);

  return (
    <div className="flex flex-col items-center space-y-6">
      <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        ビデオが完成しました！
      </h2>
      
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg relative">
        {videoUrls.map((url, index) => (
             <video 
                key={url}
                ref={index === currentVideoIndex ? videoRef : null}
                src={url} 
                onEnded={handleVideoEnded}
                muted 
                playsInline
                className={`w-full h-full object-contain absolute top-0 left-0 transition-opacity duration-500 ${index === currentVideoIndex ? 'opacity-100 z-10' : 'opacity-0'}`} 
            />
        ))}
        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            Scene {currentVideoIndex + 1} / {videoUrls.length}
        </div>
      </div>
      
      {audioUrl && (
        <div className="w-full">
            <p className="text-sm text-gray-400 mb-2 text-center">アップロードした楽曲を再生しています。</p>
            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3 text-center">各シーンをダウンロード</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {videoUrls.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  download={`ai_music_video_scene_${index + 1}.mp4`}
                  className="flex flex-col items-center justify-center text-sm font-semibold py-2 px-3 rounded-lg transition-all duration-300 bg-gray-700 hover:bg-green-800/50"
                >
                  <DownloadIcon className="h-5 w-5 mb-1" />
                  シーン {index + 1}
                </a>
            ))}
        </div>
      </div>
      
      <button
          onClick={onReset}
          className="w-full max-w-md flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gray-600 hover:bg-gray-700"
        >
          <RotateCcwIcon className="h-6 w-6 mr-2" />
          新しく作る
      </button>

      <p className="text-xs text-gray-500 text-center pt-2">
        注意：生成されたビデオには音声が含まれていません。ダウンロード後、動画編集ソフトで楽曲と結合してください。
      </p>
    </div>
  );
};

export default VideoResult;
