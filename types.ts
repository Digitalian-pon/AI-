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
  MUSIC,
  IMAGE,
  ANIMATION,
}

export interface LyricsGenerationResult {
  title: string;
  style: string;
  lyrics: string;
}
