import React, { useState, useEffect, useRef } from 'react';
import { DownloadIcon, RotateCcwIcon, PackageCheckIcon, SparklesIcon, CombineIcon } from './Icons';
import { Scene } from '../types';

declare const FFmpeg: any;

interface VideoResultProps {
  scenes: Scene[];
  videoUrls?: string[]; // Optional, for upload flow
  audioUrl: string | null;
  onReset: () => void;
  generatedTitle: string;
}

const sanitizeFilename = (name: string) => {
  if (!name) return 'Untitled';
  // Replace characters that are invalid in filenames with an underscore
  return name.replace(/[\\/:"*?<>|]/g, '_').trim();
};

const CombineSection: React.FC<{
  isCombining: boolean;
  combiningProgress: number;
  finalVideoUrl: string | null;
  combiningError: string | null;
  onCombine: () => void;
  title: string;
}> = ({ isCombining, combiningProgress, finalVideoUrl, combiningError, onCombine, title }) => (
  <div className="w-full bg-gray-900/50 p-6 rounded-lg border border-purple-700 mt-8">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-semibold flex items-center gap-3">
        <CombineIcon className="w-7 h-7 text-purple-400" />
        最終ビデオを書き出す
      </h3>
      {finalVideoUrl && (
        <a 
          href={finalVideoUrl} 
          download={`${sanitizeFilename(title)}_MusicVideo.mp4`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-lg"
        >
          <DownloadIcon className="h-5 w-5" />
          完成版をダウンロード
        </a>
      )}
    </div>
    <p className="text-sm text-gray-400 mb-5">
      すべてのビデオクリップと楽曲を1つのファイルに結合します。この処理はブラウザ内で完結し、完了まで数分かかることがあります。
    </p>
    
    {!finalVideoUrl && (
      <button 
        onClick={onCombine}
        disabled={isCombining}
        className="w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        <SparklesIcon className="h-6 w-6 mr-2" />
        {isCombining ? '結合中...' : '結合して書き出す'}
      </button>
    )}
    
    {isCombining && (
      <div className="mt-4 text-center">
        <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${combiningProgress}%` }}></div>
        </div>
        <p className="text-sm mt-2 text-gray-300">{combiningProgress}%完了</p>
      </div>
    )}

    {combiningError && (
      <p className="text-red-400 text-sm mt-4 text-center">{combiningError}</p>
    )}
  </div>
);


const VideoResult: React.FC<VideoResultProps> = ({ scenes, videoUrls: singleVideoUrl, audioUrl, onReset, generatedTitle }) => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isCombining, setIsCombining] = useState(false);
  const [combiningProgress, setCombiningProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [combiningError, setCombiningError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (finalVideoUrl) URL.revokeObjectURL(finalVideoUrl);
    };
  }, [finalVideoUrl]);

  const completedScenes = scenes.filter(s => s.generatedVideoUrl);
  const displayVideos = completedScenes.length > 0 
    ? completedScenes.map(s => ({ url: s.generatedVideoUrl!, header: s.sectionHeader }))
    : (singleVideoUrl || []).map((url, index) => ({ url, header: `Scene ${index + 1}`}));


  const handleVideoEnded = () => {
    if (currentVideoIndex < displayVideos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    } else {
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
  
  useEffect(() => {
      if (audioRef.current && displayVideos.length > 0) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(error => console.error("Audio autoplay failed:", error));
      }
  }, [audioUrl, displayVideos.length]);

  const handleDownloadAll = () => {
    displayVideos.forEach((video) => {
      const link = document.createElement('a');
      link.href = video.url;
      link.download = `${sanitizeFilename(generatedTitle)}_${sanitizeFilename(video.header)}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleCombineAndExport = async () => {
    if (!audioUrl || displayVideos.length === 0) return;

    setIsCombining(true);
    setCombiningProgress(0);
    setFinalVideoUrl(null);
    setCombiningError(null);

    try {
      const { FFmpeg: FFmpegCore, util } = FFmpeg;
      const ffmpeg = new FFmpegCore();

      ffmpeg.on('log', ({ message }: { message: string }) => console.log(message));
      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        if (progress >= 0 && progress <=1) setCombiningProgress(Math.round(progress * 100));
      });
      
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
      });
      
      const videoFileNames: string[] = [];
      for (let i = 0; i < displayVideos.length; i++) {
        const fileName = `input${i}.mp4`;
        await ffmpeg.writeFile(fileName, await util.fetchFile(displayVideos[i].url));
        videoFileNames.push(fileName);
      }

      const fileList = videoFileNames.map(name => `file '${name}'`).join('\n');
      await ffmpeg.writeFile('concat.txt', fileList);
      
      await ffmpeg.writeFile('audio.mp3', await util.fetchFile(audioUrl));
      
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'concatenated_video.mp4']);
      
      await ffmpeg.exec([ '-i', 'concatenated_video.mp4', '-i', 'audio.mp3', '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', 'output.mp4' ]);

      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));
      setFinalVideoUrl(url);

    } catch (err) {
      console.error('Error during video combination:', err);
      setCombiningError('ビデオの結合中にエラーが発生しました。詳細はコンソールを確認してください。');
    } finally {
      setIsCombining(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        ビデオが完成しました！
      </h2>
      
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg relative">
        {displayVideos.map((video, index) => (
             <video 
                key={video.url}
                ref={index === currentVideoIndex ? videoRef : null}
                src={video.url} 
                onEnded={handleVideoEnded}
                muted 
                playsInline
                className={`w-full h-full object-contain absolute top-0 left-0 transition-opacity duration-500 ${index === currentVideoIndex ? 'opacity-100 z-10' : 'opacity-0'}`} 
            />
        ))}
        {displayVideos.length > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              Scene {currentVideoIndex + 1} / {displayVideos.length}: {displayVideos[currentVideoIndex].header}
          </div>
        )}
      </div>
      
      {audioUrl && (
        <div className="w-full">
            <p className="text-sm text-gray-400 mb-2 text-center">アップロードした楽曲を再生しています。</p>
            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
        </div>
      )}

      {displayVideos.length > 0 && (
        <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">クリップをダウンロード</h3>
                <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
                    title="すべてのクリップを個別のファイルとしてダウンロードします"
                >
                    <PackageCheckIcon className="h-5 w-5" />
                    すべてダウンロード
                </button>
            </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {displayVideos.map((video, index) => (
                  <a
                    key={video.url}
                    href={video.url}
                    download={`${sanitizeFilename(generatedTitle)}_${sanitizeFilename(video.header)}.mp4`}
                    className="flex flex-col items-center justify-center text-sm font-semibold py-2 px-3 rounded-lg transition-all duration-300 bg-gray-700 hover:bg-green-800/50 text-center"
                    title={`${sanitizeFilename(generatedTitle)}_${sanitizeFilename(video.header)}.mp4`}
                  >
                    <DownloadIcon className="h-5 w-5 mb-1" />
                    シーン {index + 1}
                  </a>
              ))}
          </div>
        </div>
      )}

      {displayVideos.length > 1 && audioUrl && (
        <CombineSection
          isCombining={isCombining}
          combiningProgress={combiningProgress}
          finalVideoUrl={finalVideoUrl}
          combiningError={combiningError}
          onCombine={handleCombineAndExport}
          title={generatedTitle}
        />
      )}
      
      <button
          onClick={onReset}
          className="w-full max-w-md flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gray-600 hover:bg-gray-700 mt-4"
        >
          <RotateCcwIcon className="h-6 w-6 mr-2" />
          新しく作る
      </button>

      <p className="text-xs text-gray-500 text-center pt-2">
        注意：プレビュー中のビデオには音声が含まれていません。結合・書き出し後のファイルには音声が含まれます。
      </p>
    </div>
  );
};

export default VideoResult;