export const parseLyrics = (text: string): { header: string; content: string }[] => {
  if (!text || !text.trim()) return [];

  // Normalize newlines and split the text into blocks based on one or more blank lines.
  // This is the most reliable way to separate stanzas.
  const blocks = text.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/);

  const sections: { header: string; content: string }[] = [];

  // This regex identifies if a line is a header.
  // It's anchored to the start and end of the line to avoid partial matches.
  const headerRegex = /^\s*((?:\[[^\]]+\]|\([^)]+\)|(?:Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Hook|Interlude|Solo|Build|Post-Chorus|Refrain)[\s\d:.]*))\s*$/i;

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    const lines = trimmedBlock.split('\n');
    const firstLine = lines[0].trim();

    const match = firstLine.match(headerRegex);

    // Check if the first line is a header and is reasonably short.
    if (match && firstLine.length < 40) {
      // The first line is a header.
      const header = match[1].trim().replace(/[:\s]+$/, ''); // Clean up trailing characters
      const content = lines.slice(1).join('\n').trim();

      sections.push({ header, content });
    } else {
      // The block does not start with a header. Treat the whole block as content.
      sections.push({ header: '', content: trimmedBlock });
    }
  }

  return sections;
};
