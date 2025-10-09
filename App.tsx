import React, { useState, useCallback, useEffect } from 'react';
import { AppStatus, AppMode, GenerationStep } from './types';
import { generateMusicVideo, fileToBase64, generateLyrics, generateTheme, generateImagePrompt, generateImage, generateAnimationPrompt } from './services/geminiService';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import { SparklesIcon, AlertTriangleIcon, Wand2Icon, MusicIcon, FileImageIcon, FilmIcon, UploadCloudIcon, ClipboardCopyIcon, ExternalLinkIcon } from './components/Icons';

const cameraWorkOptions = {
  '': 'なし',
  'slow zoom in': 'ズームイン',
  'slow zoom out': 'ズームアウト',
  'pan from left to right': 'パン（左から右へ）',
  'pan from right to left': 'パン（右から左へ）',
  'slow rotation clockwise': 'ゆっくりと回転',
};

const effectOptions = {
  'sparkling lights': 'キラキラ光る',
  'neon glow': 'ネオン',
  'confetti falling': '紙吹雪',
  'petals blowing in the wind': '風に舞う花びら',
};

const App: React.FC = () => {
  // Common states
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<AppMode>(AppMode.SELECT);

  // File & Prompt states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [motionPrompt, setMotionPrompt] = useState<string>('');
  const [cameraWork, setCameraWork] = useState<string>('');
  const [effects, setEffects] = useState<string[]>([]);
  const [lipSync, setLipSync] = useState<boolean>(true);

  // Result states
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [audioObjectUrl, setAudioObjectUrl] = useState<string>('');
  
  // Generation flow states
  const [step, setStep] = useState<GenerationStep>(GenerationStep.LYRICS);
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [lyricTheme, setLyricTheme] = useState<string>('');
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [generatedMusicStyle, setGeneratedMusicStyle] = useState<string>('');
  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState<boolean>(false);

  // Image generation states
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isGeneratingImagePrompt, setIsGeneratingImagePrompt] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [isGeneratingAnimationPrompt, setIsGeneratingAnimationPrompt] = useState<boolean>(false);


  const handleGenerateVideo = useCallback(async () => {
    const selectedImageBase64 = imageFile ? null : (selectedImageIndex !== null ? generatedImages[selectedImageIndex] : null);
    const imageSourceAvailable = imageFile || selectedImageBase64;

    if (!imageSourceAvailable || !motionPrompt) {
      setError('画像とアニメーションの指示の両方が必要です。');
      setStatus(AppStatus.ERROR);
      return;
    }

    setStatus(AppStatus.LOADING);
    setError('');

    try {
      const promptParts = [motionPrompt];
      // Prepend camera work and effects to give them priority.
      if (effects.length > 0) {
        promptParts.unshift(...effects);
      }
      if (cameraWork) {
        promptParts.unshift(cameraWork);
      }
      
      let finalPrompt = promptParts.join(', ');
      
      if (lipSync) finalPrompt += ", the character is singing passionately, with mouth movements synced to the rhythm of a song.";
      
      const imageBase64 = imageFile ? await fileToBase64(imageFile) : selectedImageBase64!;
      const imageMimeType = imageFile ? imageFile.type : 'image/png';

      const videoUrl = await generateMusicVideo(finalPrompt, imageBase64, imageMimeType);
      setGeneratedVideoUrl(videoUrl);
      if (audioFile) {
        setAudioObjectUrl(URL.createObjectURL(audioFile));
      }
      setStatus(AppStatus.SUCCESS);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'ビデオの生成中に不明なエラーが発生しました。');
      setStatus(AppStatus.ERROR);
    }
  }, [imageFile, generatedImages, selectedImageIndex, motionPrompt, audioFile, lipSync, cameraWork, effects]);

  const handleGenerateTheme = async () => {
    setIsGeneratingTheme(true);
    setError('');
    try {
        const theme = await generateTheme(language);
        setLyricTheme(theme);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'テーマの生成中にエラーが発生しました。');
    } finally {
        setIsGeneratingTheme(false);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!lyricTheme) {
        setError('歌詞のテーマを入力してください。');
        return;
    }
    setIsGeneratingLyrics(true);
    setError('');
    try {
        const { title, style, lyrics } = await generateLyrics(lyricTheme, language);
        setGeneratedTitle(title);
        setGeneratedMusicStyle(style);
        setGeneratedLyrics(lyrics);
        setStep(GenerationStep.MUSIC);
    } catch (err) {
        setError(err instanceof Error ? err.message : '歌詞の生成中にエラーが発生しました。');
    } finally {
        setIsGeneratingLyrics(false);
    }
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
    setGeneratedVideoUrl('');
    setAudioObjectUrl('');
    setStep(GenerationStep.LYRICS);
    setLanguage('ja');
    setLyricTheme('');
    setGeneratedLyrics('');
    setGeneratedTitle('');
    setGeneratedMusicStyle('');
    setImagePrompt('');
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    setIsGeneratingImage(false);
    setIsGeneratingImagePrompt(false);
    setIsGeneratingAnimationPrompt(false);
    if (generatedVideoUrl) URL.revokeObjectURL(generatedVideoUrl);
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  };

  const handleEffectChange = (effect: string) => {
    setEffects(prev => 
      prev.includes(effect) 
        ? prev.filter(e => e !== effect)
        : [...prev, effect]
    );
  };

  const renderContent = () => {
    if (status === AppStatus.LOADING) return <Loader />;
    if (status === AppStatus.SUCCESS && generatedVideoUrl) {
      return <VideoResult videoUrl={generatedVideoUrl} audioUrl={audioObjectUrl} onReset={handleReset} />;
    }

    switch (mode) {
      case AppMode.SELECT:
        return <ModeSelectionScreen onSelectMode={setMode} />;
      case AppMode.UPLOAD:
        return <UploadFlow />;
      case AppMode.GENERATE:
        return <GenerateFlow />;
      default:
        return <ModeSelectionScreen onSelectMode={setMode} />;
    }
  };
  
  const ModeSelectionScreen: React.FC<{onSelectMode: (mode: AppMode) => void}> = ({ onSelectMode }) => (
    <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">制作方法を選択してください</h2>
        <p className="text-gray-400 mb-8">どちらの方法でも素晴らしいビデオが作れます！</p>
        <div className="grid md:grid-cols-2 gap-6">
            <button onClick={() => onSelectMode(AppMode.GENERATE)} className="bg-gray-700/80 p-8 rounded-2xl hover:bg-purple-900/50 border border-gray-600 hover:border-purple-500 transition-all transform hover:-translate-y-1">
                <Wand2Icon className="h-12 w-12 mx-auto text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">AIでゼロから作る</h3>
                <p className="text-gray-400 text-sm">テーマを入力して、AIに歌詞・画像を生成してもらい、まったく新しいミュージックビデオを制作します。</p>
            </button>
            <button onClick={() => onSelectMode(AppMode.UPLOAD)} className="bg-gray-700/80 p-8 rounded-2xl hover:bg-pink-900/50 border border-gray-600 hover:border-pink-500 transition-all transform hover:-translate-y-1">
                <UploadCloudIcon className="h-12 w-12 mx-auto text-pink-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">ファイルを持ち込む</h3>
                <p className="text-gray-400 text-sm">お手持ちの楽曲と画像ファイルを使って、ミュージックビデオを制作します。（既存の機能）</p>
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
                <FileUpload label="① 楽曲をアップロード" acceptedTypes="audio/mpeg,audio/wav" file={audioFile} onFileChange={setAudioFile} isAudio={true} />
                <FileUpload label="② 画像をアップロード" acceptedTypes="image/png,image/jpeg" file={imageFile} onFileChange={setImageFile} />
            </div>
            <div>
                <label htmlFor="upload-prompt" className="block text-sm font-medium text-gray-300 mb-2">③ アニメーションの指示を入力 (プロンプト)</label>
                <textarea id="upload-prompt" value={motionPrompt} onChange={(e) => setMotionPrompt(e.target.value)} placeholder="例：口を大きく開けて情熱的に歌っている。背景にはサイバーパンクな街並み。" rows={4} className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
            </div>
            {renderAnimationOptions()}
            {renderLipSyncToggle()}
            {status === AppStatus.ERROR && error && <ErrorMessage message={error} />}
            <button onClick={handleGenerateVideo} disabled={isGenerateDisabled} className={`w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 ${isGenerateDisabled ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1'}`}>
                <SparklesIcon className="h-6 w-6 mr-2" />
                ビデオを生成する
            </button>
        </div>
    );
  };
  
  const GenerateFlow = () => {
    const handleGenerateImagePrompt = async () => {
        setIsGeneratingImagePrompt(true);
        setError('');
        try {
            const prompt = await generateImagePrompt(generatedLyrics, generatedMusicStyle, language);
            setImagePrompt(prompt);
        } catch (err) {
            setError(err instanceof Error ? err.message : '画像プロンプトの生成中にエラーが発生しました。');
        } finally {
            setIsGeneratingImagePrompt(false);
        }
    };
    
    const handleGenerateImage = async () => {
        if (!imagePrompt) {
            setError('画像生成用のプロンプトを入力してください。');
            return;
        }
        setIsGeneratingImage(true);
        setGeneratedImages([]);
        setSelectedImageIndex(null);
        setError('');
        try {
            const promptWithVariety = `${imagePrompt}, multiple images from different camera angles (front, side, three-quarter view)`;
            const imageBase64s = await generateImage(promptWithVariety, 3);
            setGeneratedImages(imageBase64s);
        } catch (err) {
            setError(err instanceof Error ? err.message : '画像の生成中にエラーが発生しました。');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleGenerateAnimationPrompt = async () => {
        setIsGeneratingAnimationPrompt(true);
        setError('');
        try {
            const prompt = await generateAnimationPrompt(generatedLyrics, generatedMusicStyle, language);
            setMotionPrompt(prompt);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'アニメーションプロンプトの生成中にエラーが発生しました。');
        } finally {
            setIsGeneratingAnimationPrompt(false);
        }
    };

    useEffect(() => {
        if (step === GenerationStep.IMAGE && !imagePrompt && generatedImages.length === 0 && generatedLyrics) {
            handleGenerateImagePrompt();
        }
    }, [step, generatedLyrics, imagePrompt, generatedImages]);

    useEffect(() => {
        if (step === GenerationStep.ANIMATION && !motionPrompt && generatedLyrics) {
            handleGenerateAnimationPrompt();
        }
    }, [step, motionPrompt, generatedLyrics]);

    const renderStepContent = () => {
        switch(step) {
            case GenerationStep.LYRICS:
                return (
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
                            <button
                                onClick={handleGenerateTheme}
                                disabled={isGeneratingTheme}
                                className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                <Wand2Icon className="h-4 w-4 mr-1" />
                                {isGeneratingTheme ? '生成中...' : 'テーマをAIに考えてもらう'}
                            </button>
                        </div>

                        <textarea id="lyric-theme" value={lyricTheme} onChange={(e) => setLyricTheme(e.target.value)} placeholder="例：雨上がりの虹、未来への希望、夏の終わりの切なさ" rows={3} className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition mb-4"/>
                        {status === AppStatus.ERROR && error && <ErrorMessage message={error} />}
                        <button onClick={handleGenerateLyrics} disabled={isGeneratingLyrics || !lyricTheme} className={`w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all ${!lyricTheme || isGeneratingLyrics ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}>
                            {isGeneratingLyrics ? '生成中...' : <><SparklesIcon className="h-5 w-5 mr-2" />歌詞を生成する</>}
                        </button>
                    </div>
                );
            case GenerationStep.MUSIC:
                return (
                    <div>
                        <h3 className="text-xl font-semibold mb-2">② 楽曲を作成＆アップロード</h3>
                        <p className="text-gray-400 mb-6">
                            AIが生成したタイトルと歌詞を使って、Suno AIで楽曲を作成しましょう。
                            完成したら、音声ファイルをダウンロードして、ここにアップロードしてください。
                        </p>
                        <div className="bg-gray-900/50 p-4 rounded-lg mb-6 border border-gray-700">
                          <h4 className="font-semibold text-purple-300 mb-3">楽曲作成ガイド</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                              <li>下のボタンからSuno AIを開き、生成された歌詞などを貼り付けて曲を作成します。</li>
                              <li>完成した楽曲をMP3形式などでダウンロードします。</li>
                              <li>この画面に戻り、下のエリアからダウンロードしたファイルをアップロードします。</li>
                          </ol>
                        </div>
                        <a 
                          href="https://suno.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full mb-8 flex items-center justify-center font-semibold py-3 px-4 rounded-lg transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/50"
                        >
                          Suno AI で楽曲を作成する
                          <ExternalLinkIcon className="h-5 w-5 ml-2" />
                        </a>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs text-purple-400 font-semibold tracking-wider mb-1">TITLE</label>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={generatedTitle} onChange={e => setGeneratedTitle(e.target.value)} className="flex-grow w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
                                    <button onClick={() => navigator.clipboard.writeText(generatedTitle)} title="タイトルをコピー" className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg"><ClipboardCopyIcon className="h-5 w-5" /></button>
                                </div>
                            </div>
                             <div>
                                <label className="block text-xs text-purple-400 font-semibold tracking-wider mb-1">MUSIC STYLE</label>
                                 <div className="flex items-center gap-2">
                                    <input type="text" value={generatedMusicStyle} onChange={e => setGeneratedMusicStyle(e.target.value)} className="flex-grow w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
                                    <button onClick={() => navigator.clipboard.writeText(generatedMusicStyle)} title="音楽スタイルをコピー" className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg"><ClipboardCopyIcon className="h-5 w-5" /></button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-purple-400 font-semibold tracking-wider mb-1">LYRICS</label>
                                <textarea value={generatedLyrics} onChange={e => setGeneratedLyrics(e.target.value)} rows={12} className="w-full bg-gray-900/50 border-gray-600 rounded-lg p-4 text-base font-sans whitespace-pre-wrap leading-relaxed focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
                                <button onClick={() => navigator.clipboard.writeText(generatedLyrics)} className="w-full mt-2 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg text-sm">歌詞をコピー</button>
                            </div>
                        </div>

                        <FileUpload label="完成した楽曲ファイルをアップロード" acceptedTypes="audio/mpeg,audio/wav" file={audioFile} onFileChange={(file) => { setAudioFile(file); if (file) setStep(GenerationStep.IMAGE); }} isAudio={true} />
                    </div>
                );
            case GenerationStep.IMAGE:
                 return (
                    <div>
                        <h3 className="text-xl font-semibold mb-2">③ 画像を生成</h3>
                        <p className="text-gray-400 mb-4">歌詞の雰囲気に合った、リアルなアバター画像をAIで生成します。好きなアングルを1枚選んでください。</p>
                        
                        <div className="flex justify-between items-center mb-2">
                             <label htmlFor="image-prompt" className="block text-sm font-medium text-gray-400">画像生成プロンプト (英語)</label>
                            <button onClick={handleGenerateImagePrompt} disabled={isGeneratingImagePrompt} className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center disabled:text-gray-500 disabled:cursor-not-allowed">
                                <Wand2Icon className="h-4 w-4 mr-1" />
                                {isGeneratingImagePrompt ? '生成中...' : 'プロンプトを再生成'}
                            </button>
                        </div>
                        <textarea id="image-prompt" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="AIが歌詞を基にプロンプトを生成します..." rows={4} className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition mb-4"/>
                        
                        <button onClick={handleGenerateImage} disabled={isGeneratingImage || !imagePrompt} className={`w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all mb-4 ${!imagePrompt || isGeneratingImage ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}>
                            {isGeneratingImage ? '生成中...' : <><SparklesIcon className="h-5 w-5 mr-2" />画像を生成する (3枚)</>}
                        </button>

                        {isGeneratingImage && (
                            <div className="grid grid-cols-3 gap-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="w-full aspect-square bg-gray-700/50 rounded-lg flex items-center justify-center animate-pulse">
                                        <FileImageIcon className="w-10 h-10 text-gray-500" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {generatedImages.length > 0 && !isGeneratingImage && (
                           <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    {generatedImages.map((imageBase64, index) => (
                                        <button key={index} onClick={() => setSelectedImageIndex(index)} className={`rounded-lg overflow-hidden focus:outline-none transition-all transform hover:scale-105 ${selectedImageIndex === index ? 'ring-4 ring-purple-500 shadow-lg' : 'ring-2 ring-transparent'}`}>
                                            <img src={`data:image/png;base64,${imageBase64}`} alt={`Generated visual ${index + 1}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                             <button onClick={() => setStep(GenerationStep.ANIMATION)} disabled={selectedImageIndex === null} className={`w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all ${selectedImageIndex === null ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
                                 この画像で決定して次へ
                             </button>
                           </div>
                        )}
                        
                        {status === AppStatus.ERROR && error && <ErrorMessage message={error} />}
                    </div>
                 );
            case GenerationStep.ANIMATION:
                const isGenerateDisabled = selectedImageIndex === null || !motionPrompt;
                return (
                    <div>
                        <h3 className="text-xl font-semibold mb-2">④ アニメーションの設定</h3>
                        <p className="text-gray-400 mb-4">最後の仕上げです！キャラクターにどんな動きをさせるかAIに指示しましょう。</p>

                        {selectedImageIndex !== null && (
                          <div className="mb-6">
                            <p className="text-sm font-medium text-gray-300 mb-2 text-center">使用する画像</p>
                            <img src={`data:image/png;base64,${generatedImages[selectedImageIndex]}`} alt="Selected visual" className="w-full max-w-sm mx-auto rounded-lg shadow-md" />
                          </div>
                        )}

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="generate-prompt" className="block text-sm font-medium text-gray-300">アニメーションの指示 (プロンプト)</label>
                                <button onClick={handleGenerateAnimationPrompt} disabled={isGeneratingAnimationPrompt} className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center disabled:text-gray-500 disabled:cursor-not-allowed">
                                    <Wand2Icon className="h-4 w-4 mr-1" />
                                    {isGeneratingAnimationPrompt ? '生成中...' : 'プロンプトを再生成'}
                                </button>
                            </div>
                            <textarea id="generate-prompt" value={motionPrompt} onChange={(e) => setMotionPrompt(e.target.value)} placeholder="AIが歌詞を基にプロンプトを生成します..." rows={4} className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" />
                        </div>
                        <div className="mt-4 space-y-4">
                            {renderAnimationOptions()}
                            {renderLipSyncToggle()}
                        </div>
                         {status === AppStatus.ERROR && error && <ErrorMessage message={error} />}
                        <button onClick={handleGenerateVideo} disabled={isGenerateDisabled} className={`w-full mt-6 flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 ${isGenerateDisabled ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1'}`}>
                            <SparklesIcon className="h-6 w-6 mr-2" />
                            ビデオを生成する
                        </button>
                    </div>
                );
        }
    }
    
    const steps = [
        {name: '歌詞', icon: Wand2Icon},
        {name: '楽曲', icon: MusicIcon},
        {name: '画像', icon: FileImageIcon},
        {name: 'アニメ', icon: FilmIcon}
    ];

    return (
        <div>
            <button onClick={() => setMode(AppMode.SELECT)} className="text-sm text-gray-400 hover:text-white transition-colors mb-4">&lt; モード選択に戻る</button>
             <div className="mb-8">
                <ol className="flex items-center w-full">
                    {steps.map((s, index) => (
                        <li key={s.name} className={`flex w-full items-center ${index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ''} ${index <= step ? 'text-purple-400 after:border-purple-600' : 'text-gray-500 after:border-gray-700'}`}>
                           <span className={`flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 ${index <= step ? 'bg-purple-800' : 'bg-gray-700'}`}>
                               <s.icon className="w-5 h-5 lg:w-6 lg:h-6" />
                           </span>
                        </li>
                    ))}
                </ol>
            </div>
            {renderStepContent()}
        </div>
    );
  };
  
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
      </div>
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
        <p className="text-xs text-gray-500 mt-2">オンにすると、AIに口の動きを意識させるプロンプトが追加されます。より良い結果を得るために、プロンプトでも口の動きを具体的に指示することをお勧めします。</p>
    </div>
  );
  
  const ErrorMessage: React.FC<{message: string}> = ({ message }) => (
     <div className="bg-red-900/50 text-red-300 p-4 rounded-lg flex items-center space-x-3 mt-4">
        <AlertTriangleIcon className="h-6 w-6" />
        <p>{message}</p>
      </div>
  );


  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            AI ミュージックビデオメーカー
          </h1>
          <p className="text-gray-400">
            楽曲と画像から、AIでアニメーションビデオを生成します。
          </p>
        </header>

        <main className="bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
