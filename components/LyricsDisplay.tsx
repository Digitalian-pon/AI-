
import React from 'react';
import { parseLyrics } from '../utils';

interface LyricsDisplayProps {
  lyrics: string;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ lyrics }) => {
  const parsedLyrics = parseLyrics(lyrics);

  return (
    <div className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-4 text-base font-sans leading-relaxed transition max-h-96 overflow-y-auto">
      {parsedLyrics.length > 0 ? (
        parsedLyrics.map((section, index) => (
          <div key={index} className="mb-4 last:mb-0">
            {section.header && (
              <h5 className="font-semibold text-purple-300 mb-1">{section.header}</h5>
            )}
            <p className="text-gray-300 whitespace-pre-wrap">{section.content}</p>
          </div>
        ))
      ) : (
        <p className="text-gray-500">歌詞がここに表示されます...</p>
      )}
    </div>
  );
};

export default LyricsDisplay;
