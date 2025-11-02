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

export const generateTheme = async (options: { language: 'ja' | 'en', category: string, keywords?: string }, apiKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  let prompt: string;
  const baseInstructionJa = "あなたはプロの作詞家です。自己紹介や前置きは一切せず、提案するテーマのフレーズのみを返してください。";
  const baseInstructionEn = "You are a professional lyricist. Do not include any self-introduction or preamble. Return only the theme phrase.";

  if (options.keywords) {
    prompt = options.language === 'ja'
      ? `以下のキーワードを基に、独創的で想像力を掻き立てる楽曲のテーマを1つ、短いフレーズで提案してください。ありきたりな表現は避け、具体的でユニークなアイデアを重視してください。\nキーワード: ${options.keywords}\n${baseInstructionJa}`
      : `Based on the following keywords, please suggest a single creative and imaginative song theme in a short phrase. Avoid clichés and focus on specific and unique ideas.\nKeywords: ${options.keywords}\n${baseInstructionEn}`;
  } else {
    switch (options.category) {
      case 'emotional':
        prompt = options.language === 'ja'
          ? `世界中の人々の心を揺さぶり、国境や文化を越えて共感を呼ぶような、深遠で感動的な楽曲テーマを1つ、短いフレーズで提案してください。個人的な喪失の乗り越え、人類愛、世代を超えた繋がり、逆境の中の希望など、普遍的な人間の経験に焦点を当ててください。\n${baseInstructionJa}`
          : `Suggest one profound and moving song theme in a short phrase that can stir the hearts of people worldwide and evoke empathy across borders and cultures. Focus on universal human experiences such as overcoming personal loss, humanitarian love, intergenerational connections, or hope in the face of adversity.\n${baseInstructionEn}`;
        break;
      case 'trending':
        prompt = options.language === 'ja'
          ? `現在のSNS（TikTok, Instagram, YouTubeなど）でバイラルヒットを狙えるような、キャッチーで共感性の高い楽曲テーマを1つ、短いフレーズで提案してください。短い動画で使いやすく、多くの人が「自分のことだ」と感じるような、現代的な悩み、あるあるネタ、意外な視点などを盛り込んでください。\n${baseInstructionJa}`
          : `Suggest one catchy and highly relatable song theme in a short phrase that could become a viral hit on current social media (TikTok, Instagram, YouTube, etc.). It should be suitable for short-form videos and tap into modern-day struggles, relatable situations, or surprising perspectives that would make many people feel "this is about me."\n${baseInstructionEn}`;
        break;
      case 'love':
        prompt = options.language === 'ja'
          ? `ありきたりではない、具体的で心に刺さるような「恋愛」または「失恋」の楽曲テーマを1つ、短いフレーズで提案してください。「会いたい」「好き」のような直接的な言葉を使わずに、情景や比喩、独特の感情表現で、関係の美しさ、複雑さ、または終わりの切なさを描いてください。\n${baseInstructionJa}`
          : `Suggest one non-clichéd, specific, and poignant song theme about "love" or "heartbreak" in a short phrase. Instead of direct words like "I miss you" or "I love you," depict the beauty, complexity, or sorrow of a relationship's end through scenery, metaphors, or unique emotional expressions.\n${baseInstructionEn}`;
        break;
      case 'random':
      default:
        prompt = options.language === 'ja'
          ? `独創的で想像力を掻き立てる楽曲のテーマを1つだけ、短いフレーズで提案してください。喜び、悲しみ、愛、喪失、冒険、日常の発見、SF的な空想など、幅広い感情やジャンルを網羅するように、毎回全く異なる視点から生成してください。ありきたりな表現は避け、具体的でユニークなアイデアを重視してください。\n${baseInstructionJa}`
          : `Please suggest a single creative and imaginative song theme in a short phrase. The theme should be generated from a completely different perspective each time, covering a wide range of emotions and genres such as joy, sadness, love, loss, adventure, everyday discoveries, and sci-fi fantasies. Avoid clichés and focus on specific and unique ideas.\n${baseInstructionEn}`;
        break;
    }
  }

  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return response.text.trim().replace(/^"|"$/g, '');
};


export const generateLyrics = async (theme: string, language: 'ja' | 'en', apiKey: string): Promise<LyricsGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = language === 'ja'
    ? `あなたはプロの作詞家です。
以下のテーマを基に、人々に勇気や感動、未来への希望を与えるような独創的な日本の楽曲を制作してください。

# 指示
- 曲の長さは約3分程度を想定してください。
- 歌詞は2番までのフルコーラス（Verse 1, Pre-Chorus, Chorus, Verse 2, Pre-Chorus, Chorus, Bridge, Outroなど）で作成してください。
- 各セクション（Verse, Chorusなど）の間には、必ず1行の空行を入れてください。
- 音楽スタイルは、入力されたテーマの雰囲気や感情を最大限に表現できる、独創的で具体的なスタイルを提案してください。J-POPに限定せず、ロック、エレクトロ、アンビエント、オーケストラ、R&Bなど、幅広い選択肢から最適なものを選択してください。
- AIによる解説や前置きは一切含めず、指定されたJSON形式のデータのみを返してください。

# テーマ
${theme}`
    : `You are a professional lyricist.
Based on the following theme, please create an original song that gives people courage, inspiration, and hope for the future.

# Instructions
- The song should be approximately 3 minutes long.
- The lyrics should be a full song with up to 2 verses (e.g., Verse 1, Pre-Chorus, Chorus, Bridge, Outro).
- Please insert a blank line between each section (e.g., Verse, Chorus).
- For the musical style, suggest a creative and specific style that can best express the mood and emotion of the theme. Do not limit to Pop, but select the most suitable one from a wide range of options such as rock, electro, ambient, orchestral, R&B, etc.
- Do not include any commentary or introduction. Only return the data in the specified JSON format.

# Theme
${theme}`;

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

export interface ScenePromptGenerationResult {
  section: string;
  imagePrompt: string;
  animationPrompt: string;
}

export const translateText = async (text: string, targetLanguage: 'ja' | 'en', apiKey: string): Promise<string> => {
  if (!text.trim()) return "";
  const ai = new GoogleGenAI({ apiKey });
  
  const languageName = targetLanguage === 'ja' ? 'Japanese' : 'English';
  const prompt = `Translate the following text to ${languageName}. Output only the translated text, without any additional explanations or formatting.\n\nText to translate:\n"""\n${text}\n"""`;

  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return response.text.trim();
};

export const generateAnimationPromptFromImage = async (imageBase64: string, mimeType: string, apiKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: `Analyze this image for a music video. Suggest a short, simple, and beautiful animation prompt in English. The animation should be subtle and artistic. Focus on small movements like breathing, blinking, hair moving in the wind, or subtle emotional expressions. Also consider background elements like sparkling lights or shifting clouds. The prompt should be a comma-separated list of actions. Example: "gentle breeze blowing through her hair, subtle smile, sparkling lights in the background". Output only the prompt text, nothing else.`
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
  });

  return response.text.trim();
};

export const suggestAnimationPromptForScene = async (
  sceneHeader: string,
  sceneContent: string,
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: `Based on the provided image and the following song lyrics, suggest a short, simple, and artistic animation prompt in English. The animation should be subtle and beautiful. Focus on small movements, emotional expressions, or camera work that match the mood of the lyrics. The prompt should be a comma-separated list of actions.

    Lyrics Section: "${sceneHeader}"
    Lyrics Content:
    ---
    ${sceneContent || '(No content, interpret from header)'}
    ---

    Example output: "gentle breeze blowing, a subtle, sad smile, slow zoom in".
    
    Output only the prompt text, nothing else.`
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
  });

  return response.text.trim();
};


export const generateScenePrompts = async (lyrics: string, style: string, language: 'ja' | 'en', apiKey: string): Promise<ScenePromptGenerationResult[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = language === 'ja'
    ? `あなたはプロの映像監督です。
以下の日本語の歌詞と音楽スタイルを基に、ミュージックビデオの各シーンに対応する英語のプロンプトを生成してください。

# 重要事項
生成される「imagePrompt」と「animationPrompt」は、後続の画像生成APIおよびビデオ生成APIに直接入力として使用されます。これらのAPIは英語のプロンプトのみを受け付けます。そのため、以下の指示に厳密に従ってください。

# 指示
1.  **プロンプト言語**: 「imagePrompt」と「animationPrompt」の**値は、必ず全て英語で生成してください**。日本語やその他の言語が混入しないようにしてください。
2.  **画像プロンプト (imagePrompt)**: 
    -   歌詞の内容と音楽スタイルを解釈し、シーンに合った詳細なビジュアルを記述します。
    -   アートスタイル（例: photorealistic, anime, cinematic, fantasy art）、キャラクターの見た目や感情、背景、ライティングなどを具体的に含めてください。
3.  **アニメーションプロンプト (animationPrompt)**:
    -   歌詞の感情に合わせたキャラクターの動きや表情の変化を、簡潔な英語で記述します。
    -   例: "singing passionately with eyes closed", "a single tear rolling down her cheek", "looking up at the sky with a hopeful expression"。
    -   簡潔かつ具体的な動詞を使って記述してください。
4.  **出力形式**: JSON配列形式で、解説や前置きなしで結果のみを返してください。各要素は、セクション名、imagePrompt、animationPromptを含むオブジェクトです。

# 入力
音楽スタイル: ${style}
歌詞:
${lyrics}`
    : `You are a professional video director.
Based on the following lyrics and music style, generate corresponding English prompts for each scene of a music video.

# IMPORTANT
The generated "imagePrompt" and "animationPrompt" will be used as direct inputs for subsequent image and video generation APIs, which only accept English prompts. Please adhere strictly to the following instructions.

# Instructions
1.  **Prompt Language**: The values for "imagePrompt" and "animationPrompt" **must be generated entirely in English**.
2.  **Image Generation Prompt (imagePrompt)**:
    -   Interpret the lyrics and music style to describe a detailed visual for the scene.
    -   Include specifics like art style (e.g., photorealistic, anime, cinematic, fantasy art), character appearance and emotion, background, and lighting.
3.  **Animation Prompt (animationPrompt)**:
    -   Describe the character's movements and facial expression changes corresponding to the lyrics' emotion in concise English.
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

export const generateSceneAnimationPrompts = async (lyrics: string, language: 'ja' | 'en', apiKey: string): Promise<Pick<ScenePromptGenerationResult, 'section' | 'animationPrompt'>[]> => {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = language === 'ja'
    ? `あなたはプロの映像監督です。
以下の日本語の歌詞を基に、ミュージックビデオの各シーンに対応する「アニメーション」の指示を簡潔な英語で生成してください。

# 指示
1.  **プロンプト言語**: 「animationPrompt」の値は、必ず全て英語で生成してください。
2.  **アニメーションプロンプト (animationPrompt)**:
    -   歌詞の感情に合わせたキャラクターの動きや表情の変化、カメラワークなどを記述します。
    -   例: "singing passionately with eyes closed", "slow zoom in on her face", "looking up at the sky with a hopeful expression"。
    -   簡潔かつ具体的な動詞を使って記述してください。
3.  **出力形式**: JSON配列形式で、解説や前置きなしで結果のみを返してください。各要素は、歌詞のセクション名とanimationPromptを含むオブジェクトです。

# 歌詞:
${lyrics}`
    : `You are a professional video director.
Based on the following lyrics, generate a concise English "animation" prompt for each scene of a music video.

# Instructions
1.  **Prompt Language**: The value for "animationPrompt" must be generated entirely in English.
2.  **Animation Prompt (animationPrompt)**:
    -   Describe the character's movements, facial expressions, and camera work corresponding to the lyrics' emotion.
    -   Use concise and descriptive verbs. Examples: "singing passionately with eyes closed", "slow zoom in on her face", "looking up at the sky with a hopeful expression".
3.  **Output Format**: Return only the results in a JSON array format without any commentary or introduction. Each element should be an object containing the lyric section name and the animationPrompt.

# Lyrics:
${lyrics}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            section: { type: Type.STRING, description: "The lyric section header (e.g., Verse 1, Chorus)" },
            animationPrompt: { type: Type.STRING, description: "Concise English prompt for animation." }
          },
          required: ["section", "animationPrompt"]
        }
      }
    }
  });
  const jsonString = response.text.trim();
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini for scene animation prompts:", jsonString);
    throw new Error("シーンプロンプトの解析に失敗しました。");
  }
};


export const generateBatchAnimationPrompts = async (imageBase64: string, mimeType: string, numScenes: number, apiKey: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey });
  
  const imagePart = { inlineData: { data: imageBase64, mimeType } };
  const textPart = { text: `Analyze this image. Suggest ${numScenes} distinct but thematically related short animation prompts for a music video. Create a simple narrative arc or emotional progression across the prompts. The prompts should be concise, in English, and focus on subtle movements, emotions, or camera work. Examples: "gentle breathing, eyes closed", "eyes slowly open", "a faint, hopeful smile appears", "looking towards a distant light", "subtle zoom in". Return ONLY a JSON array of strings.` };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  
  const jsonString = response.text.trim();
  try {
    const prompts = JSON.parse(jsonString);
    // Ensure the array has the correct length
    if (Array.isArray(prompts) && prompts.length > numScenes) {
      return prompts.slice(0, numScenes);
    }
    return prompts;
  } catch (e) {
    console.error("Failed to parse JSON from Gemini for batch prompts:", jsonString);
    throw new Error("プロンプトの一括生成に失敗しました。");
  }
};


export const generateImage = async (prompt: string, apiKey: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
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

const pollForVideoResult = async (operation: any, apiKey: string): Promise<string> => {
  let currentOperation = operation;
  while (!currentOperation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    const ai = new GoogleGenAI({ apiKey });
    currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
  }

  if (currentOperation.error) throw new Error(`Video generation failed: ${currentOperation.error.message}`);
  
  const downloadLink = currentOperation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Could not retrieve video download link.");
  
  const fullUrl = `${downloadLink}&key=${apiKey}`;
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
  apiKey: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  
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

  return await pollForVideoResult(operation, apiKey);
};