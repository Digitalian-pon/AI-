
import React, { useState, useEffect } from 'react';
import { FilmIcon } from './Icons';

const loadingMessages = [
  'ビデオ生成の準備をしています...',
  'AIがキャラクターに命を吹き込んでいます...',
  '魔法の瞬間をレンダリング中...',
  '創造的なエネルギーを集中させています...',
  'もうすぐ完了です！生成には数分かかることがあります。'
];

const Loader: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
    }, 4000); // Change message every 4 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="relative">
        <FilmIcon className="w-16 h-16 text-purple-400 animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <p className="mt-4 text-lg font-semibold text-gray-300">
        {loadingMessages[messageIndex]}
      </p>
      <p className="mt-2 text-sm text-gray-500">
        しばらくお待ちください。この処理は通常2〜5分かかります。
      </p>
    </div>
  );
};

export default Loader;
