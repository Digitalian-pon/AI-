import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppStatus, AppMode, GenerationStep, Scene } from './types';
import { generateAnimationVideo, fileToBase64, generateLyrics, generateTheme, generateImage, generateScenePrompts, translateText, generateAnimationPromptFromImage, generateSceneAnimationPrompts, generateBatchAnimationPrompts, suggestAnimationPromptForScene } from './services/geminiService';
import { VideoModel } from './services/geminiService';
import { parseLyrics } from './utils';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import LyricsDisplay from './components/LyricsDisplay';
import { SparklesIcon, AlertTriangleIcon, Wand2Icon, MusicIcon, FileImageIcon, FilmIcon, UploadCloudIcon, ClipboardCopyIcon, ExternalLinkIcon, KeyRoundIcon, ListVideoIcon, RotateCcwIcon, ClockIcon, StopCircleIcon, SettingsIcon, XIcon, LanguagesIcon, ArrowDownIcon, FlameIcon, HeartIcon } from './components/Icons';

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

const generateAnimationVideo = async (prompt, imageBase64, imageMimeType, modelName, lipSync, apiKey) => {
  const ai = new GoogleGenAI({ apiKey });
  
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
      return 'ビデオ生成サービスで一時的なエラーが発生しました。時間を置いて再試行するか、プロンプトを少し変更してみてください。';
    }
    if (message.includes('requested entity was not found')) return '有効なAPIキーが見つかりませんでした。設定からAPIキーを再選択してください。';
    if (message.includes('quota') || message.includes('resource_exhausted')) return 'APIの利用上限に達した可能性があります。Google AI Studioで支払い設定をご確認ください。';
    if (message.includes('api_key') && (message.includes('invalid') || message.includes('not found'))) return 'APIキーが無効、または権限がありません。有効なAPIキーを選択しているかご確認ください。';
    if (message.includes('fetch')) return 'ネットワークエラーが発生しました。インターネット接続を確認してから、もう一度お試しください。';
    return err instanceof Error ? err.message : '予期せぬエラーが発生しました。しばらくしてからもう一度お試しください。';
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

  // Generate one clip: Image + Video
  if (type === 'generate-one') {
    const { scene, videoModel, lipSync, apiKey } = payload;
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

  // Generate one clip: Video only (from existing image)
  if (type === 'generate-one-from-image') {
    const { scene, imageBase64, imageMimeType, videoModel, lipSync, apiKey } = payload;
    try {
        self.postMessage({ type: 'video_generating', payload: { sceneId: scene.id, imageBase64 } });
        const videoUrl = await generateAnimationVideo(scene.animationPrompt, imageBase64, imageMimeType, videoModel, lipSync, apiKey);
        
        self.postMessage({ type: 'completed', payload: { sceneId: scene.id, videoUrl } });
    } catch(err) {
        const message = getFriendlyErrorMessage(err);
        self.postMessage({ type: 'error', payload: { sceneId: scene.id, message } });
    }
  }

  // Generate all clips: Image + Video
  if (type === 'generate-all') {
    isAborted = false;
    const { scenes, videoModel, lipSync, delay, apiKey } = payload;
    
    for (const [index, scene] of scenes.entries()) {
      if (isAborted) { self.postMessage({ type: 'stopped' }); break; }
      
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
      
      if (index < scenes.length - 1 && !isAborted) {
        self.postMessage({ type: 'progress', payload: { message: '次の生成まで待機中...' } });
        const delayInSeconds = delay * 60;
        for (let i = delayInSeconds; i > 0; i--) {
          if (isAborted) break;
          self.postMessage({ type: 'countdown', payload: { seconds: i } });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (isAborted) { self.postMessage({ type: 'stopped' }); break; }
        self.postMessage({ type: 'countdown', payload: { seconds: 0 } });
      }
    }
    if (!isAborted) { self.postMessage({ type: 'all_complete' }); }
  }

  // Generate all clips: Video only (from existing image)
  if (type === 'generate-all-from-image') {
    isAborted = false;
    const { scenes, imageBase64, imageMimeType, videoModel, lipSync, delay, apiKey } = payload;
    
    for (const [index, scene] of scenes.entries()) {
      if (isAborted) { self.postMessage({ type: 'stopped' }); break; }
      
      self.postMessage({ type: 'progress', payload: { message: \`クリップ \${index + 1} / \${scenes.length} を生成中: 「\${scene.sectionHeader}」\` } });
      
      try {
        self.postMessage({ type: 'video_generating', payload: { sceneId: scene.id, imageBase64 } });
        const videoUrl = await generateAnimationVideo(scene.animationPrompt, imageBase64, imageMimeType, videoModel, lipSync, apiKey);
        
        if (isAborted) { self.postMessage({ type: 'stopped' }); break; }

        self.postMessage({ type: 'completed', payload: { sceneId: scene.id, videoUrl } });
      } catch (err) {
        const message = getFriendlyErrorMessage(err);
        self.postMessage({ type: 'error', payload: { sceneId: scene.id, message } });
      }
      
      if (index < scenes.length - 1 && !isAborted) {
        self.postMessage({ type: 'progress', payload: { message: '次の生成まで待機中...' } });
        const delayInSeconds = delay * 60;
        for (let i = delayInSeconds; i > 0; i--) {
          if (isAborted) break;
          self.postMessage({ type: 'countdown', payload: { seconds: i } });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (isAborted) { self.postMessage({ type: 'stopped' }); break; }
        self.postMessage({ type: 'countdown', payload: { seconds: 0 } });
      }
    }
    if (!isAborted) { self.postMessage({ type: 'all_complete' }); }
  }
};
`;

// Helper components are moved outside of the main App component
// to prevent them from being recreated on every render, which fixes the input bug.

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative" role="alert">
    <div className="flex items-center">
      <AlertTriangleIcon className="h-5 w-5 mr-3" />
      <span className="block sm:inline">{message}</span>
    </div>
  </div>
);

const SelectApiKeyScreen: React.FC<{
  onSelect: () => Promise<void>;
}> = ({ onSelect }) => (
  <div className="text-center py-10">
    <KeyRoundIcon className="h-16 w-16 mx-auto text-purple-400 mb-6" />
    <h2 className="text-2xl font-bold mb-3">はじめにAPIキーを選択</h2>
    <p className="text-gray-400 mb-6 max-w-md mx-auto">ビデオを生成するには、Google AI StudioのAPIキーが必要です。下のボタンからキーを選択してください。</p>
    <button
      onClick={onSelect}
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

const ModeSelectionScreen: React.FC<{ onSelectMode: (mode: AppMode) => void }> = ({ onSelectMode }) => (
  <div className="text-center">
    <h2 className="text-2xl font-bold mb-2">どちらの方法で作成しますか？</h2>
    <p className="text-gray-400 mb-8">作りたいイメージに合わせて選択してください。</p>
    <div className="grid md:grid-cols-2 gap-6">
      <button onClick={() => onSelectMode(AppMode.GENERATE)} className="bg-gray-700/80 p-8 rounded-2xl hover:bg-purple-900/50 border border-gray-600 hover:border-purple-500 transition-all transform hover:-translate-y-1">
        <Wand2Icon className="h-12 w-12 mx-auto text-purple-400 mb-4" />
        <h3 className="text-xl font-semibold mb-2">AIでゼロから作る</h3>
        <p className="text-gray-400 text-sm">作りたいビデオのテーマを伝えるだけで、AIが歌詞と映像をゼロから制作します。</p>
      </button>
      <button onClick={() => onSelectMode(AppMode.UPLOAD)} className="bg-gray-700/80 p-8 rounded-2xl hover:bg-pink-900/50 border border-gray-600 hover:border-pink-500 transition-all transform hover:-translate-y-1">
        <UploadCloudIcon className="h-12 w-12 mx-auto text-pink-400 mb-4" />
        <h3 className="text-xl font-semibold mb-2">ファイルを持ち込む</h3>
        <p className="text-gray-400 text-sm">お手持ちの楽曲と画像から、AIがアニメーション付きのミュージックビデオを制作します。</p>
        <p className="text-xs text-pink-300 mt-2 font-semibold">Suno AI や Midjourney の素材に最適！</p>
      </button>
    </div>
  </div>
);

const SceneEditorCard: React.FC<{
  scene: Scene;
  isGeneratingClips: boolean;
  onGenerateClip: (sceneId: number) => void;
  onUpdateScene: (id: number, updates: Partial<Scene>) => void;
  onTranslate: (text: string, targetLanguage: 'ja' | 'en') => Promise<string>;
  flowMode: 'generate' | 'upload';
  baseImage?: string | null;
  onSuggestAnimation: (sceneId: number) => void;
  suggestingSceneId: number | null;
}> = ({ scene, isGeneratingClips, onGenerateClip, onUpdateScene, onTranslate, flowMode, baseImage, onSuggestAnimation, suggestingSceneId }) => {
  const [imageTranslation, setImageTranslation] = useState('');
  const [animationTranslation, setAnimationTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState<'image' | 'animation' | null>(null);

  const handleTranslate = async (type: 'image' | 'animation') => {
    const textToTranslate = type === 'image' ? scene.imagePrompt : scene.animationPrompt;
    if (!textToTranslate) return;

    setIsTranslating(type);
    if(type === 'image') setImageTranslation('');
    else setAnimationTranslation('');

    try {
      const translation = await onTranslate(textToTranslate, 'ja');
      if (type === 'image') setImageTranslation(translation);
      else setAnimationTranslation(translation);
    } catch (e) {
      const errorMessage = '翻訳に失敗しました。';
      if (type === 'image') setImageTranslation(errorMessage);
      else setAnimationTranslation(errorMessage);
    } finally {
      setIsTranslating(null);
    }
  };

  const onGenerate = () => onGenerateClip(scene.id);
  const thumbnail = flowMode === 'upload' 
    ? baseImage 
    : scene.generatedImageBase64 ? `data:image/png;base64,${scene.generatedImageBase64}` : null;
  
  const isSuggesting = suggestingSceneId === scene.id;
  const isGenerating = ['image_generating', 'video_generating'].includes(scene.status);
  const isDisabled = isGeneratingClips || isGenerating || suggestingSceneId !== null;

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
            {scene.sectionContent && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{scene.sectionContent}</p>}
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
          <div className={`flex-grow grid grid-cols-1 ${flowMode === 'generate' ? 'md:grid-cols-2' : ''} gap-3`}>
            {flowMode === 'generate' && (
              <div>
                  <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-gray-300">画像プロンプト (英語)</label>
                      <button onClick={() => handleTranslate('image')} disabled={isDisabled || isTranslating === 'image' || !scene.imagePrompt} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed">
                          {isTranslating === 'image' ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div> : <LanguagesIcon className="w-3 h-3" />} 日本語へ翻訳
                      </button>
                  </div>
                  <textarea value={scene.imagePrompt} onChange={(e) => onUpdateScene(scene.id, { imagePrompt: e.target.value })} rows={4} disabled={isDisabled} className="w-full text-sm bg-gray-800 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-700" />
                  {imageTranslation && <div className="mt-2 p-2 bg-gray-800/70 rounded-md text-xs text-gray-300 border border-gray-600">{imageTranslation}</div>}
              </div>
            )}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-300">アニメーションプロンプト</label>
                     <div className="flex items-center gap-3">
                        { (flowMode === 'upload' && (scene.sectionContent || scene.sectionHeader)) &&
                            <button 
                                onClick={() => onSuggestAnimation(scene.id)} 
                                disabled={isDisabled}
                                title="歌詞と画像を基にAIが新しいプロンプトを提案します"
                                className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                {isSuggesting ? <div className="w-3 h-3 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"></div> : <Wand2Icon className="w-3 h-3" />}
                                AI提案
                            </button>
                        }
                        <button onClick={() => handleTranslate('animation')} disabled={isDisabled || isTranslating === 'animation' || !scene.animationPrompt} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed">
                            {isTranslating === 'animation' ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div> : <LanguagesIcon className="w-3 h-3" />} 日本語へ翻訳
                        </button>
                    </div>
                </div>
                <textarea value={scene.animationPrompt} onChange={(e) => onUpdateScene(scene.id, { animationPrompt: e.target.value })} rows={4} disabled={isDisabled} className="w-full text-sm bg-gray-800 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-700" />
                 {animationTranslation && <div className="mt-2 p-2 bg-gray-800/70 rounded-md text-xs text-gray-300 border border-gray-600">{animationTranslation}</div>}
            </div>
          </div>
      </div>
      {scene.status === 'error' && <p className="text-xs text-red-400 -mt-2" title={scene.errorMessage}><span className="font-semibold">エラー:</span> {scene.errorMessage}</p>}
    </div>
  );
};

const InputField: React.FC<{ label: string, value: string, onChange: (v: string) => void, copyValue: string }> = ({ label, value, onChange, copyValue }) => (
    <div>
        <label className="block text-xs text-purple-400 font-semibold tracking-wider mb-1">{label}</label>
        <div className="flex items-center gap-2">
            <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-grow w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
            <button onClick={() => navigator.clipboard.writeText(copyValue)} title={`Copy ${label}`} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg"><ClipboardCopyIcon className="h-5 w-5" /></button>
        </div>
    </div>
);

const SceneEditorFlow: React.FC<{
    scenes: Scene[];
    isGeneratingClips: boolean;
    handleGenerateSingleClip: (id: number) => void;
    updateScene: (id: number, updates: Partial<Scene>) => void;
    onTranslate: (text: string, targetLanguage: 'ja' | 'en') => Promise<string>;
    flowMode: 'generate' | 'upload';
    baseImage?: string | null;
    generationDelay: number;
    setGenerationDelay: (delay: number) => void;
    handleStopGeneration: () => void;
    handleGenerateAllClips: () => void;
    generationStatusMessage: string;
    countdown: number;
    error: string;
    onSuggestAnimation: (id: number) => void;
    suggestingSceneId: number | null;
}> = (props) => {
  return (
    <div className="space-y-4">
        {props.error && <ErrorMessage message={props.error} />}
        {props.scenes.map(scene => <SceneEditorCard 
            key={scene.id} 
            scene={scene}
            isGeneratingClips={props.isGeneratingClips}
            onGenerateClip={props.handleGenerateSingleClip}
            onUpdateScene={props.updateScene}
            onTranslate={props.onTranslate}
            flowMode={props.flowMode}
            baseImage={props.baseImage}
            onSuggestAnimation={props.onSuggestAnimation}
            suggestingSceneId={props.suggestingSceneId}
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
                    value={props.generationDelay}
                    onChange={(e) => props.setGenerationDelay(Math.max(0, parseInt(e.target.value, 10)))}
                    min="0"
                    disabled={props.isGeneratingClips}
                    className="w-full bg-gray-700 border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-800 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-2">
                    APIのレート制限（特に無料利用枠）を避けるため、各クリップ生成の間に遅延を設定できます。1分以上の設定を推奨します。
                </p>
            </div>
            {props.isGeneratingClips ? (
              <button onClick={props.handleStopGeneration} className="w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-red-600 hover:bg-red-700 shadow-lg">
                <StopCircleIcon className="h-6 w-6 mr-2" />
                生成を中止
              </button>
            ) : (
              <button onClick={props.handleGenerateAllClips} disabled={props.scenes.filter(s => s.status !== 'completed').length === 0} className={`w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 ${props.scenes.filter(s => s.status !== 'completed').length === 0 ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg'}`}>
                <SparklesIcon className="h-6 w-6 mr-2" />
                {`残り${props.scenes.filter(s => s.status !== 'completed').length}件をまとめて生成`}
              </button>
            )}
            {(props.isGeneratingClips || props.generationStatusMessage) && (
                <div className="text-center text-sm text-purple-300 pt-2">
                    <p>{props.generationStatusMessage}</p>
                    {props.countdown > 0 && <p className="font-mono text-lg">{Math.floor(props.countdown / 60)}:{(props.countdown % 60).toString().padStart(2, '0')}</p>}
                </div>
            )}
        </div>
    </div>
  );
};


const SceneSetupFlow: React.FC<{
    setMode: (mode: AppMode) => void;
    audioFile: File | null;
    setAudioFile: (file: File | null) => void;
    imageFile: File | null;
    setImageFile: (file: File | null) => void;
    onScenesCreated: (scenes: Scene[]) => void;
    error: string;
    setError: (error: string) => void;
    setIsKeySelected: (selected: boolean) => void;
    getFriendlyErrorMessage: (err: unknown) => string;
    getApiKey: () => string;
}> = (props) => {
    const [lyrics, setLyrics] = useState('');
    const [numScenes, setNumScenes] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateFromLyrics = async () => {
        if (!lyrics) return;
        setIsGenerating(true);
        props.setError('');
        try {
            const apiKey = props.getApiKey();
            const prompts = await generateSceneAnimationPrompts(lyrics, 'ja', apiKey);
            const parsedLyrics = parseLyrics(lyrics);

            const sceneData: Scene[] = parsedLyrics.map((section, index) => {
                const promptData = prompts.find(p => p.section.toLowerCase().trim() === section.header.toLowerCase().replace(/[\[\]():]/g, '').trim());
                return {
                    id: index,
                    sectionHeader: section.header,
                    sectionContent: section.content,
                    imagePrompt: '', // Not used in this flow
                    animationPrompt: promptData?.animationPrompt || '',
                    status: 'idle',
                }
            });
            props.onScenesCreated(sceneData);
        } catch (err) {
            // Let the getApiKey throw first
            if (err instanceof Error && err.message === 'API_KEY_NOT_FOUND') return;
            const friendlyError = props.getFriendlyErrorMessage(err);
            if (friendlyError.includes('APIキー')) props.setIsKeySelected(false);
            props.setError(friendlyError);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateFromNumber = async (autoPrompt: boolean) => {
        setIsGenerating(true);
        props.setError('');
        try {
            const sceneData: Scene[] = Array.from({ length: numScenes }, (_, i) => ({
                id: i,
                sectionHeader: `シーン ${i + 1}`,
                sectionContent: '',
                imagePrompt: '',
                animationPrompt: '',
                status: 'idle',
            }));

            if (autoPrompt) {
                if (!props.imageFile) throw new Error('プロンプトの自動生成には画像が必要です。');
                const apiKey = props.getApiKey();
                const imageBase64 = await fileToBase64(props.imageFile);
                const prompts = await generateBatchAnimationPrompts(imageBase64, props.imageFile.type, numScenes, apiKey);
                prompts.forEach((prompt, i) => {
                    if (sceneData[i]) sceneData[i].animationPrompt = prompt;
                });
            }
            props.onScenesCreated(sceneData);
        } catch (err) {
             if (err instanceof Error && err.message === 'API_KEY_NOT_FOUND') return;
            const friendlyError = props.getFriendlyErrorMessage(err);
            if (friendlyError.includes('APIキー')) props.setIsKeySelected(false);
            props.setError(friendlyError);
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <div className="space-y-6">
            <button onClick={() => props.setMode(AppMode.SELECT)} className="text-sm text-gray-400 hover:text-white transition-colors">&lt; モード選択に戻る</button>
            <h3 className="text-xl font-semibold">① 素材をアップロード</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload label="楽曲ファイル" acceptedTypes="audio/mpeg,audio/wav,audio/x-wav" file={props.audioFile} onFileChange={props.setAudioFile} isAudio={true} />
                <FileUpload label="ベース画像" acceptedTypes="image/png,image/jpeg" file={props.imageFile} onFileChange={props.setImageFile} />
            </div>

            <div className="pt-6 border-t border-gray-700">
                <h3 className="text-xl font-semibold">② シーンを構成する</h3>
                <p className="text-sm text-gray-400 mt-1 mb-4">ミュージックビデオを複数のクリップに分割します。どちらかの方法を選んでください。</p>
                
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Option A: From Lyrics */}
                    <div className="bg-gray-800/70 p-4 rounded-lg border border-gray-600 space-y-3">
                        <h4 className="font-semibold text-purple-300">歌詞から自動生成</h4>
                        <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="ここに歌詞を貼り付け" rows={5} className="w-full bg-gray-700 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-purple-500" disabled={isGenerating} />
                        <button onClick={handleGenerateFromLyrics} disabled={isGenerating || !lyrics} className="w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-colors bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {isGenerating ? '生成中...' : <><SparklesIcon className="h-5 w-5 mr-2" />シーンを生成</>}
                        </button>
                    </div>

                    {/* Option B: From Number */}
                    <div className="bg-gray-800/70 p-4 rounded-lg border border-gray-600 space-y-3">
                        <h4 className="font-semibold text-pink-300">クリップ数を指定して作成</h4>
                        <div className="flex items-center gap-3">
                            <label htmlFor="num-scenes" className="text-sm flex-shrink-0">クリップ数:</label>
                            <input id="num-scenes" type="number" value={numScenes} onChange={e => setNumScenes(Math.max(1, parseInt(e.target.value, 10)) || 1)} min="1" className="w-full bg-gray-700 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-pink-500" disabled={isGenerating} />
                        </div>
                        <div className="space-y-2">
                           <button onClick={() => handleGenerateFromNumber(true)} disabled={isGenerating || !props.imageFile} title={!props.imageFile ? "画像をアップロードしてください" : ""} className="w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-colors bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed">
                               {isGenerating ? '生成中...' : <><Wand2Icon className="h-5 w-5 mr-2" />プロンプトも自動生成</>}
                           </button>
                           <button onClick={() => handleGenerateFromNumber(false)} disabled={isGenerating} className="w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-colors bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed">
                               {isGenerating ? '生成中...' : '空のシーンを作成'}
                           </button>
                        </div>
                    </div>
                </div>
            </div>

            {props.error && <div className="pt-4"><ErrorMessage message={props.error} /></div>}
        </div>
    );
};


const GenerateFlow: React.FC<{
    setMode: (mode: AppMode) => void;
    step: GenerationStep;
    language: 'ja' | 'en';
    setLanguage: (lang: 'ja' | 'en') => void;
    lyricTheme: string;
    setLyricTheme: (theme: string) => void;
    handleGenerateTheme: (category: string) => void;
    generatingThemeCategory: string | null;
    themeKeywords: string;
    setThemeKeywords: (keywords: string) => void;
    error: string;
    handleGenerateLyrics: () => void;
    isGeneratingLyrics: boolean;
    generatedTitle: string;
    setGeneratedTitle: (title: string) => void;
    generatedMusicStyle: string;
    setGeneratedMusicStyle: (style: string) => void;
    generatedLyrics: string;
    audioFile: File | null;
    setAudioFile: (file: File | null) => void;
    isGeneratingPrompts: boolean;
    scenes: Scene[];
    isGeneratingClips: boolean;
    handleGenerateSingleClip: (id: number) => void;
    updateScene: (id: number, updates: Partial<Scene>) => void;
    generationDelay: number;
    setGenerationDelay: (delay: number) => void;
    handleStopGeneration: () => void;
    handleGenerateAllClips: () => void;
    generationStatusMessage: string;
    countdown: number;
    onTranslate: (text: string, targetLanguage: 'ja' | 'en') => Promise<string>;
}> = (props) => {
    const renderStepContent = () => {
        const isAnyThemeGenerating = !!props.generatingThemeCategory;

        const themeCategories = [
            { id: 'emotional', label: '感動的', icon: SparklesIcon, color: 'text-purple-400' },
            { id: 'trending', label: 'SNSで話題', icon: FlameIcon, color: 'text-pink-400' },
            { id: 'love', label: '恋愛・失恋', icon: HeartIcon, color: 'text-red-400' },
            { id: 'random', label: 'おまかせ', icon: Wand2Icon, color: 'text-gray-400' },
        ];

        switch (props.step) {
            case GenerationStep.LYRICS: return (
                <div>
                    <h3 className="text-xl font-semibold mb-2">① 歌詞のテーマを入力</h3>
                    <p className="text-gray-400 mb-4">AIがあなたのためのオリジナル歌詞を生成します。</p>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2">生成する言語</label>
                        <div className="flex bg-gray-700 rounded-lg p-1">
                            <button onClick={() => props.setLanguage('ja')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${props.language === 'ja' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>日本語</button>
                            <button onClick={() => props.setLanguage('en')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${props.language === 'en' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>English</button>
                        </div>
                    </div>
                    
                    <label htmlFor="lyric-theme" className="block text-sm font-medium text-gray-400 mb-2">テーマ</label>
                    <textarea id="lyric-theme" value={props.lyricTheme} onChange={(e) => props.setLyricTheme(e.target.value)} placeholder="ここにテーマを入力するか、下のヘルパーで生成してください" rows={2} className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition mb-4"/>

                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4 mb-4">
                        <h4 className="font-semibold text-purple-300">歌詞テーマ生成ヘルパー</h4>
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                value={props.themeKeywords} 
                                onChange={e => props.setThemeKeywords(e.target.value)} 
                                placeholder="キーワード (例: 宇宙, 孤独, 猫)"
                                disabled={isAnyThemeGenerating}
                                className="flex-grow w-full text-sm bg-gray-700 border-gray-600 rounded-lg px-3 py-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-800"
                            />
                            <button 
                                onClick={() => props.handleGenerateTheme('keywords')}
                                disabled={!props.themeKeywords || isAnyThemeGenerating}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {props.generatingThemeCategory === 'keywords' ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SparklesIcon className="w-4 h-4" />}
                                生成
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                           {themeCategories.map(cat => (
                                <button 
                                    key={cat.id} 
                                    onClick={() => props.handleGenerateTheme(cat.id)}
                                    disabled={isAnyThemeGenerating}
                                    className="flex flex-col items-center justify-center text-center p-3 rounded-lg transition-colors disabled:bg-gray-800/50 disabled:text-gray-500 disabled:cursor-not-allowed bg-gray-800 hover:bg-gray-700"
                                >
                                    {props.generatingThemeCategory === cat.id ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1"></div>
                                    ) : (
                                        <cat.icon className={`w-6 h-6 ${cat.color} mb-1`} />
                                    )}
                                    <span className="text-xs font-semibold">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {props.error && <ErrorMessage message={props.error} />}
                    <button onClick={props.handleGenerateLyrics} disabled={props.isGeneratingLyrics || !props.lyricTheme} className={`w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all ${!props.lyricTheme || props.isGeneratingLyrics ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}>
                        {props.isGeneratingLyrics ? '生成中...' : <><SparklesIcon className="h-5 w-5 mr-2" />歌詞を生成する</>}
                    </button>
                </div>
            );
            case GenerationStep.PRODUCTION: return (
                <div>
                    <h3 className="text-xl font-semibold mb-2">② 楽曲作成＆ビデオ生成</h3>
                    <p className="text-gray-400 mb-6">生成された歌詞で楽曲を作成・アップロードし、各シーンのビデオを生成しましょう。</p>

                    <div className="space-y-4 mb-6">
                        <InputField label="TITLE" value={props.generatedTitle} onChange={props.setGeneratedTitle} copyValue={props.generatedTitle} />
                        <InputField label="MUSIC STYLE" value={props.generatedMusicStyle} onChange={props.setGeneratedMusicStyle} copyValue={props.generatedMusicStyle} />
                        <div>
                            <label className="block text-xs text-purple-400 font-semibold tracking-wider mb-1">LYRICS</label>
                            <LyricsDisplay lyrics={props.generatedLyrics} />
                            <button onClick={() => navigator.clipboard.writeText(props.generatedLyrics)} className="w-full mt-2 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg text-sm flex items-center justify-center">
                                <ClipboardCopyIcon className="h-4 w-4 mr-2" />歌詞をコピー
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-gray-900/50 p-4 rounded-lg mb-6 border border-gray-700">
                      <h4 className="font-semibold text-purple-300 mb-3">楽曲作成ガイド</h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                          <li>上のボタンからタイトル、音楽スタイル、歌詞をコピーします。</li>
                          <li>Suno AIなどの作曲AIサービスで曲を作成します。</li>
                          <li>完成した楽曲をMP3形式などでダウンロードします。</li>
                          <li>この画面に戻り、下のエリアから楽曲ファイルをアップロードします。</li>
                      </ol>
                       <a href="https://suno.com/" target="_blank" rel="noopener noreferrer" className="w-full mt-4 flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/50">
                        Suno AI で楽曲を作成する<ExternalLinkIcon className="h-5 w-5 ml-2" />
                      </a>
                    </div>
                    <FileUpload label="完成した楽曲ファイルをアップロード" acceptedTypes="audio/mpeg,audio/wav,audio/x-wav" file={props.audioFile} onFileChange={props.setAudioFile} isAudio={true} />
                
                    <div className="mt-8 pt-6 border-t border-gray-700">
                        <h3 className="text-xl font-semibold mb-2">③ シーンごとのビデオクリップ</h3>
                        <p className="text-gray-400 mb-4">AIが生成したプロンプトを編集し、シーンごとにビデオを生成できます。</p>
                        
                        {props.isGeneratingPrompts ? (
                            <div className="flex items-center justify-center p-6 bg-gray-700/50 rounded-lg">
                                <div className="w-6 h-6 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mr-3"></div>
                                <span>シーンのプロンプトを生成中...</span>
                            </div>
                        ) : props.error && !props.scenes.length ? (
                            <ErrorMessage message={props.error} />
                        ) : props.scenes.length > 0 && (
                             <SceneEditorFlow
                                scenes={props.scenes}
                                isGeneratingClips={props.isGeneratingClips}
                                handleGenerateSingleClip={props.handleGenerateSingleClip}
                                updateScene={props.updateScene}
                                onTranslate={props.onTranslate}
                                flowMode="generate"
                                generationDelay={props.generationDelay}
                                setGenerationDelay={props.setGenerationDelay}
                                handleStopGeneration={props.handleStopGeneration}
                                handleGenerateAllClips={props.handleGenerateAllClips}
                                generationStatusMessage={props.generationStatusMessage}
                                countdown={props.countdown}
                                error={props.error}
                                onSuggestAnimation={() => {}} // No-op for generate flow
                                suggestingSceneId={null}
                            />
                        )}
                    </div>
                </div>
            );
        }
    }
    
    const steps = [ {name: '歌詞', icon: Wand2Icon}, {name: '制作', icon: FilmIcon} ];

    return (
        <div>
            <button onClick={() => props.setMode(AppMode.SELECT)} className="text-sm text-gray-400 hover:text-white transition-colors mb-4">&lt; モード選択に戻る</button>
            <div className="mb-8">
                <ol className="flex items-center w-full">
                    {steps.map((s, index) => (
                         <li key={s.name} className={`flex w-full items-center ${index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ''} ${index <= props.step ? 'text-purple-400 after:border-purple-600' : 'text-gray-500 after:border-gray-700'}`}>
                           <span className={`flex flex-col items-center justify-center w-12 h-12 rounded-full shrink-0 ${index <= props.step ? 'bg-purple-800' : 'bg-gray-700'}`}>
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

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<AppMode>(AppMode.SELECT);
  const [isKeySelected, setIsKeySelected] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
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
  const [themeKeywords, setThemeKeywords] = useState<string>('');
  const [generatingThemeCategory, setGeneratingThemeCategory] = useState<string | null>(null);
  
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isGeneratingClips, setIsGeneratingClips] = useState(false);
  const [generationDelay, setGenerationDelay] = useState<number>(1); // in minutes
  const [countdown, setCountdown] = useState<number>(0);
  const [generationStatusMessage, setGenerationStatusMessage] = useState('');
  const [suggestingSceneId, setSuggestingSceneId] = useState<number | null>(null);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl, { type: 'module' });
    workerRef.current = worker;

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

    return () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
    };
  }, []);

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
    if (imageFile) {
        fileToBase64(imageFile).then(setImageBase64);
    } else {
        setImageBase64(null);
    }
  }, [imageFile]);

  useEffect(() => {
    if (isGeneratingClips || scenes.length === 0 || status === AppStatus.SUCCESS) return;

    const allCompleted = scenes.every(s => s.status === 'completed');
    if (allCompleted) {
        if (audioFile) setAudioObjectUrl(URL.createObjectURL(audioFile));
        setGeneratedTitle(imageFile?.name.split('.')[0] || 'Untitled');
        setStatus(AppStatus.SUCCESS);
    }
  }, [scenes, isGeneratingClips, audioFile, imageFile, status]);

  const getFriendlyErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message.toLowerCase() : 'unknown error';
    if (message.includes('500') || message.includes('internal') || message.includes('server error')) {
      return 'ビデオ生成サービスで一時的なエラーが発生しました。時間を置いて再試行するか、プロンプトを少し変更してみてください。';
    }
    if (message.includes('requested entity was not found')) return '有効なAPIキーが見つかりませんでした。設定からAPIキーを再選択してください。';
    if (message.includes('quota') || message.includes('resource_exhausted')) return 'APIの利用上限に達した可能性があります。Google AI Studioで支払い設定をご確認ください。';
    if (message.includes('api_key') && (message.includes('invalid') || message.includes('not found'))) return 'APIキーが無効、または権限がありません。有効なAPIキーを選択しているかご確認ください。';
    if (message.includes('fetch')) return 'ネットワークエラーが発生しました。インターネット接続を確認してから、もう一度お試しください。';
    return err instanceof Error ? err.message : '予期せぬエラーが発生しました。しばらくしてからもう一度お試しください。';
  };
  
  const getApiKey = useCallback((): string => {
    if (typeof process === 'undefined' || !process.env || !process.env.API_KEY) {
      setError('APIキーを読み込めませんでした。設定からキーを再選択してください。');
      setIsKeySelected(false);
      throw new Error('API_KEY_NOT_FOUND');
    }
    return process.env.API_KEY;
  }, []);

  const updateScene = (id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(scene => scene.id === id ? { ...scene, ...updates } : scene));
  };

  const handleTranslateProp = useCallback(async (text: string, targetLanguage: 'ja' | 'en'): Promise<string> => {
    setError('');
    try {
        const apiKey = getApiKey();
        return await translateText(text, targetLanguage, apiKey);
    } catch (err) {
        if (err instanceof Error && err.message === 'API_KEY_NOT_FOUND') { throw err; }
        const friendlyError = getFriendlyErrorMessage(err);
        if (friendlyError.includes('APIキー')) setIsKeySelected(false);
        setError(friendlyError);
        throw new Error(friendlyError);
    }
  }, [getApiKey]);

  const handleGenerateTheme = async (category: string) => {
    setGeneratingThemeCategory(category);
    setError('');
    try {
        const apiKey = getApiKey();
        const keywordsToUse = category === 'keywords' ? themeKeywords : undefined;
        const theme = await generateTheme({ language, category, keywords: keywordsToUse }, apiKey);
        setLyricTheme(theme);
    } catch (err) {
        if (err instanceof Error && err.message === 'API_KEY_NOT_FOUND') { return; }
        const friendlyError = getFriendlyErrorMessage(err);
        if (friendlyError.includes('APIキー')) setIsKeySelected(false);
        setError(friendlyError);
    } finally {
        setGeneratingThemeCategory(null);
    }
  };

  const handleGenerateScenePrompts = async (lyrics: string, style: string, apiKey: string) => {
    setIsGeneratingPrompts(true);
    setScenes([]);
    setError('');
    try {
      const parsed = parseLyrics(lyrics);
      const prompts = await generateScenePrompts(lyrics, style, language, apiKey);
      
      const availablePrompts = [...prompts];

      const sceneData: Scene[] = parsed.map((section, index) => {
        const cleanedHeader = section.header.toLowerCase().replace(/[\[\]():]/g, '').trim();
        
        const bestMatchIndex = availablePrompts.findIndex(p => {
          const cleanedApiSection = p.section.toLowerCase().replace(/[\[\]():]/g, '').trim();
          return cleanedHeader === cleanedApiSection || cleanedHeader.includes(cleanedApiSection) || cleanedApiSection.includes(cleanedHeader);
        });

        let promptData;
        if (bestMatchIndex !== -1) {
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
        const friendlyError = getFriendlyErrorMessage(err);
        if (friendlyError.includes('APIキー')) setIsKeySelected(false);
        setError(friendlyError);
    } finally {
        setIsGeneratingPrompts(false);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!lyricTheme) return;
    setIsGeneratingLyrics(true);
    setError('');
    try {
      const apiKey = getApiKey();
      const { title, style, lyrics } = await generateLyrics(lyricTheme, language, apiKey);
      setGeneratedTitle(title);
      setGeneratedMusicStyle(style);
      setGeneratedLyrics(lyrics);
      setStep(GenerationStep.PRODUCTION);
      await handleGenerateScenePrompts(lyrics, style, apiKey);
    } catch (err) { 
        if (err instanceof Error && err.message === 'API_KEY_NOT_FOUND') { return; }
        const friendlyError = getFriendlyErrorMessage(err);
        if (friendlyError.includes('APIキー')) setIsKeySelected(false);
        setError(friendlyError);
    } 
    finally { setIsGeneratingLyrics(false); }
  };

  const handleGenerateSingleClip = (sceneId: number) => {
    try {
      const apiKey = getApiKey();
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene || !workerRef.current) return;

      updateScene(scene.id, { errorMessage: undefined });
      setGenerationStatusMessage(`「${scene.sectionHeader}」の生成を開始...`);

      if (mode === AppMode.GENERATE) {
          updateScene(scene.id, { status: 'image_generating' });
          workerRef.current.postMessage({
              type: 'generate-one',
              payload: { scene, videoModel, lipSync, apiKey }
          });
      } else if (mode === AppMode.UPLOAD && imageFile && imageBase64) {
          updateScene(scene.id, { status: 'video_generating' });
          workerRef.current.postMessage({
              type: 'generate-one-from-image',
              payload: { scene, imageBase64, imageMimeType: imageFile.type, videoModel, lipSync, apiKey }
          });
      }
    } catch (err) {
      // Error is already handled by getApiKey
      return;
    }
  };
  
  const handleStopGeneration = () => {
    if (workerRef.current) {
        workerRef.current.postMessage({ type: 'stop' });
    }
    setGenerationStatusMessage('生成を中止しています...');
  };
  
  const handleGenerateAllClips = () => {
    try {
      const apiKey = getApiKey();
      const scenesToGenerate = scenes.filter(s => s.status === 'idle' || s.status === 'error');
      if (scenesToGenerate.length === 0 || !workerRef.current) return;
      
      setIsGeneratingClips(true);
      setError('');
      setGenerationStatusMessage('');

      if (mode === AppMode.GENERATE) {
          workerRef.current.postMessage({
              type: 'generate-all',
              payload: { scenes: scenesToGenerate, videoModel, lipSync, delay: generationDelay, apiKey }
          });
      } else if (mode === AppMode.UPLOAD && imageFile && imageBase64) {
          workerRef.current.postMessage({
              type: 'generate-all-from-image',
              payload: { scenes: scenesToGenerate, imageBase64, imageMimeType: imageFile.type, videoModel, lipSync, delay: generationDelay, apiKey }
          });
      }
    } catch(err) {
      // Error is already handled by getApiKey
      return;
    }
  };

  const handleSuggestAnimation = async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !imageFile || !imageBase64 || suggestingSceneId !== null) return;

    setSuggestingSceneId(sceneId);
    const originalPrompt = scene.animationPrompt;

    try {
        const apiKey = getApiKey();
        const newPrompt = await suggestAnimationPromptForScene(
            scene.sectionHeader,
            scene.sectionContent,
            imageBase64,
            imageFile.type,
            apiKey
        );
        updateScene(sceneId, { animationPrompt: newPrompt });
    } catch (err) {
        if (err instanceof Error && err.message === 'API_KEY_NOT_FOUND') { return; }
        const friendlyError = getFriendlyErrorMessage(err);
        if (friendlyError.includes('APIキー')) setIsKeySelected(false);
        setError(friendlyError); // Show global error
        updateScene(sceneId, { animationPrompt: originalPrompt }); // Revert on error
    } finally {
        setSuggestingSceneId(null);
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setError('');
    setMode(AppMode.SELECT);
    setAudioFile(null);
    setImageFile(null);
    setImageBase64(null);
    setLipSync(true);
    setVideoModel('veo-3.1-fast-generate-preview');
    setGeneratedVideoUrl('');
    setAudioObjectUrl('');
    setStep(GenerationStep.LYRICS);
    setLanguage('ja');
    setLyricTheme('');
    setThemeKeywords('');
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
  
  const handleSelectApiKey = async () => {
      try {
        await window.aistudio.openSelectKey();
        setIsKeySelected(true);
      } catch (e) { setError("APIキー選択ダイアログを開けませんでした。"); }
  };

  const renderContent = () => {
    if (!isKeySelected) return <SelectApiKeyScreen onSelect={handleSelectApiKey} />;
    if (status === AppStatus.LOADING) return <Loader />;
    
    if (status === AppStatus.SUCCESS) {
      return <VideoResult scenes={scenes} audioFile={audioFile} audioUrl={audioObjectUrl} onReset={handleReset} generatedTitle={generatedTitle} />;
    }

    switch (mode) {
      case AppMode.SELECT: return <ModeSelectionScreen onSelectMode={setMode} />;
      case AppMode.UPLOAD: 
        if (scenes.length === 0) {
            return <SceneSetupFlow 
                setMode={setMode}
                audioFile={audioFile}
                setAudioFile={setAudioFile}
                imageFile={imageFile}
                setImageFile={setImageFile}
                onScenesCreated={setScenes}
                error={error}
                setError={setError}
                setIsKeySelected={setIsKeySelected}
                getFriendlyErrorMessage={getFriendlyErrorMessage}
                getApiKey={getApiKey}
            />;
        }
        return (
          <div>
            <button onClick={() => setScenes([])} className="text-sm text-gray-400 hover:text-white transition-colors mb-4">&lt; シーン設定に戻る</button>
            <h3 className="text-xl font-semibold mb-2">③ シーンごとのビデオクリップ</h3>
            <p className="text-gray-400 mb-4">アニメーションプロンプトを編集し、シーンごとにビデオを生成できます。</p>
            <SceneEditorFlow
                scenes={scenes}
                isGeneratingClips={isGeneratingClips}
                handleGenerateSingleClip={handleGenerateSingleClip}
                updateScene={updateScene}
                onTranslate={handleTranslateProp}
                flowMode="upload"
                baseImage={imageBase64}
                generationDelay={generationDelay}
                setGenerationDelay={setGenerationDelay}
                handleStopGeneration={handleStopGeneration}
                handleGenerateAllClips={handleGenerateAllClips}
                generationStatusMessage={generationStatusMessage}
                countdown={countdown}
                error={error}
                onSuggestAnimation={handleSuggestAnimation}
                suggestingSceneId={suggestingSceneId}
            />
        </div>
        );

      case AppMode.GENERATE: return <GenerateFlow 
        setMode={setMode}
        step={step}
        language={language}
        setLanguage={setLanguage}
        lyricTheme={lyricTheme}
        setLyricTheme={setLyricTheme}
        handleGenerateTheme={handleGenerateTheme}
        generatingThemeCategory={generatingThemeCategory}
        themeKeywords={themeKeywords}
        setThemeKeywords={setThemeKeywords}
        error={error}
        handleGenerateLyrics={handleGenerateLyrics}
        isGeneratingLyrics={isGeneratingLyrics}
        generatedTitle={generatedTitle}
        setGeneratedTitle={setGeneratedTitle}
        generatedMusicStyle={generatedMusicStyle}
        setGeneratedMusicStyle={setGeneratedMusicStyle}
        generatedLyrics={generatedLyrics}
        audioFile={audioFile}
        setAudioFile={setAudioFile}
        isGeneratingPrompts={isGeneratingPrompts}
        scenes={scenes}
        isGeneratingClips={isGeneratingClips}
        handleGenerateSingleClip={handleGenerateSingleClip}
        updateScene={updateScene}
        generationDelay={generationDelay}
        setGenerationDelay={setGenerationDelay}
        handleStopGeneration={handleStopGeneration}
        handleGenerateAllClips={handleGenerateAllClips}
        generationStatusMessage={generationStatusMessage}
        countdown={countdown}
        onTranslate={handleTranslateProp}
      />;
      default: return <ModeSelectionScreen onSelectMode={setMode} />;
    }
  };
  
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
            <div className="flex items-start justify-between bg-gray-700/50 p-4 rounded-lg">
              <div className="pr-4">
                <label htmlFor="lip-sync-toggle" className="font-medium text-gray-200">
                  口パク（リップシンク）を試す (β)
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  AIが歌っているような自然な口の動きを生成します。顔がはっきり写った画像で効果的です。
                </p>
                <p className="text-xs text-yellow-400 mt-1">
                  <strong>注意:</strong> AIは楽曲を聴いていないため、口の動きは実際の歌詞と完全に一致するわけではありません。
                </p>
              </div>
              <label htmlFor="lip-sync-toggle" className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" id="lip-sync-toggle" className="sr-only peer" checked={lipSync} onChange={(e) => setLipSync(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
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
            AIの力で、あなたの楽曲と一枚の画像から、世界に一つのアニメーションMVを。
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