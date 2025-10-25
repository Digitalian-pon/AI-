
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppStatus, AppMode, GenerationStep, Scene } from './types';
import { generateAnimationVideo, fileToBase64, generateLyrics, generateTheme, generateImage, generateScenePrompts } from './services/geminiService';
import { VideoModel } from './services/geminiService';
import { parseLyrics } from './utils';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import LyricsDisplay from './components/LyricsDisplay';
import { SparklesIcon, AlertTriangleIcon, Wand2Icon, MusicIcon, FileImageIcon, FilmIcon, UploadCloudIcon, ClipboardCopyIcon, ExternalLinkIcon, KeyRoundIcon, ListVideoIcon, RotateCcwIcon, ClockIcon, StopCircleIcon, SettingsIcon, XIcon } from './components/Icons';

const cameraWorkOptions = {
  '': 'なし', 'slow zoom in': 'ズームイン', 'slow zoom out': 'ズームアウト',
  'pan from left to right': 'パン（左から右へ）', 'pan from right to left': 'パン（右から左へ）',
  'slow rotation clockwise': 'ゆっくりと回転',
};
const effectOptions = { 'sparkling lights': 'キラキラ光る', 'neon glow': 'ネオン', 'confetti falling': '紙吹雪', 'petals blowing in the wind': '風に舞う花びら' };

// This script contains the entire logic for our background worker.
const workerScript = `
// In-worker script starts here
// IMPORTANT: This script runs in a separate context (a Web Worker).
// It cannot access variables or functions from the main App component directly.
// Communication happens through postMessage.

// The import path is taken from the main app's import map.
// This works because we create the worker with { type: 'module' }.
import { GoogleGenAI } from "https://aistudiocdn.com/@google/genai@^1.22.0";

// --- START: Duplicated types and functions from the main app ---
// We duplicate these here so the worker is self-contained.

let ai; // AI instance will be created when API key is received.

const pollForVideoResult = async (operation, apiKey) => {
  let currentOperation = operation;
  while (!currentOperation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    const pollAi = new GoogleGenAI({ apiKey });
    currentOperation = await pollAi.operations.getVideosOperation({ operation: currentOperation });
  }

  if (currentOperation.error) throw new Error(\`Video generation failed: \${currentOperation.error.message}\`);
  
  const downloadLink = currentOperation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Could not retrieve video download link.");
  
  const fullUrl = \`\${downloadLink}&key=\${apiKey}\`;
  const videoResponse = await fetch(fullUrl);
  if (!videoResponse.ok) throw new Error(\`Failed to fetch video data: \${videoResponse.statusText}\`);
  
  const videoBlob = await videoResponse.blob();
  return URL.createObjectURL(videoBlob);
};

const generateImage = async (prompt, apiKey) => {
    if (!apiKey) throw new Error("API_KEY not provided to worker.");
    ai = ai || new GoogleGenAI({ apiKey });
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

const generateAnimationVideo = async (prompt, imageBase64, imageMimeType, modelName, lipSync, apiKey) => {
  if (!apiKey) throw new Error("API_KEY not provided to worker.");
  ai = ai || new GoogleGenAI({ apiKey });
  
  let finalPrompt = prompt.trim();
  if (!finalPrompt) {
    finalPrompt = "subtle movement, gentle breathing, slight blinking";
  }

  if (lipSync) {
    finalPrompt = \`\${finalPrompt}, The character is performing a song with passionate and expressive lip movements. The mouth shapes should realistically match the act of singing, with clear vowels and consonant articulations.\`;
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

const getFriendlyErrorMessage = (err) => {
    const message = err instanceof Error ? err.message.toLowerCase() : 'unknown error';
    if (message.includes('500') || message.includes('internal') || message.includes('server error')) {
      return 'ビデオ生成サービスで一時的な内部エラーが発生しました。しばらくしてからもう一度お試しいただくか、プロンプトを少し変更してみてください。';
    }
    if (message.includes('requested entity was not found')) return 'APIキーが見つかりませんでした。再度APIキーを選択してください。';
    if (message.includes('quota') || message.includes('resource_exhausted')) return 'APIの利用上限に達したようです。Google AI Studioで支払い設定を確認してください。';
    if (message.includes('api_key') && (message.includes('invalid') || message.includes('not found'))) return 'APIキーが無効です。有効なAPIキーか確認してください。';
    if (message.includes('fetch')) return 'ネットワークエラーが発生しました。接続を確認してください。';
    return err instanceof Error ? err.message : '不明なエラーが発生しました。';
};
// --- END: Duplicated types and functions ---

let isAborted = false;

// Main message handler for the worker
self.onmessage = async (event) => {
  const { type, payload } = event.data;
  
  if (type === 'stop') {
    isAborted = true;
    return;
  }

  if (type === 'generate-one') {
    const { scene, apiKey, videoModel, lipSync } = payload;
    try {
        self.postMessage({ type: 'image_generating', payload: { sceneId: scene.id } });
        const imageBase64 = await generateImage(scene.imagePrompt, apiKey);

        self.postMessage({ type: 'video_generating', payload: { sceneId: scene.id, imageBase64 } });
        const videoUrl = await generateAnimationVideo(scene.animationPrompt, imageBase64, 'image/png', videoModel, lipSync, apiKey);
        
        self.postMessage({ type: 'completed', payload: { sceneId: scene.id, videoUrl } });
    } catch(err) {
        const message = getFriendlyErrorMessage(err);
        self.postMessage({ type: 'error', payload: { sceneId: scene.id, message } });
    }
  }

  if (type === 'generate-all') {
    isAborted = false;
    const { scenes, apiKey, videoModel, lipSync, delay } = payload;
    
    for (const [index, scene] of scenes.entries()) {
      if (isAborted) {
        self.postMessage({ type: 'stopped' });
        break;
      }
      
      self.postMessage({ type: 'progress', payload: { message: \`クリップ \${index + 1} / \${scenes.length} を生成中: 「\${scene.sectionHeader}」\` } });
      
      try {
        self.postMessage({ type: 'image_generating', payload: { sceneId: scene.id } });
        const imageBase64 = await generateImage(scene.imagePrompt, apiKey);

        if (isAborted) { self.postMessage({ type: 'stopped' }); break; }

        self.postMessage({ type: 'video_generating', payload: { sceneId: scene.id, imageBase64 } });
        const videoUrl = await generateAnimationVideo(scene.animationPrompt, imageBase64, 'image/png', videoModel, lipSync, apiKey);
        
        if (isAborted) { self.postMessage({ type: 'stopped' }); break; }

        self.postMessage({ type: 'completed', payload: { sceneId: scene.id, videoUrl } });
      } catch (err) {
        const message = getFriendlyErrorMessage(err);
        self.postMessage({ type: 'error', payload: { sceneId: scene.id, message } });
      }
      
      // Handle delay between generations
      if (index < scenes.length - 1 && !isAborted) {
        self.postMessage({ type: 'progress', payload: { message: '次の生成まで待機中...' } });
        const delayInSeconds = delay * 60;
        for (let i = delayInSeconds; i > 0; i--) {
          if (isAborted) break;
          self.postMessage({ type: 'countdown', payload: { seconds: i } });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (isAborted) {
          self.postMessage({ type: 'stopped' });
          break;
        }
        self.postMessage({ type: 'countdown', payload: { seconds: 0 } });
      }
    }

    if (!isAborted) {
      self.postMessage({ type: 'all_complete' });
    }
  }
};
`;

// SceneEditorCard component moved outside of the App component to prevent re-creation on every render.
const SceneEditorCard: React.FC<{
  scene: Scene;
  isGeneratingClips: boolean;
  onGenerateClip: (sceneId: number) => void;
  onUpdateScene: (id: number, updates: Partial<Scene>) => void;
}> = ({ scene, isGeneratingClips, onGenerateClip, onUpdateScene }) => {
  const onGenerate = () => onGenerateClip(scene.id);
  const thumbnail = scene.generatedImageBase64 ? `data:image/png;base64,${scene.generatedImageBase64}` : null;
  
  const isGenerating = ['image_generating', 'video_generating'].includes(scene.status);
  const isDisabled = isGeneratingClips || isGenerating;

  const renderStatusAndAction = () => {
    switch (scene.status) {
      case 'idle':
        return <button onClick={onGenerate} disabled={isDisabled} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-purple-600 rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"><SparklesIcon className="w-4 h-4" /> 生成</button>;
      case 'image_generating':
      case 'video_generating':
        return <div className="flex items-center gap-2 text-sm font-medium text-purple-300 px-3 py-1.5"><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div><span>{scene.status === 'image_generating' ? '画像生成中' : 'ビデオ生成中'}</span></div>;
      case 'completed':
        return <button onClick={onGenerate} disabled={isDisabled} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"><RotateCcwIcon className="w-4 h-4" /> 再生成</button>;
      case 'error':
        return <button onClick={onGenerate} disabled={isDisabled} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"><RotateCcwIcon className="w-4 h-4" /> 再試行</button>;
    }
  };

  return (
    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-grow">
            <h4 className="font-bold text-purple-300">{scene.sectionHeader}</h4>
            <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{scene.sectionContent}</p>
        </div>
        <div className="flex-shrink-0">{renderStatusAndAction()}</div>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch gap-4">
          <div className="w-full sm:w-32 h-20 bg-black/50 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-600">
            {scene.status === 'completed' && scene.generatedVideoUrl ? (
              <video src={scene.generatedVideoUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
            ) : thumbnail ? (
              <img src={thumbnail} alt="Generated scene" className="w-full h-full object-cover" />
            ) : (
              <FileImageIcon className="w-8 h-8 text-gray-500" />
            )}
          </div>
          <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">画像プロンプト (英語)</label>
                <textarea value={scene.imagePrompt} onChange={(e) => onUpdateScene(scene.id, { imagePrompt: e.target.value })} rows={4} disabled={isDisabled} className="w-full text-sm bg-gray-800 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-700" />
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">アニメーションプロンプト</label>
                <textarea value={scene.animationPrompt} onChange={(e) => onUpdateScene(scene.id, { animationPrompt: e.target.value })} rows={4} disabled={isDisabled} className="w-full text-sm bg-gray-800 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-700" />
            </div>
          </div>
      </div>
      {scene.status === 'error' && <p className="text-xs text-red-400 -mt-2" title={scene.errorMessage}><span className="font-semibold">エラー:</span> {scene.errorMessage}</p>}
    </div>
  );
};

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<AppMode>(AppMode.SELECT);
  const [isKeySelected, setIsKeySelected] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [motionPrompt, setMotionPrompt] = useState<string>('');
  const [cameraWork, setCameraWork] = useState<string>('');
  const [effects, setEffects] = useState<string[]>([]);
  const [lipSync, setLipSync] = useState<boolean>(true);
  const [videoModel, setVideoModel] = useState<VideoModel>('veo-3.1-fast-generate-preview');

  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [audioObjectUrl, setAudioObjectUrl] = useState<string>('');
  
  const [step, setStep] = useState<GenerationStep>(GenerationStep.LYRICS);
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [lyricTheme, setLyricTheme] = useState<string>('');
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [generatedMusicStyle, setGeneratedMusicStyle] = useState<string>('');
  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState<boolean>(false);
  
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isGeneratingClips, setIsGeneratingClips] = useState(false);
  const [generationDelay, setGenerationDelay] = useState<number>(1); // in minutes
  const [countdown, setCountdown] = useState<number>(0);
  const [generationStatusMessage, setGenerationStatusMessage] = useState('');
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize the worker
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl, { type: 'module' });
    workerRef.current = worker;

    // Message handler from worker
    worker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data;

        switch (type) {
            case 'image_generating':
                updateScene(payload.sceneId, { status: 'image_generating' });
                break;
            case 'video_generating':
                updateScene(payload.sceneId, { generatedImageBase64: payload.imageBase64, status: 'video_generating' });
                break;
            case 'completed':
                updateScene(payload.sceneId, { generatedVideoUrl: payload.videoUrl, status: 'completed' });
                break;
            case 'error':
                updateScene(payload.sceneId, { status: 'error', errorMessage: payload.message });
                if (payload.message && payload.message.includes('APIキー')) {
                    setIsKeySelected(false);
                }
                break;
            case 'progress':
                setGenerationStatusMessage(payload.message);
                break;
            case 'countdown':
                setCountdown(payload.seconds);
                if (payload.seconds > 0) {
                    setGenerationStatusMessage('次の生成まで待機中...');
                }
                break;
            case 'all_complete':
                setIsGeneratingClips(false);
                setGenerationStatusMessage('すべてのクリップが生成されました！');
                setCountdown(0);
                break;
            case 'stopped':
                setIsGeneratingClips(false);
                setGenerationStatusMessage('生成が中止されました。');
                setCountdown(0);
                setScenes(prev => prev.map(s =>
                    ['image_generating', 'video_generating'].includes(s.status)
                    ? { ...s, status: 'idle' }
                    : s
                ));
                break;
        }
    };

    // Cleanup on component unmount
    return () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
    };
  }, []); // Empty array ensures this runs only once on mount

  useEffect(() => {
    const checkApiKey = async () => {
      for (let i = 0; i < 5; i++) {
        if (window.aistudio?.hasSelectedApiKey) {
          setIsKeySelected(await window.aistudio.hasSelectedApiKey());
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      setIsKeySelected(false); 
      console.warn("Could not find window.aistudio.hasSelectedApiKey.");
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    if (isGeneratingClips || scenes.length === 0 || status === AppStatus.SUCCESS) return;

    const allCompleted = scenes.every(s => s.status === 'completed');
    if (allCompleted) {
        if (audioFile) setAudioObjectUrl(URL.createObjectURL(audioFile));
        setStatus(AppStatus.SUCCESS);
    }
  }, [scenes, isGeneratingClips, audioFile, status]);

  const getFriendlyErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message.toLowerCase() : 'unknown error';
    if (message.includes('500') || message.includes('internal') || message.includes('server error')) {
      return 'ビデオ生成サービスで一時的な内部エラーが発生しました。しばらくしてからもう一度お試しいただくか、プロンプトを少し変更してみてください。';
    }
    if (message.includes('requested entity was not found')) return 'APIキーが見つかりませんでした。再度APIキーを選択してください。';
    if (message.includes('quota') || message.includes('resource_exhausted')) return 'APIの利用上限に達したようです。Google AI Studioで支払い設定を確認してください。';
    if (message.includes('api_key') && (message.includes('invalid') || message.includes('not found'))) return 'APIキーが無効です。有効なAPIキーか確認してください。';
    if (message.includes('fetch')) return 'ネットワークエラーが発生しました。接続を確認してください。';
    return err instanceof Error ? err.message : '不明なエラーが発生しました。';
  };
  
  const updateScene = (id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(scene => scene.id === id ? { ...scene, ...updates } : scene));
  };

  const handleGenerateVideo = useCallback(async () => {
    if (!imageFile || !motionPrompt) {
      setError('画像とアニメーションの指示が必要です。');
      return;
    }
    setStatus(AppStatus.LOADING);
    setError('');
    try {
      const promptParts = [motionPrompt, cameraWork, ...effects].filter(Boolean);
      const imageBase64 = await fileToBase64(imageFile);
      const videoUrl = await generateAnimationVideo(promptParts.join(', '), imageBase64, imageFile.type, videoModel, lipSync);
      setGeneratedVideoUrl(videoUrl);
      if (audioFile) setAudioObjectUrl(URL.createObjectURL(audioFile));
      setStatus(AppStatus.SUCCESS);
    } catch (err) {
      console.error(err);
      const friendlyError = getFriendlyErrorMessage(err);
      if (friendlyError.includes('APIキー')) setIsKeySelected(false);
      setError(friendlyError);
      setStatus(AppStatus.ERROR);
    }
  }, [imageFile, motionPrompt, audioFile, lipSync, cameraWork, effects, videoModel]);

  const handleGenerateTheme = async () => {
    setIsGeneratingTheme(true);
    setError('');
    try {
      setLyricTheme(await generateTheme(language));
    } catch (err) { setError(getFriendlyErrorMessage(err)); } 
    finally { setIsGeneratingTheme(false); }
  };

  const handleGenerateScenePrompts = async (lyrics: string, style: string) => {
    setIsGeneratingPrompts(true);
    setScenes([]); // Clear previous scenes
    setError('');
    try {
      const parsed = parseLyrics(lyrics);
      const prompts = await generateScenePrompts(lyrics, style, language);
      
      const availablePrompts = [...prompts]; // Create a mutable copy to avoid reusing prompts

      const sceneData: Scene[] = parsed.map((section, index) => {
        const cleanedHeader = section.header.toLowerCase().replace(/[\[\]():]/g, '').trim();
        
        // Find the best match from available prompts
        const bestMatchIndex = availablePrompts.findIndex(p => {
          const cleanedApiSection = p.section.toLowerCase().replace(/[\[\]():]/g, '').trim();
          // Prioritize exact match, then partial match in either direction
          return cleanedHeader === cleanedApiSection || cleanedHeader.includes(cleanedApiSection) || cleanedApiSection.includes(cleanedHeader);
        });

        let promptData;
        if (bestMatchIndex !== -1) {
          // If a match is found, use it and remove it from the available prompts
          promptData = availablePrompts.splice(bestMatchIndex, 1)[0];
        }

        return {
          id: index,
          sectionHeader: section.header,
          sectionContent: section.content,
          imagePrompt: promptData?.imagePrompt || '',
          animationPrompt: promptData?.animationPrompt || '',
          status: 'idle',
        }
      });
      setScenes(sceneData);
    } catch (err) {
        setError(getFriendlyErrorMessage(err));
    } finally {
        setIsGeneratingPrompts(false);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!lyricTheme) return;
    setIsGeneratingLyrics(true);
    setError('');
    try {
      const { title, style, lyrics } = await generateLyrics(lyricTheme, language);
      setGeneratedTitle(title);
      setGeneratedMusicStyle(style);
      setGeneratedLyrics(lyrics);
      setStep(GenerationStep.PRODUCTION);
      handleGenerateScenePrompts(lyrics, style);
    } catch (err) { setError(getFriendlyErrorMessage(err)); } 
    finally { setIsGeneratingLyrics(false); }
  };

  const handleGenerateSingleClip = (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !workerRef.current) return;

    updateScene(scene.id, { errorMessage: undefined });
    setGenerationStatusMessage(`「${scene.sectionHeader}」の生成を開始...`);
    updateScene(scene.id, { status: 'image_generating' });
    
    workerRef.current.postMessage({
        type: 'generate-one',
        payload: {
            scene,
            apiKey: process.env.API_KEY, // The main thread has access to this
            videoModel,
            lipSync
        }
    });
  };
  
  const handleStopGeneration = () => {
    if (workerRef.current) {
        workerRef.current.postMessage({ type: 'stop' });
    }
    setGenerationStatusMessage('生成を中止しています...');
  };
  
  const handleGenerateAllClips = () => {
    const scenesToGenerate = scenes.filter(s => s.status === 'idle' || s.status === 'error');
    if (scenesToGenerate.length === 0 || !workerRef.current) return;
    
    setIsGeneratingClips(true);
    setError('');
    setGenerationStatusMessage('');

    workerRef.current.postMessage({
        type: 'generate-all',
        payload: {
            scenes: scenesToGenerate,
            apiKey: process.env.API_KEY,
            videoModel,
            lipSync,
            delay: generationDelay,
        }
    });
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setError('');
    setMode(AppMode.SELECT);
    setAudioFile(null);
    setImageFile(null);
    setMotionPrompt('');
    setCameraWork('');
    setEffects([]);
    setLipSync(true);
    setVideoModel('veo-3.1-fast-generate-preview');
    setGeneratedVideoUrl('');
    setAudioObjectUrl('');
    setStep(GenerationStep.LYRICS);
    setLanguage('ja');
    setLyricTheme('');
    setGeneratedLyrics('');
    setGeneratedTitle('');
    setGeneratedMusicStyle('');
    setScenes([]);
    setIsGeneratingClips(false);
    setIsGeneratingPrompts(false);

    if (generatedVideoUrl) URL.revokeObjectURL(generatedVideoUrl);
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    scenes.forEach(s => s.generatedVideoUrl && URL.revokeObjectURL(s.generatedVideoUrl));

    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) setIsKeySelected(await window.aistudio.hasSelectedApiKey());
    };
    checkApiKey();
  };

  const handleEffectChange = (effect: string) => {
    setEffects(prev => prev.includes(effect) ? prev.filter(e => e !== effect) : [...prev, effect]);
  };
  
  const renderContent = () => {
    if (!isKeySelected) return <SelectApiKeyScreen />;
    if (status === AppStatus.LOADING) return <Loader />;
    
    if (status === AppStatus.SUCCESS) {
        if(mode === AppMode.GENERATE) {
            return <VideoResult scenes={scenes} audioUrl={audioObjectUrl} onReset={handleReset} generatedTitle={generatedTitle} />;
        }
        if(generatedVideoUrl) return <VideoResult scenes={[]} videoUrls={[generatedVideoUrl]} audioUrl={audioObjectUrl} onReset={handleReset} generatedTitle="Generated Video" />;
    }

    switch (mode) {
      case AppMode.SELECT: return <ModeSelectionScreen onSelectMode={setMode} />;
      case AppMode.UPLOAD: return <UploadFlow />;
      case AppMode.GENERATE: return <GenerateFlow />;
      default: return <ModeSelectionScreen onSelectMode={setMode} />;
    }
  };
  
  const SelectApiKeyScreen = () => (
    <div className="text-center py-10">
      <KeyRoundIcon className="h-16 w-16 mx-auto text-purple-400 mb-6" />
      <h2 className="text-2xl font-bold mb-3">APIキーを選択してください</h2>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">ビデオ生成機能を利用するには、Google AI StudioのAPIキーを選択する必要があります。</p>
      <button
        onClick={async () => {
          try {
            await window.aistudio.openSelectKey();
            setIsKeySelected(true);
          } catch (e) { setError("APIキー選択ダイアログを開けませんでした。"); }
        }}
        className="w-full max-w-xs mx-auto flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1"
      >
        <SparklesIcon className="h-6 w-6 mr-2" />APIキーを選択
      </button>
      <p className="text-xs text-gray-500 mt-4">
        APIキーの管理と課金に関する詳細は
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline ml-1">こちら</a>
        をご覧ください。
      </p>
    </div>
  );

  const ModeSelectionScreen = ({onSelectMode}: {onSelectMode: (mode: AppMode) => void}) => (
    <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">制作方法を選択してください</h2>
        <p className="text-gray-400 mb-8">どちらの方法でも素晴らしいビデオが作れます！</p>
        <div className="grid md:grid-cols-2 gap-6">
            <button onClick={() => onSelectMode(AppMode.GENERATE)} className="bg-gray-700/80 p-8 rounded-2xl hover:bg-purple-900/50 border border-gray-600 hover:border-purple-500 transition-all transform hover:-translate-y-1">
                <Wand2Icon className="h-12 w-12 mx-auto text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">AIでゼロから作る</h3>
                <p className="text-gray-400 text-sm">テーマを入力し、AIに歌詞・画像を生成させ、まったく新しいミュージックビデオを制作します。</p>
            </button>
            <button onClick={() => onSelectMode(AppMode.UPLOAD)} className="bg-gray-700/80 p-8 rounded-2xl hover:bg-pink-900/50 border border-gray-600 hover:border-pink-500 transition-all transform hover:-translate-y-1">
                <UploadCloudIcon className="h-12 w-12 mx-auto text-pink-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">ファイルを持ち込む</h3>
                <p className="text-gray-400 text-sm">お手持ちの楽曲と画像ファイルを使って、ミュージックビデオを制作します。</p>
                <p className="text-xs text-pink-300 mt-2 font-semibold">Suno AI や Midjourney の素材に最適！</p>
            </button>
        </div>
    </div>
  );

  const UploadFlow = () => {
    const isGenerateDisabled = status === AppStatus.LOADING || !imageFile || !motionPrompt;
    return (
        <div className="space-y-6">
            <button onClick={() => setMode(AppMode.SELECT)} className="text-sm text-gray-400 hover:text-white transition-colors mb-4">&lt; モード選択に戻る</button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload label="① 楽曲をアップロード" acceptedTypes="audio/mpeg,audio/wav,audio/x-wav" file={audioFile} onFileChange={setAudioFile} isAudio={true} />
                <FileUpload label="② 画像をアップロード" acceptedTypes="image/png,image/jpeg" file={imageFile} onFileChange={setImageFile} />
            </div>
            <div>
                <label htmlFor="upload-prompt" className="block text-sm font-medium text-gray-300 mb-2">③ アニメーションの指示を入力 (プロンプト)</label>
                <textarea id="upload-prompt" value={motionPrompt} onChange={(e) => setMotionPrompt(e.target.value)} placeholder="例：口を大きく開けて情熱的に歌っている。背景にはサイバーパンクな街並み。" rows={4} className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
            </div>
            {renderAnimationOptions()}
            {renderLipSyncToggle()}
            {error && <ErrorMessage message={error} />}
            <button onClick={handleGenerateVideo} disabled={isGenerateDisabled} className={`w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 ${isGenerateDisabled ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1'}`}>
                <SparklesIcon className="h-6 w-6 mr-2" />ビデオを生成する
            </button>
        </div>
    );
  };
  
  const GenerateFlow = () => {
    const renderStepContent = () => {
        switch(step) {
            case GenerationStep.LYRICS: return (
                <div>
                    <h3 className="text-xl font-semibold mb-2">① 歌詞のテーマを入力</h3>
                    <p className="text-gray-400 mb-4">AIがあなたのためのオリジナル歌詞を生成します。</p>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2">生成する言語</label>
                        <div className="flex bg-gray-700 rounded-lg p-1">
                            <button onClick={() => setLanguage('ja')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${language === 'ja' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>日本語</button>
                            <button onClick={() => setLanguage('en')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${language === 'en' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>English</button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                         <label htmlFor="lyric-theme" className="block text-sm font-medium text-gray-400">テーマ</label>
                        <button onClick={handleGenerateTheme} disabled={isGeneratingTheme} className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center disabled:text-gray-500 disabled:cursor-not-allowed">
                            <Wand2Icon className="h-4 w-4 mr-1" />{isGeneratingTheme ? '生成中...' : 'テーマをAIに考えてもらう'}
                        </button>
                    </div>
                    <textarea id="lyric-theme" value={lyricTheme} onChange={(e) => setLyricTheme(e.target.value)} placeholder="例：雨上がりの虹、未来への希望" rows={3} className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition mb-4"/>
                    {error && <ErrorMessage message={error} />}
                    <button onClick={handleGenerateLyrics} disabled={isGeneratingLyrics || !lyricTheme} className={`w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all ${!lyricTheme || isGeneratingLyrics ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}>
                        {isGeneratingLyrics ? '生成中...' : <><SparklesIcon className="h-5 w-5 mr-2" />歌詞を生成する</>}
                    </button>
                </div>
            );
            case GenerationStep.PRODUCTION: return (
                <div>
                    <h3 className="text-xl font-semibold mb-2">② 楽曲作成＆ビデオ生成</h3>
                    <p className="text-gray-400 mb-6">生成された歌詞で楽曲を作成・アップロードし、各シーンのビデオを生成しましょう。</p>

                    <div className="space-y-4 mb-6">
                        <InputField label="TITLE" value={generatedTitle} onChange={setGeneratedTitle} copyValue={generatedTitle} />
                        <InputField label="MUSIC STYLE" value={generatedMusicStyle} onChange={setGeneratedMusicStyle} copyValue={generatedMusicStyle} />
                        <div>
                            <label className="block text-xs text-purple-400 font-semibold tracking-wider mb-1">LYRICS</label>
                            <LyricsDisplay lyrics={generatedLyrics} />
                            <button onClick={() => navigator.clipboard.writeText(generatedLyrics)} className="w-full mt-2 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg text-sm flex items-center justify-center">
                                <ClipboardCopyIcon className="h-4 w-4 mr-2" />歌詞をコピー
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-gray-900/50 p-4 rounded-lg mb-6 border border-gray-700">
                      <h4 className="font-semibold text-purple-300 mb-3">楽曲作成ガイド</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                          <li>上のボタンから歌詞などをコピーし、Suno AIで曲を作成します。</li>
                          <li>完成した楽曲をMP3形式などでダウンロードします。</li>
                          <li>この画面に戻り、下のエリアからファイルをアップロードします。</li>
                      </ol>
                       <a href="https://suno.com/" target="_blank" rel="noopener noreferrer" className="w-full mt-4 flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/50">
                        Suno AI で楽曲を作成する<ExternalLinkIcon className="h-5 w-5 ml-2" />
                      </a>
                    </div>
                    <FileUpload label="完成した楽曲ファイルをアップロード" acceptedTypes="audio/mpeg,audio/wav,audio/x-wav" file={audioFile} onFileChange={setAudioFile} isAudio={true} />
                
                    <div className="mt-8 pt-6 border-t border-gray-700">
                        <h3 className="text-xl font-semibold mb-2">③ シーンごとのビデオクリップ</h3>
                        <p className="text-gray-400 mb-4">AIが生成したプロンプトを編集し、シーンごとにビデオを生成できます。</p>
                        
                        {isGeneratingPrompts ? (
                            <div className="flex items-center justify-center p-6 bg-gray-700/50 rounded-lg">
                                <div className="w-6 h-6 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mr-3"></div>
                                <span>シーンのプロンプトを生成中...</span>
                            </div>
                        ) : error && !scenes.length ? (
                            <ErrorMessage message={error} />
                        ) : scenes.length > 0 && (
                            <div className="space-y-4 mb-6">
                                {scenes.map(scene => <SceneEditorCard 
                                    key={scene.id} 
                                    scene={scene}
                                    isGeneratingClips={isGeneratingClips}
                                    onGenerateClip={handleGenerateSingleClip}
                                    onUpdateScene={updateScene}
                                />)}
                                
                                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
                                    <div>
                                        <label htmlFor="generation-delay" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                                            <ClockIcon className="w-5 h-5 mr-2 text-purple-400" />
                                            生成間隔（分）
                                        </label>
                                        <input
                                            id="generation-delay"
                                            type="number"
                                            value={generationDelay}
                                            onChange={(e) => setGenerationDelay(Math.max(0, parseInt(e.target.value, 10)))}
                                            min="0"
                                            disabled={isGeneratingClips}
                                            className="w-full bg-gray-700 border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-800 disabled:cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            無料枠のAPI制限を避けるため、各ビデオ生成の間に遅延を設定します。1分以上を推奨します。
                                        </p>
                                    </div>
                                    {isGeneratingClips ? (
                                      <button onClick={handleStopGeneration} className="w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-red-600 hover:bg-red-700 shadow-lg">
                                        <StopCircleIcon className="h-6 w-6 mr-2" />
                                        生成を中止
                                      </button>
                                    ) : (
                                      <button onClick={handleGenerateAllClips} disabled={scenes.filter(s => s.status !== 'completed').length === 0} className={`w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 ${scenes.filter(s => s.status !== 'completed').length === 0 ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg'}`}>
                                        <SparklesIcon className="h-6 w-6 mr-2" />
                                        {`残り${scenes.filter(s => s.status !== 'completed').length}件をまとめて生成`}
                                      </button>
                                    )}
                                    {(isGeneratingClips || generationStatusMessage) && (
                                        <div className="text-center text-sm text-purple-300 pt-2">
                                            <p>{generationStatusMessage}</p>
                                            {countdown > 0 && <p className="font-mono text-lg">{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
    
    const steps = [ {name: '歌詞', icon: Wand2Icon}, {name: '制作', icon: FilmIcon} ];

    return (
        <div>
            <button onClick={() => setMode(AppMode.SELECT)} className="text-sm text-gray-400 hover:text-white transition-colors mb-4">&lt; モード選択に戻る</button>
            <div className="mb-8">
                <ol className="flex items-center w-full">
                    {steps.map((s, index) => (
                         <li key={s.name} className={`flex w-full items-center ${index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ''} ${index <= step ? 'text-purple-400 after:border-purple-600' : 'text-gray-500 after:border-gray-700'}`}>
                           <span className={`flex flex-col items-center justify-center w-12 h-12 rounded-full shrink-0 ${index <= step ? 'bg-purple-800' : 'bg-gray-700'}`}>
                               <s.icon className="w-6 h-6" />
                           </span>
                        </li>
                    ))}
                </ol>
            </div>
            {renderStepContent()}
        </div>
    );
  };
  
  const InputField = ({ label, value, onChange, copyValue }: { label: string, value: string, onChange: (v: string) => void, copyValue: string }) => (
    <div>
        <label className="block text-xs text-purple-400 font-semibold tracking-wider mb-1">{label}</label>
        <div className="flex items-center gap-2">
            <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-grow w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
            <button onClick={() => navigator.clipboard.writeText(copyValue)} title={`Copy ${label}`} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg"><ClipboardCopyIcon className="h-5 w-5" /></button>
        </div>
    </div>
  );
  
  const renderAnimationOptions = () => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">動きとエフェクトを追加 (オプション)</label>
      <div className="bg-gray-700/50 p-4 rounded-lg space-y-4">
        <div>
          <label htmlFor="camera-work" className="block text-xs font-medium text-gray-400 mb-1">カメラワーク</label>
          <select id="camera-work" value={cameraWork} onChange={e => setCameraWork(e.target.value)} className="w-full bg-gray-600 border-gray-500 rounded-md p-2 focus:ring-1 focus:ring-purple-500 transition">
            {Object.entries(cameraWorkOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">エフェクト</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(effectOptions).map(([value, label]) => (
              <button key={value} onClick={() => handleEffectChange(value)} className={`text-sm text-left w-full p-2 rounded-md transition-colors ${effects.includes(value) ? 'bg-purple-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLipSyncToggle = () => (
    <div className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg">
      <div>
        <label htmlFor="lip-sync-toggle" className="font-medium text-gray-200">
          口パク（リップシンク）を試す (β)
        </label>
        <p className="text-xs text-gray-400">
          AIが歌っているような口の動きを生成します。顔がはっきり写っている画像で最も効果的です。
        </p>
      </div>
      <label htmlFor="lip-sync-toggle" className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" id="lip-sync-toggle" className="sr-only peer" checked={lipSync} onChange={(e) => setLipSync(e.target.checked)} />
        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
      </label>
    </div>
  );
  
  const ErrorMessage = ({ message }: { message: string }) => (
    <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative" role="alert">
      <div className="flex items-center">
        <AlertTriangleIcon className="h-5 w-5 mr-3" />
        <span className="block sm:inline">{message}</span>
      </div>
    </div>
  );

  const SettingsModal = () => (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-600 rounded-2xl shadow-xl w-full max-w-md">
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold flex items-center gap-2"><SettingsIcon className="w-6 h-6 text-purple-400" /> 設定</h2>
            <button onClick={() => setIsSettingsOpen(false)} className="p-1 text-gray-400 hover:text-white rounded-full"><XIcon className="w-6 h-6"/></button>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2 flex items-center gap-2"><KeyRoundIcon className="w-5 h-5"/>APIキー設定</h3>
              <p className="text-sm text-gray-400 mb-3">APIキーが無効な場合や変更したい場合は、こちらから再選択してください。</p>
              <button
                onClick={async () => {
                  try {
                    await window.aistudio.openSelectKey();
                    setIsKeySelected(true);
                    setIsSettingsOpen(false);
                  } catch (e) { setError("APIキー選択ダイアログを開けませんでした。"); }
                }}
                className="w-full flex items-center justify-center text-md font-semibold py-2 px-4 rounded-lg transition-colors bg-purple-600 hover:bg-purple-700"
              >
                APIキーを再選択する
              </button>
               <p className="text-xs text-gray-500 mt-2 text-center">
                課金等の詳細は
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline ml-1">こちら</a>
                をご覧ください。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2 flex items-center gap-2"><FilmIcon className="w-5 h-5"/>ビデオモデル設定</h3>
              <p className="text-sm text-gray-400 mb-3">使用するビデオ生成モデルを選択します。高品質モデルは生成に時間がかかる場合があります。</p>
              <select 
                value={videoModel} 
                onChange={e => setVideoModel(e.target.value as VideoModel)} 
                className="w-full bg-gray-700 border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              >
                <option value="veo-3.1-fast-generate-preview">Veo Fast (速度優先)</option>
                <option value="veo-3.1-generate-preview">Veo HD (品質優先)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
  );

  return (
    <div className="bg-gray-800 text-white min-h-screen font-sans">
      {isSettingsOpen && <SettingsModal />}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="relative text-center mb-10">
           <button
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-0 right-0 p-2 text-gray-400 hover:text-white transition-colors"
            title="設定"
            aria-label="設定を開く"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
          <div className="flex justify-center items-center gap-4 mb-4">
            <MusicIcon className="h-8 w-8 text-pink-400" />
            <FileImageIcon className="h-8 w-8 text-purple-400" />
            <FilmIcon className="h-8 w-8 text-pink-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            AI Music Video Maker
          </h1>
          <p className="mt-3 text-gray-400 max-w-2xl mx-auto">
            AIの力で、あなたの楽曲と一枚の画像からアニメーション付きミュージックビデオを生成します。
          </p>
        </header>
        <div className="bg-gray-900/70 p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700">
          {renderContent()}
        </div>
        <footer className="text-center mt-8 text-xs text-gray-600">
          <p>Powered by Google Gemini API</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
