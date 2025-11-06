export interface Scene {
  id: number;
  lyric: string;
  prompt: string;
  image: File;
  videoUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  lipSync: boolean;
}
