import { GoogleGenAI, Type } from "@google/genai";
import { LyricsGenerationResult, Scene } from '../types';

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
    ? `人々に勇気や感動、未来への希望を与えるような、独創的で感情豊かな楽曲テーマを1つだけ、短いフレーズで提案してください。ポップス、ロック、バラード、エレクトロなど、様々なジャンルを想定してください。`
    : `Please suggest a single creative, emotional, and inspiring song theme in a short phrase that gives people courage and hope for the future. Consider various genres such as pop, rock, ballad, and electronic music.`;

  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return response.text.trim().replace(/^"|"$/g, '');
};


export const generateLyrics = async (theme: string, language: 'ja' | 'en'): Promise<LyricsGenerationResult> => {
  if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = language === 'ja'
    ? `以下のテーマを基に、人々に勇気や感動、未来への希望を与えるような独創的な日本の楽曲を制作してください。
- 曲の長さは約3分程度を想定してください。
- 歌詞は2番までのフルコーラス（Verse 1, Pre-Chorus, Chorus, Verse 2, Pre-Chorus, Chorus, Bridge, Outroなど）で作成してください。
- 各セクション（Verse, Chorusなど）の間には、必ず1行の空行を入れてください。
- 音楽スタイルは、入力されたテーマの雰囲気や感情を最大限に表現できる、独創的で具体的なスタイルを提案してください。J-POPに限定せず、ロック、エレクトロ、アンビエント、オーケストラ、R&Bなど、幅広い選択肢から最適なものを選択してください。
- AIによる解説や前置きは一切含めず、指定されたJSON形式のデータのみを返してください。
テーマ: ${theme}`
    : `Based on the following theme, please create an original song that gives people courage, inspiration, and hope for the future.
- The song should be approximately 3 minutes long.
- The lyrics should be a full song with up to 2 verses (e.g., Verse 1, Pre-Chorus, Chorus, Bridge, Outro).
- Please insert a blank line between each section (e.g., Verse, Chorus).
- For the musical style, suggest a creative and specific style that can best express the mood and emotion of the theme. Do not limit to Pop, but select the most suitable one from a wide range of options such as rock, electro, ambient, orchestral, R&B, etc.
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
    ? `以下の日本語の歌詞と音楽スタイルを基に、ミュージックビデオの各シーンに対応する英語のプロンプトを生成してください。
# 重要事項
生成される「imagePrompt」と「animationPrompt」は、後続の画像生成APIおよびビデオ生成APIに直接入力として使用されます。これらのAPIは英語のプロンプトのみを受け付けます。そのため、以下の指示に厳密に従ってください。

# 指示
1.  **プロンプト言語**: 「imagePrompt」と「animationPrompt」の**値は、必ず全て英語で生成してください**。日本語やその他の言語が混入しないようにしてください。
2.  **画像プロンプト (imagePrompt)**: 
    -   歌詞の内容と音楽スタイルを解釈し、シーンに合った詳細なビジュアルを記述します。
    -   アートスタイル（例: photorealistic, anime, cinematic）、キャラクターの見た目や感情、背景、ライティングなどを具体的に含めてください。
3.  **アニメーションプロンプト (animationPrompt)**:
    -   歌詞の感情に合わせたキャラクターの動きや表情の変化を記述します。
    -   例: "singing passionately with eyes closed", "a single tear rolling down her cheek", "looking up at the sky with a hopeful expression"。
    -   簡潔かつ具体的な動詞を使って記述してください。
4.  **出力形式**: JSON配列形式で、解説や前置きなしで結果のみを返してください。各要素は、セクション名、imagePrompt、animationPromptを含むオブジェクトです。

# 入力
音楽スタイル: ${style}
歌詞:
${lyrics}`
    : `Based on the following lyrics and music style, generate corresponding English prompts for each scene of a music video.
# IMPORTANT
The generated "imagePrompt" and "animationPrompt" will be used as direct inputs for subsequent image and video generation APIs, which only accept English prompts. Please adhere strictly to the following instructions.

# Instructions
1.  **Prompt Language**: The values for "imagePrompt" and "animationPrompt" **must be generated entirely in English**.
2.  **Image Generation Prompt (imagePrompt)**:
    -   Interpret the lyrics and music style to describe a detailed visual for the scene.
    -   Include specifics like art style (e.g., photorealistic, anime, cinematic), character appearance and emotion, background, and lighting.
3.  **Animation Prompt (animationPrompt)**:
    -   Describe the character's movements and facial expression changes corresponding to the lyrics' emotion.
    -   Use concise and descriptive verbs. Examples: "singing passionately with eyes closed", "a single tear rolling down her cheek", "looking up at the sky with a hopeful expression".
4.  **Output Format**: Return only the results in a JSON array format without any commentary or introduction. Each element should be an object containing the section name, imagePrompt, and animationPrompt.

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
            animationPrompt: { type: Type.STRING, description: "Concise English prompt for animation." }
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
  }

  if (currentOperation.error) throw new Error(`Video generation failed: ${currentOperation.error.message}`);
  
  const downloadLink = currentOperation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Could not retrieve video download link.");
  
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
  
  let finalPrompt = prompt.trim();
  
  // Veo API requires a non-empty prompt. Provide a default if the generated one is empty.
  if (!finalPrompt) {
    finalPrompt = "subtle movement, gentle breathing, slight blinking";
  }

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