import React, { useState, useCallback, useEffect } from 'react';
import { AppStatus, AppMode, GenerationStep, Scene } from './types';
import { generateAnimationVideo, fileToBase64, generateLyrics, generateTheme, generateImage, generateScenePrompts } from './services/geminiService';
import { VideoModel } from './services/geminiService';
import { parseLyrics } from './utils';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import LyricsDisplay from './components/LyricsDisplay';
import { SparklesIcon, AlertTriangleIcon, Wand2Icon, MusicIcon, FileImageIcon, FilmIcon, UploadCloudIcon, ClipboardCopyIcon, ExternalLinkIcon, KeyRoundIcon, RotateCcwIcon } from './components/Icons';

const cameraWorkOptions = {
  '': 'なし', 'slow zoom in': 'ズームイン', 'slow zoom out': 'ズームアウト',
  'pan from left to right': 'パン（左から右へ）', 'pan from right to left': 'パン（右から左へ）',
  'slow rotation clockwise': 'ゆっくりと回転',
};
const effectOptions = { 'sparkling lights': 'キラキラ光る', 'neon glow': 'ネオン', 'confetti falling': '紙吹雪', 'petals blowing in the wind': '風に舞う花びら' };

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<AppMode>(AppMode.SELECT);
  const [isKeySelected, setIsKeySelected] = useState<boolean>(false);

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

  useEffect(() => {
    const checkApiKey = async () => {
      // Give the aistudio object a moment to initialize
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
      if (friendlyError.includes('再度APIキーを選択してください')) setIsKeySelected(false);
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
      
      if (parsed.length !== prompts.length) {
        console.warn(`Mismatch in scene count. Lyrics parser found ${parsed.length}, but AI generated ${prompts.length} prompts. Proceeding by index matching.`);
      }

      const sceneData: Scene[] = parsed.map((section, index) => {
        const promptData = prompts[index]; // Match prompts to parsed sections by order.
        return {
          id: index,
          sectionHeader: promptData?.section || section.header, // Prefer AI's section name if available
          sectionContent: section.content,
          imagePrompt: promptData?.imagePrompt || '', // Fallback to empty if lengths mismatch
          animationPrompt: promptData?.animationPrompt || '', // Fallback to empty if lengths mismatch
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

  const handleGenerateSingleClip = async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    updateScene(scene.id, { errorMessage: undefined });

    try {
        updateScene(scene.id, { status: 'image_generating' });
        const imageBase64 = await generateImage(scene.imagePrompt);
        updateScene(scene.id, { generatedImageBase64: imageBase64, status: 'video_generating' });
        
        const videoUrl = await generateAnimationVideo(scene.animationPrompt, imageBase64, 'image/png', videoModel, lipSync);
        updateScene(scene.id, { generatedVideoUrl: videoUrl, status: 'completed' });
    } catch (err) {
        const message = getFriendlyErrorMessage(err);
        if (message.includes('再度APIキーを選択してください')) setIsKeySelected(false);
        updateScene(scene.id, { status: 'error', errorMessage: message });
    }
  };
  
  const handleGenerateAllClips = async () => {
    const scenesToGenerate = scenes.filter(s => s.status === 'idle' || s.status === 'error');
    if (scenesToGenerate.length === 0) return;
    
    setIsGeneratingClips(true);
    setError('');

    // Generate clips sequentially to avoid rate limiting
    for (const scene of scenesToGenerate) {
      await handleGenerateSingleClip(scene.id);
    }
    
    setIsGeneratingClips(false);
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
    if (!isKeySelected && mode !== AppMode.SELECT) return <SelectApiKeyScreen />;
    if (status === AppStatus.LOADING) return <Loader />;
    
    if (status === AppStatus.SUCCESS) {
        if(mode === AppMode.GENERATE) {
            const videoUrls = scenes.map(s => s.generatedVideoUrl).filter((url): url is string => !!url);
            return <VideoResult videoUrls={videoUrls} audioUrl={audioObjectUrl} onReset={handleReset} title={generatedTitle} />;
        }
        if(generatedVideoUrl) return <VideoResult videoUrls={[generatedVideoUrl]} audioUrl={audioObjectUrl} onReset={handleReset} />;
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
                        {isGeneratingLyrics ? '生成中...' : <><SparklesIcon className="h-5 w-5 mr-2" />歌詞を生成し、制作へ進む</>}
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
                            <div className="space-y-4">
                                {scenes.map(scene => <SceneEditorCard key={scene.id} scene={scene} />)}
                                <div className="pt-4 space-y-4">
                                  <VideoModelSelector videoModel={videoModel} setVideoModel={setVideoModel} />
                                  {renderLipSyncToggle()}
                                  <button onClick={handleGenerateAllClips} disabled={isGeneratingClips} className={`w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 ${isGeneratingClips ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg'}`}>
                                      <SparklesIcon className="h-6 w-6 mr-2" />{isGeneratingClips ? '全シーン生成中...' : '残りのクリップをすべて生成'}
                                  </button>
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
  
  // FIX: Explicitly type SceneEditorCard as a React.FC to correctly handle the 'key' prop.
  const SceneEditorCard: React.FC<{ scene: Scene }> = ({ scene }) => {
    const onGenerate = () => handleGenerateSingleClip(scene.id);
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
                  <textarea value={scene.imagePrompt} onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })} rows={4} disabled={isDisabled} className="w-full text-sm bg-gray-800 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-700" />
              </div>
              <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">アニメーションプロンプト</label>
                  <textarea value={scene.animationPrompt} onChange={(e) => updateScene(scene.id, { animationPrompt: e.target.value })} rows={4} disabled={isDisabled} className="w-full text-sm bg-gray-800 border-gray-600 rounded-lg p-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition disabled:bg-gray-700" />
              </div>
            </div>
        </div>
        {scene.status === 'error' && <p className="text-xs text-red-400 mt-2" title={scene.errorMessage}><span className="font-semibold">エラー:</span> {scene.errorMessage}</p>}
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
          <select id="camera-work" value={cameraWork} onChange={e => setCameraWork(e.target.value)} className="w-full bg-gray-600 border-gray-500 rounded-md p-2 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
            {Object.entries(cameraWorkOptions).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">エフェクト (複数選択可)</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(effectOptions).map(([value, label]) => (
              <label key={value} className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${effects.includes(value) ? 'bg-purple-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
                <input type="checkbox" className="hidden" checked={effects.includes(value)} onChange={() => handleEffectChange(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <VideoModelSelector videoModel={videoModel} setVideoModel={setVideoModel} />
      </div>
    </div>
  );

  const VideoModelSelector = ({ videoModel, setVideoModel }: { videoModel: VideoModel, setVideoModel: (m: VideoModel) => void }) => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-2">ビデオ品質 (VEO 3.1)</label>
      <div className="flex bg-gray-600 rounded-lg p-1">
        <button onClick={() => setVideoModel('veo-3.1-fast-generate-preview')} className={`flex-1 py-1 text-sm font-semibold rounded-md transition-colors ${videoModel === 'veo-3.1-fast-generate-preview' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-500'}`}>高速</button>
        <button onClick={() => setVideoModel('veo-3.1-generate-preview')} className={`flex-1 py-1 text-sm font-semibold rounded-md transition-colors ${videoModel === 'veo-3.1-generate-preview' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-500'}`}>高品質</button>
      </div>
      <p className="text-xs text-gray-500 mt-2">高品質モードは生成に時間がかかりますが、より詳細なビデオが生成されます。</p>
    </div>
  );

  const renderLipSyncToggle = () => (
    <div className="mt-4">
        <label htmlFor="lipsync-toggle" className="flex items-center justify-between cursor-pointer">
            <span className="font-medium text-gray-300">キャラクターにリップシンクさせる</span>
            <div className="relative">
                <input id="lipsync-toggle" type="checkbox" className="sr-only" checked={lipSync} onChange={() => setLipSync(!lipSync)} />
                <div className={`block w-14 h-8 rounded-full transition-colors ${lipSync ? 'bg-purple-600' : 'bg-gray-600'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${lipSync ? 'transform translate-x-6' : ''}`}></div>
            </div>
        </label>
        <p className="text-xs text-gray-500 mt-2">オンにすると、AIが楽曲に合わせた自然な口の動きを生成しようと試みます。</p>
    </div>
  );
  
  const ErrorMessage = ({ message }: { message: string }) => (
     <div className="bg-red-900/50 text-red-300 p-4 rounded-lg flex items-center space-x-3 my-4">
        <AlertTriangleIcon className="h-6 w-6" /><p>{message}</p>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            AI ミュージックビデオメーカー
          </h1>
          <p className="text-gray-400">楽曲と画像から、AIでアニメーションビデオを生成します。</p>
        </header>
        <main className="bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;