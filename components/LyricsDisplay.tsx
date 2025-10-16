import React from 'react';

interface LyricsDisplayProps {
  lyrics: string;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ lyrics }) => {
  const parseLyrics = (text: string) => {
    if (!text) return [];

    // Split by section headers (like Verse 1:, Chorus:, etc.).
    // The regex with a capturing group intersperses delimiters and content.
    const parts = text.split(/(Verse \d:|Pre-Chorus:|Chorus:|Bridge:|Outro:)/i);
    
    const sections: { header: string; content: string }[] = [];
    
    // The first part might be content before any header.
    if (parts[0] && parts[0].trim() !== '') {
      sections.push({ header: '', content: parts[0].trim() });
    }

    // Process the rest of the parts in pairs (header, content)
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i] && parts[i+1]) {
        sections.push({
          header: parts[i].trim().replace(':', ''),
          content: parts[i + 1].trim(),
        });
      }
    }
    
    return sections;
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
