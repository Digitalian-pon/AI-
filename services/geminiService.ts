import { GoogleGenAI, Type } from "@google/genai";
import { LyricsGenerationResult } from './types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateTheme = async (language: 'ja' | 'en'): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = language === 'ja'
    ? `日本のポップソングのテーマになりそうな、創造的で感情に訴えかけるようなアイデアを1つだけ、短いフレーズで提案してください。`
    : `Please suggest a creative and emotional theme idea for a pop song, in one short phrase.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text.trim().replace(/^"|"$/g, ''); // Remove quotes if any
};


export const generateLyrics = async (theme: string, language: 'ja' | 'en'): Promise<LyricsGenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = language === 'ja'
    ? `以下のテーマに沿って、日本のポップソングを制作してください。
- 曲の長さは約3分程度を想定してください。
- 歌詞は2番までのフルコーラス（Verse 1, Pre-Chorus, Chorus, Verse 2, Pre-Chorus, Chorus, Bridge, Outroなど）で作成してください。
- AIによる解説や前置きは一切含めず、指定されたJSON形式のデータのみを返してください。

テーマ: ${theme}`
    : `Please create a pop song based on the following theme.
- The song should be approximately 3 minutes long.
- The lyrics should be a full song with up to 2 verses (e.g., Verse 1, Pre-Chorus, Chorus, Verse 2, Pre-Chorus, Chorus, Bridge, Outro).
- Do not include any commentary or introduction. Only return the data in the specified JSON format.

Theme: ${theme}`;


  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: language === 'ja' ? "曲のタイトル" : "The title of the song"
          },
          style: {
            type: Type.STRING,
            description: language === 'ja' ? "音楽のスタイル（例：アップテンポなJ-POP、エモーショナルなロックバラードなど）" : "The musical style (e.g., Up-tempo J-POP, Emotional rock ballad)"
          },
          lyrics: {
            type: Type.STRING,
            description: language === 'ja' ? "生成された歌詞。Verse, Pre-Chorus, Chorus, Bridge, Outroなどのセクション名を含んだフルコーラスの歌詞。" : "The generated lyrics. Full chorus lyrics including section names like Verse, Pre-Chorus, Chorus, Bridge, Outro."
          }
        },
        required: ["title", "style", "lyrics"]
      },
    },
  });

  const jsonString = response.text.trim();
  try {
    const result: LyricsGenerationResult = JSON.parse(jsonString);
    return result;
  } catch (e) {
    console.error("Failed to parse JSON from Gemini:", jsonString);
    throw new Error("AIからの応答を解析できませんでした。");
  }
};

export const generateImagePrompt = async (lyrics: string, style: string, language: 'ja' | 'en'): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = language === 'ja'
    ? `以下の歌詞と音楽スタイルに最適な、ミュージックビデオのワンシーンのようなフォトリアルな3D CGアバターの高品質な画像を生成するための、非常に詳細な英語のプロンプトを考えてください。**アニメや漫画のスタイルは絶対に避け、実写に近いフォトリアルな品質を最優先してください。**プロンプトには、以下の要素を含めてください:
- **キャラクター**: 主人公の見た目（**リアルな肌の質感、髪の毛一本一本まで緻密な描写**）、感情豊かな表情、歌っているようなダイナミックなポーズ。
- **背景**: 楽曲の世界観を表現する、印象的で美しい背景。
- **構図とライティング**: 感情を強調するシネマティックなカメラアングルと、ドラマチックな光の表現（例：逆光、スポットライト、レンズフレア）。
- **スタイル**: **Unreal Engine 5やOctane Renderでレンダリングされたような、最高品質の3D CGアート。hyper-realistic, photorealistic, 8k, cinematic lighting, ultra-detailed。**
- **出力形式**: 最終的なプロンプトは英語で、単語やフレーズをカンマで区切った形式にしてください。
---
音楽スタイル: ${style}
歌詞:
${lyrics}
---
`
    : `Based on the following lyrics and music style, create a very detailed English prompt for generating a high-quality, photorealistic 3D CG avatar image that looks like a scene from a music video. **Strictly avoid any anime or cartoon styles; prioritize photorealistic quality similar to a live-action film.** The prompt must include the following elements:
- **Character**: The protagonist's appearance (**with realistic skin texture and meticulously detailed hair**), an emotive facial expression, and a dynamic pose as if they are singing.
- **Background**: A striking and beautiful background that expresses the world of the song.
- **Composition & Lighting**: A cinematic camera angle and dramatic lighting to emphasize emotion (e.g., backlighting, spotlight, lens flare).
- **Style**: **Top-quality 3D CG art, as if rendered in Unreal Engine 5 or Octane Render. Keywords: hyper-realistic, photorealistic, 8k, cinematic lighting, ultra-detailed.**
- **Output Format**: The final prompt should be in English, with words and phrases separated by commas.
---
Music Style: ${style}
Lyrics:
${lyrics}
---
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text.trim();
};

export const generateImage = async (prompt: string, numberOfImages: number = 1): Promise<string[]> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: numberOfImages,
            outputMimeType: 'image/png',
            aspectRatio: '1:1', // Changed to 1:1 for better avatar framing
        },
    });

    return response.generatedImages.map(img => img.image.imageBytes);
};

export const generateAnimationPrompt = async (lyrics: string, style: string, language: 'ja' | 'en'): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = language === 'ja'
    ? `以下の歌詞と音楽スタイルに最適な、キャラクターが情熱的に歌っている様子を表現する短いアニメーションのプロンプトを考えてください。プロンプトには、以下の要素を含めてください:
- **キャラクターの感情**: 歌詞の内容に合わせた表情の変化（喜び、悲しみ、力強さなど）。
- **口の動き**: 歌っていることが明確にわかるような、自然な口の開閉。
- **体の動き**: リズムに合わせた体の揺れや、感情を表現するジェスチャー。
- **出力形式**: 最終的なプロンプトは、簡潔な1〜2文の日本語の文章にしてください。AIによる解説や前置きは一切含めないでください。
---
音楽スタイル: ${style}
歌詞:
${lyrics}
---
`
    : `Based on the following lyrics and music style, create a short animation prompt describing a character singing passionately. The prompt must include the following elements:
- **Character's Emotion**: Facial expression changes that match the lyrics (joy, sadness, power, etc.).
- **Mouth Movement**: Natural opening and closing of the mouth to clearly show they are singing.
- **Body Movement**: Body swaying to the rhythm or gestures that express emotion.
- **Output Format**: The final prompt should be a concise 1-2 sentence description in English. Do not include any commentary or introduction.
---
Music Style: ${style}
Lyrics:
${lyrics}
---
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text.trim();
};


export const generateMusicVideo = async (
  prompt: string,
  imageBase64: string,
  imageMimeType: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Start the video generation. This is an async operation.
  let operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt: prompt,
    image: {
      imageBytes: imageBase64,
      mimeType: imageMimeType,
    },
    config: {
      numberOfVideos: 1,
    },
  });

  // Poll for the result.
  while (!operation.done) {
    // Wait for 10 seconds before checking the status again.
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  // Check for errors in the operation.
  if (operation.error) {
    throw new Error(`Video generation failed: ${operation.error.message}`);
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!downloadLink) {
    throw new Error("Could not retrieve video download link from the API response.");
  }

  // The API key must be appended to the URI to download the video.
  const fullUrl = `${downloadLink}&key=${process.env.API_KEY}`;

  // Fetch the video data from the returned URI.
  const videoResponse = await fetch(fullUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch video data: ${videoResponse.statusText}`);
  }

  // Convert the response body to a Blob.
  const videoBlob = await videoResponse.blob();
  
  // Create an object URL from the Blob, which can be used in the <video> src attribute.
  const videoObjectUrl = URL.createObjectURL(videoBlob);
  
  return videoObjectUrl;
};
