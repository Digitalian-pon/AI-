import React from 'react';

interface LyricsDisplayProps {
  lyrics: string;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ lyrics }) => {
  const parseLyrics = (text: string): { header: string; content: string }[] => {
    if (!text) return [];

    const sections: { header: string; content: string }[] = [];
    // Regex to match common lyric section headers (e.g., "Verse 1:", "[Chorus]:", "Outro:")
    const headerRegex = /(\[?[A-Za-z]+(?:\s\d+)?\]?:)/;
    
    // Split the text by headers, keeping the headers as part of the result array by using a capturing group.
    const parts = text.split(headerRegex);
  
    if (parts.length <= 1) {
      const trimmedText = text.trim();
      return trimmedText ? [{ header: '', content: trimmedText }] : [];
    }
    
    if (parts[0] && parts[0].trim()) {
      sections.push({ header: '', content: parts[0].trim() });
    }
  
    for (let i = 1; i < parts.length; i += 2) {
      const header = (parts[i] || '').replace(':', '').trim();
      const content = (parts[i+1] || '').trim();
      if (header || content) {
          sections.push({ header, content });
      }
    }
    
    return sections.filter(s => s.header || s.content);
  };

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
