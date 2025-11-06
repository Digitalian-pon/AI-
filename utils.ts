import { GoogleGenAI, Type } from '@google/genai';
import { Scene } from './types';

interface ParsedScene {
  lyric: string;
}

export interface ThemeSuggestion {
  theme: string;
  style: string;
}

const robustJsonParse = (jsonString: string) => {
  let cleanJsonString = jsonString.trim();
  if (cleanJsonString.startsWith('```json')) {
    cleanJsonString = cleanJsonString.substring(7, cleanJsonString.length - 3).trim();
  } else if (cleanJsonString.startsWith('```')) {
    cleanJsonString = cleanJsonString.substring(3, cleanJsonString.length - 3).trim();
  }
  return JSON.parse(cleanJsonString);
};

export const parseLyrics = (lyrics: string): ParsedScene[] => {
  return lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\[.*\]$/)) // Remove empty lines and headers like [Verse]
    .map(lyric => ({ lyric }));
};

export const generateTitleFromLyrics = async (ai: GoogleGenAI, lyrics: string, language: 'ja' | 'en'): Promise<string> => {
  const langInstruction = language === 'ja' ? 'Japanese' : 'English';
  const systemInstruction = `You are an expert at analyzing song lyrics. Your task is to read the provided lyrics and distill their core theme into a short, compelling song title. The title should be in ${langInstruction}. Respond with only the title text, without any extra formatting or quotation marks.`;
  const contents = `Based on these lyrics, what is a good song title?\n\nLyrics:\n${lyrics}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
      },
    });
    return response.text.trim().replace(/"/g, ''); // Clean up quotes
  } catch (error) {
    console.error("Error generating title from lyrics:", error);
    return language === 'ja' ? '無題のプロジェクト' : 'Untitled Project'; // Fallback title
  }
};

export const generateRandomThemeAndStyle = async (ai: GoogleGenAI, language: 'ja' | 'en'): Promise<ThemeSuggestion> => {
  const langInstruction = language === 'ja' ? 'Japanese' : 'English';
  const systemInstruction = `You are a creative muse for a songwriter. Your task is to brainstorm unique and inspiring song themes and matching musical styles for Suno AI, in ${langInstruction}. Avoid clichés and generic ideas. Think about unexpected combinations, deep emotions, and vivid stories.`;
  
  const contents = `Please generate three distinct and creative song themes in ${langInstruction}. For each theme, provide a detailed "Style of music" suitable for Suno AI. The style should include genre, mood, instrumentation, and tempo. The style description itself should also be in ${langInstruction}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              theme: {
                type: Type.STRING,
                description: 'A unique and creative song theme or title.',
              },
              style: {
                type: Type.STRING,
                description: 'A detailed "Style of music" for Suno AI, including genre, mood, and instrumentation.',
              },
            },
            required: ["theme", "style"],
          },
        },
      },
    });

    const suggestions: ThemeSuggestion[] = robustJsonParse(response.text);
    
    if (!suggestions || suggestions.length === 0) {
      throw new Error("Could not generate theme suggestions.");
    }
    
    // Return a random suggestion from the list to ensure variety
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  } catch (error) {
    console.error("Error generating random theme and style:", error);
    throw new Error("Failed to generate a theme. Please try again.");
  }
};


export const generateLyricsFromTheme = async (ai: GoogleGenAI, theme: string, language: 'ja' | 'en'): Promise<string> => {
  const langInstruction = language === 'ja' ? 'Japanese' : 'English';
  const systemInstruction = `You are a professional songwriter. Your task is to write lyrics in ${langInstruction} for a song based on a given theme. The lyrics should be structured with verses and a chorus. Do not include headers like [Verse], [Chorus], etc. Just provide the raw lyrics, with each line on a new line. The lyrics should be emotional, creative, and tell a story related to the theme.`;

  const contents = `Generate song lyrics for the theme: "${theme}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
      },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating lyrics from theme:", error);
    throw new Error("Failed to generate lyrics. Please try again.");
  }
};

export const generatePromptsForScenes = async (ai: GoogleGenAI, scenes: Pick<Scene, 'lyric' | 'lipSync'>[], title: string): Promise<string[]> => {
    const systemInstruction = `You are an expert music video director creating a video for a song with the title: "${title}". For each lyric object provided, create a short, vivid, and cinematic prompt in English for an AI video generation model.

- If 'lipSync' is true, the prompt MUST focus on an extreme close-up of a character's face, showing emotion and clearly singing the lyric. Describe the mouth shape and expression.
- If 'lipSync' is false, create a wider, more atmospheric cinematic shot that captures the feeling of the lyric without focusing on a singing face.
- Do not refer to the lyric itself in the prompt.

Example for lipSync: true
Lyric: "I'm walking on sunshine"
Prompt: "Extreme close-up on a joyful singer's face, bathed in golden sunlight, mouth open mid-song, eyes sparkling with happiness."

Example for lipSync: false
Lyric: "I'm walking on sunshine"
Prompt: "Wide shot of a figure walking through a field of sunflowers at sunrise, lens flare washing over the scene."

Provide only the list of prompts as a JSON array of strings.`;

  const sceneData = scenes.map(s => ({ lyric: s.lyric, lipSync: s.lipSync }));
  const contents = `Generate video prompts for the following lyric objects:\n\n${JSON.stringify(sceneData, null, 2)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
                description: "A cinematic prompt for the AI video generation model."
            }
        }
      },
    });

    const prompts = robustJsonParse(response.text);

    if (Array.isArray(prompts) && prompts.length === scenes.length) {
      return prompts;
    } else {
      console.warn("Mismatched prompt count, falling back to simple prompts.", { expected: scenes.length, got: prompts.length });
      return scenes.map(s => `A beautiful cinematic shot representing the lyric: "${s.lyric}"`);
    }
  } catch (error) {
    console.error("Error generating prompts from lyrics:", error);
    return scenes.map(s => `A cinematic video representing: ${s.lyric}`);
  }
};
