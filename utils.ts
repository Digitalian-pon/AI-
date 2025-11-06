import { GoogleGenAI, Type } from '@google/genai';

interface ParsedScene {
  lyric: string;
}

export interface ThemeSuggestion {
  theme: string;
  style: string;
}

export const parseLyrics = (lyrics: string): ParsedScene[] => {
  return lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\[.*\]$/)) // Remove empty lines and headers like [Verse]
    .map(lyric => ({ lyric }));
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

    const jsonStr = response.text.trim();
    const suggestions: ThemeSuggestion[] = JSON.parse(jsonStr);
    
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

export const generatePromptsFromLyrics = async (ai: GoogleGenAI, lyrics: string[]): Promise<string[]> => {
  const systemInstruction = `You are an expert music video director. For each line of lyrics provided, create a short, vivid, and cinematic prompt for an AI video generation model. The prompt should be in English. Focus on visual storytelling, emotion, and dynamic imagery that complements the lyric. Do not refer to the lyric itself in the prompt. Describe a scene.

Example:
Lyric: "Chasing neon dreams through the city rain"
Prompt: "A lone figure in a glowing raincoat runs down a glistening, rain-slicked city street at night, surrounded by vibrant, blurry neon signs reflecting in the puddles."

Provide only the list of prompts as a JSON array of strings, like ["prompt 1", "prompt 2", ...].`;

  const contents = `Generate video prompts for the following lyrics:\n\n${lyrics.join('\n')}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text.trim();
    // Handle potential markdown code blocks
    const jsonStr = text.startsWith('```json') ? text.substring(7, text.length - 3).trim() : text;
    
    const prompts = JSON.parse(jsonStr);

    if (Array.isArray(prompts) && prompts.length === lyrics.length) {
      return prompts;
    } else {
      console.warn("Mismatched prompt count, falling back to simple prompts.");
      // Fallback for cases where the model doesn't return the expected structure
      return lyrics.map(lyric => `A beautiful cinematic shot representing the lyric: "${lyric}"`);
    }
  } catch (error) {
    console.error("Error generating prompts from lyrics:", error);
    // Fallback to simple prompts if API fails or JSON parsing fails
    return lyrics.map(lyric => `A cinematic video representing: ${lyric}`);
  }
};