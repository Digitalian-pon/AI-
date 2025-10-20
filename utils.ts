export const parseLyrics = (text: string): { header: string; content: string }[] => {
    if (!text || !text.trim()) return [];

    // 1. テキストをクリーニングし、改行を統一
    const cleanedText = text.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').trim();

    // 2. 空行（連続する改行）でブロックに分割。これがシーンの基本単位となる
    const blocks = cleanedText.split(/\n\s*\n/).filter(block => block.trim() !== '');

    // もしブロック分割で何も得られなかった場合（例：空行がなく、改行のみ）、全体を1シーンとして返す
    if (blocks.length === 0) {
        return cleanedText ? [{ header: 'Scene 1', content: cleanedText }] : [];
    }

    // 3. 各ブロックを解析してヘッダーとコンテントに分ける
    const sections: { header: string; content: string }[] = [];
    
    // ヘッダーをマッチさせるための正規表現
    const headerRegex = /^\s*(?:\[([^\]]+)\]|\(([^)]+)\)|(Verse \d+|Pre-Chorus|Chorus|Bridge|Intro|Outro|Interlude|Hook)\b:?)/i;

    blocks.forEach((block, index) => {
        const lines = block.trim().split('\n');
        const firstLine = lines[0].trim();
        const match = firstLine.match(headerRegex);

        let header = '';
        let content = '';

        if (match) {
            // ヘッダーが見つかった場合
            header = (match[1] || match[2] || match[3] || '').trim();
            
            // ヘッダー部分を除いた残りをコンテンツとする
            const contentFromFirstLine = firstLine.substring(match[0].length).trim();
            const restOfLines = lines.slice(1).join('\n');
            content = [contentFromFirstLine, restOfLines].filter(Boolean).join('\n').trim();
            
            // ヘッダーだけの行で、内容が次の行から始まっている場合
            if (!content && lines.length > 1) {
                content = lines.slice(1).join('\n').trim();
            }
        } else {
            // ヘッダーが見つからない場合、自動でヘッダーを命名
            header = `Scene ${index + 1}`;
            content = block.trim();
        }

        // コンテンツがある場合のみセクションを追加
        if (content) {
            sections.push({ header, content });
        }
    });

    return sections;
};
