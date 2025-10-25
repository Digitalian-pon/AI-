import { VideoModel } from './services/geminiService';

export enum AppStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR,
}

export enum AppMode {
  SELECT,
  UPLOAD,
  GENERATE,
}

export enum GenerationStep {
  LYRICS,
  PRODUCTION,
}

export interface LyricsGenerationResult {
  title: string;
  style: string;
  lyrics: string;
}

export interface Scene {
  id: number;
  sectionHeader: string;
  sectionContent: string;
  imagePrompt: string;
  animationPrompt: string;
  status: 'idle' | 'image_generating' | 'video_generating' | 'completed' | 'error';
  errorMessage?: string;
  generatedImageBase64?: string;
  generatedVideoUrl?: string;
}
