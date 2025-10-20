import { GoogleGenAI, Type } from "@google/genai";
import { LyricsGenerationResult } from '../types';

export type VideoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateTheme = async (language: 'ja' | 'en'): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = language === 'ja'
    ? `日本のポップソングのテーマになりそうな、創造的で感情に訴えかけるようなアイデアを1つだけ、短いフレーズで提案してください。`
    : `Please suggest a creative and emotional theme idea for a pop song, in one short phrase.`;

  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return response.text.trim().replace(/^"|"$/g, '');
};


export const generateLyrics = async (theme: string, language: 'ja' | 'en'): Promise<LyricsGenerationResult> => {
  if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = language === 'ja'
    ? `以下のテーマを基に、独創的な日本の楽曲を制作してください。
- 曲の長さは約3分程度を想定してください。
- 歌詞は2番までのフルコーラス（Verse 1, Pre-Chorus, Chorus, Verse 2, Pre-Chorus, Chorus, Bridge, Outroなど）で作成してください。
- 音楽スタイルは、入力されたテーマの雰囲気や感情に合わせて、AIが最も適切だと判断したものを提案してください（例：バラード、ロック、EDM、R&B、チルポップなど、具体的なスタイルを提示）。
- AIによる解説や前置きは一切含めず、指定されたJSON形式のデータのみを返してください。
テーマ: ${theme}`
    : `Based on the following theme, please create an original song.
- The song should be approximately 3 minutes long.
- The lyrics should be a full song with up to 2 verses (e.g., Verse 1, Pre-Chorus, Chorus, Bridge, Outro).
- For the musical style, please suggest what the AI deems most appropriate to match the mood and emotion of the input theme (e.g., suggest a specific style like Ballad, Rock, EDM, R&B, Chillpop, etc.).
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
          title: { type: Type.STRING, description: language === 'ja' ? "曲のタイトル" : "The title of the song" },
          style: { type: Type.STRING, description: language === 'ja' ? "音楽のスタイル" : "The musical style" },
          lyrics: { type: Type.STRING, description: language === 'ja' ? "生成された歌詞" : "The generated lyrics." }
        },
        required: ["title", "style", "lyrics"]
      },
    },
  });
  const jsonString = response.text.trim();
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini:", jsonString);
    throw new Error("AIからの応答を解析できませんでした。");
  }
};

interface ScenePromptGenerationResult {
  section: string;
  imagePrompt: string;
  animationPrompt: string;
}

export const generateScenePrompts = async (lyrics: string, style: string, language: 'ja' | 'en'): Promise<ScenePromptGenerationResult[]> => {
  if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = language === 'ja'
    ? `以下の歌詞と音楽スタイルを基に、ミュージックビデオのシーンを構成してください。歌詞をセクション（Verse 1, Chorusなど）ごとに分け、それぞれのセクションに最適な「画像生成プロンプト」と「アニメーションプロンプト」を生成してください。
# 指示
- 画像プロンプト: **シネマチック**でフォトリアルな3D CG。**魅力的な若い男性（イケメン）または女性（美女）のアバター**が中心。Unreal Engine 5のような高品質なスタイル。背景や感情も詳細に記述。必ず英語で生成してください。
- アニメーションプロンプト: キャラクターが情熱的に歌う様子。口の動きや感情表現を、簡潔な日本語の文章で記述してください。
- JSON配列形式で、解説や前置きなしで結果のみを返してください。
# 入力
音楽スタイル: ${style}
歌詞:
${lyrics}`
    : `Based on the following lyrics and music style, please structure scenes for a music video. Divide the lyrics by section (e.g., Verse 1, Chorus) and generate the optimal "Image Generation Prompt" and "Animation Prompt" for each section.
# Instructions
- Image Generation Prompt: Focus on a **cinematic**, photorealistic 3D CG avatar. The character should be an **attractive young man (handsome) or woman (beautiful)**. Use a high-quality style like Unreal Engine 5. Describe the background and emotions in detail. Must be generated in English.
- Animation Prompt: Describe the character singing passionately. Write a concise description of mouth movements and emotional expressions in English.
- Return only the results in a JSON array format without any commentary or introduction.
# Input
Music Style: ${style}
Lyrics:
${lyrics}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro', // Use a more powerful model for better scene interpretation
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            section: { type: Type.STRING, description: "The lyric section header (e.g., Verse 1, Chorus)" },
            imagePrompt: { type: Type.STRING, description: "Detailed English prompt for image generation." },
            animationPrompt: { type: Type.STRING, description: "Concise prompt for animation." }
          },
          required: ["section", "imagePrompt", "animationPrompt"]
        }
      }
    }
  });
  const jsonString = response.text.trim();
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini for scene prompts:", jsonString);
    throw new Error("シーンプロンプトの解析に失敗しました。");
  }
};


export const generateImage = async (prompt: string): Promise<string> => {
    if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9',
        },
    });
    return response.generatedImages[0].image.imageBytes;
};

const pollForVideoResult = async (operation: any): Promise<string> => {
  let currentOperation = operation;
  while (!currentOperation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Re-instantiate the client in each poll to ensure the latest API key from the dialog is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
  }

  if (currentOperation.error) throw new Error(`Video generation failed: ${currentOperation.error.message}`);
  
  const downloadLink = currentOperation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    console.error("Video generation operation completed, but no download link was found. Full response:", JSON.stringify(currentOperation, null, 2));
    throw new Error("Could not retrieve video download link from the API response. The generation may have failed silently.");
  }
  
  const fullUrl = `${downloadLink}&key=${process.env.API_KEY}`;
  const videoResponse = await fetch(fullUrl);
  if (!videoResponse.ok) throw new Error(`Failed to fetch video data: ${videoResponse.statusText}`);
  
  const videoBlob = await videoResponse.blob();
  return URL.createObjectURL(videoBlob);
};

export const generateAnimationVideo = async (
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
  modelName: VideoModel,
  lipSync: boolean,
): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let finalPrompt = `cinematic video, ${prompt}`;
  if (lipSync) {
    finalPrompt = `${finalPrompt}, The character is performing a song with passionate and expressive lip movements. The mouth shapes should realistically match the act of singing, with clear vowels and consonant articulations.`;
  }

  const operation = await ai.models.generateVideos({
    model: modelName,
    prompt: finalPrompt,
    image: { imageBytes: imageBase64, mimeType: imageMimeType },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9',
    },
  });

  return await pollForVideoResult(operation);
};