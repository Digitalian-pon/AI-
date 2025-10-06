
import { GoogleGenAI } from "@google/genai";

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
