import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { fileToBase64 } from './services/geminiService';
import { parseLyrics, generatePromptsFromLyrics, generateLyricsFromTheme, generateRandomThemeAndStyle } from './utils';
import { Scene } from './types';
import FileUpload from './components/FileUpload';
import LyricsDisplay from './components/LyricsDisplay';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import { useI18n } from './i18n';
import { KeyRoundIcon, SparklesIcon, AlertTriangleIcon, FilmIcon, Wand2Icon, MusicIcon, FileImageIcon, UploadCloudIcon, ClockIcon, XIcon, ClipboardCopyIcon, CheckIcon } from './components/Icons';

type VideoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative max-w-lg mx-auto" role="alert">
    <div className="flex items-center">
      <AlertTriangleIcon className="h-5 w-5 mr-3 flex-shrink-0" />
      <span className="block sm:inline whitespace-pre-wrap text-left">{message}</span>
    </div>
  </div>
);

const SelectApiKeyScreen: React.FC<{ onSelect: () => Promise<void>; error: string; }> = ({ onSelect, error }) => {
    const { t } = useI18n();
    return (
    <div className="text-center py-10">
    <KeyRoundIcon className="h-16 w-16 mx-auto text-purple-400 mb-6" />
    <h2 className="text-2xl font-bold mb-3">{t('selectApiKeyTitle')}</h2>
    <p className="text-gray-400 mb-6 max-w-md mx-auto">{t('selectApiKeyDescription')}</p>
    
    {error && <div className="mb-6"><ErrorMessage message={error} /></div>}
    
    <button
      onClick={onSelect}
      className="w-full max-w-xs mx-auto flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1"
    >
      <SparklesIcon className="h-6 w-6 mr-2" />{t('selectApiKeyButton')}
    </button>

    <div className="text-left text-xs text-gray-500 mt-6 max-w-md mx-auto bg-gray-800/50 p-3 rounded-lg border border-gray-700">
        <h4 className="font-semibold text-gray-300 mb-2">{t('authErrorHelpTitle')}</h4>
        <ul className="list-disc list-inside space-y-1">
            <li>{t('authErrorHelp1')}</li>
            <li><span dangerouslySetInnerHTML={{ __html: t('authErrorHelp2') }} /></li>
            <li><span dangerouslySetInnerHTML={{ __html: t('authErrorHelp3') }} /></li>
        </ul>
          <p className="mt-3">
          {t('billingInfoPreLink')}
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline ml-1">
            {t('billingInfoLink')}
          </a>
          {t('billingInfoPostLink')}
        </p>
    </div>
  </div>
)};

const App: React.FC = () => {
  const { t, setLanguage, language } = useI18n();
  const [isKeySelected, setIsKeySelected] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  const [step, setStep] = useState<'upload' | 'lyrics' | 'generating' | 'finished'>('upload');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [lyrics, setLyrics] = useState<string>('');
  const [theme, setTheme] = useState<string>('');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState<boolean>(false);
  const [suggestedStyle, setSuggestedStyle] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState(0);

  const ffmpegRef = useRef<any>(null);

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
    };
    checkApiKey();
  }, []);

  const getFriendlyErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (message.includes('requested entity was not found') || (message.includes('api_key') && (message.includes('invalid') || message.includes('not found')))) {
      setIsKeySelected(false);
      return t('errorApiKeyAuth');
    }
    if (message.includes('500') || message.includes('internal') || message.includes('server error')) return t('error500');
    if (message.includes('quota')) return t('errorQuota');
    if (message.includes('fetch')) return t('errorNetwork');
    return err instanceof Error ? err.message : t('errorUnexpected');
  };
  
  const getApiKey = useCallback((): string => {
    if (typeof process === 'undefined' || !process.env || !process.env.API_KEY) {
      setError(t('errorApiKeyNotSelected'));
      setIsKeySelected(false);
      throw new Error('API_KEY_NOT_FOUND');
    }
    return process.env.API_KEY;
  }, [t]);
  
  const handleSelectApiKey = async () => {
      setError('');
      try {
        if (!window.aistudio || typeof window.aistudio.openSelectKey !== 'function') {
          throw new Error(t('errorAistudioUnavailable'));
        }
        await window.aistudio.openSelectKey();
        setIsKeySelected(true);
      } catch (e) { 
        setError(`${t('errorOpenSelectKey')} ${getFriendlyErrorMessage(e)}`);
      }
  };

  const handleFileChange = (file: File | null, type: 'audio' | 'image' | 'lyrics') => {
    if (type === 'audio') setAudioFile(file);
    if (type === 'lyrics') {
        setLyricsFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setLyrics(e.target?.result as string);
              setTheme('');
              setSuggestedStyle('');
            };
            reader.readAsText(file);
        } else {
            setLyrics('');
        }
    }
    if (type === 'image' && file) setImageFiles(prev => [...prev, file]);
  };
  
  const handleStart = () => {
    if (!audioFile || !lyrics.trim() || imageFiles.length === 0) {
      setError(t('errorMissingFiles'));
      return;
    }
    setError('');
    const parsedScenes = parseLyrics(lyrics);
    const scenesWithPlaceholders = parsedScenes.map((scene, index) => ({
      ...scene,
      id: index,
      prompt: t('promptGenerating'),
      image: imageFiles[index % imageFiles.length],
      status: 'pending' as const,
    }));
    setScenes(scenesWithPlaceholders);
    setStep('lyrics');
  };

  const generatePrompts = async () => {
    try {
      setStatusMessage(t('statusGeneratingPrompts'));
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const prompts = await generatePromptsFromLyrics(ai, scenes.map(s => s.lyric));
      const scenesWithPrompts = scenes.map((scene, index) => ({
        ...scene,
        prompt: prompts[index],
      }));
      setScenes(scenesWithPrompts);
      setStatusMessage('');
    } catch (err) {
      setError(`${t('errorPromptGeneration')} ${getFriendlyErrorMessage(err)}`);
      setStatusMessage('');
    }
  }

  useEffect(() => {
    if (step === 'lyrics' && scenes.length > 0) {
      generatePrompts();
    }
  }, [step]);
  
  const handleGenerateTheme = async () => {
    setError('');
    setIsGeneratingTheme(true);
    setSuggestedStyle('');
    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const { theme: newTheme, style: newStyle } = await generateRandomThemeAndStyle(ai, language);
      setTheme(newTheme);
      setSuggestedStyle(newStyle);
    } catch (err) {
      setError(`${t('errorThemeGeneration')} ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!theme.trim()) {
      setError(t('errorThemeInput'));
      return;
    }
    setError('');
    setIsGeneratingLyrics(true);
    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const generatedLyrics = await generateLyricsFromTheme(ai, theme, language);
      setLyrics(generatedLyrics);
      setLyricsFile(null);
    } catch (err) {
      setError(`${t('errorLyricsGeneration')} ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const handleLyricsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLyrics(e.target.value);
  };
  
  const clearGeneratedLyrics = () => {
    setLyrics('');
    setTheme('');
    setSuggestedStyle('');
  };

  const handleCopyStyle = () => {
    if (!suggestedStyle) return;
    navigator.clipboard.writeText(suggestedStyle);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const generateSingleVideo = async (scene: Scene, apiKey: string): Promise<string> => {
    const imageBase64 = await fileToBase64(scene.image);
    const ai = new GoogleGenAI({ apiKey });
    const payload = {
        model: 'veo-3.1-fast-generate-preview' as VideoModel,
        prompt: scene.prompt,
        image: { imageBytes: imageBase64, mimeType: scene.image.type },
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' as const }
    };

    let operation = await ai.models.generateVideos(payload);
    
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await new GoogleGenAI({apiKey: getApiKey()}).operations.getVideosOperation({ operation });
    }

    if (operation.error) throw new Error(operation.error.message);
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video URI not found.");

    const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!videoResponse.ok) throw new Error(`Failed to download video (status: ${videoResponse.status})`);
    
    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);
  };

  const handleGenerate = async () => {
    setStep('generating');
    setError('');
    setGenerationProgress(0);
    
    let generatedScenes: Scene[] = [];
    let completedCount = 0;

    try {
        const apiKey = getApiKey();

        for (let i = 0; i < scenes.length; i++) {
            const currentScene = scenes[i];
            
            setStatusMessage(t('statusGeneratingScene', { current: i + 1, total: scenes.length }));
            setScenes(prev => prev.map(s => s.id === currentScene.id ? { ...s, status: 'generating' } : s));

            try {
                const videoUrl = await generateSingleVideo(currentScene, apiKey);
                generatedScenes.push({ ...currentScene, videoUrl, status: 'completed' });
                completedCount++;
            } catch (err) {
                console.error(`Failed to generate video for scene ${currentScene.id}:`, err);
                generatedScenes.push({ ...currentScene, status: 'failed', error: getFriendlyErrorMessage(err) });
            }

            setScenes(prev => prev.map(s => s.id === currentScene.id ? generatedScenes.find(gs => gs.id === s.id) || s : s));
            setGenerationProgress(((i + 1) / scenes.length) * 50); // Video generation is 50% of total progress
        }

        const successfulVideos = generatedScenes.filter(s => s.status === 'completed' && s.videoUrl);
        if (successfulVideos.length === 0) {
          throw new Error(t('errorAllVideosFailed'));
        }

        setStatusMessage(t('statusCombiningVideos', { count: successfulVideos.length }));
        const { FFmpeg } = (window as any).FFmpeg;
        if (!ffmpegRef.current) {
            ffmpegRef.current = new FFmpeg();
            await ffmpegRef.current.load({
                coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"
            });
        }
        const ffmpeg = ffmpegRef.current;
        ffmpeg.on('log', ({ message }: {message: string}) => { console.log(message); });
        
        const setFFmpegProgress = (progress: number, total: number, base: number) => {
           setGenerationProgress(base + (progress / total) * (100 - base));
        };

        ffmpeg.on('progress', ({ progress }: { progress: number }) => {
          if (progress > 0) {
            setStatusMessage(`${t('statusFinalProcessing')}: ${Math.round(progress * 100)}%`);
            setFFmpegProgress(progress, 1, 50); // Assume ffmpeg is the last 50%
          }
        });
        
        const videoUrls = successfulVideos.map(s => s.videoUrl!);
        const fileNames: string[] = [];
        for(let i=0; i < videoUrls.length; i++) {
            const fileName = `input${i}.mp4`;
            fileNames.push(fileName);
            const response = await fetch(videoUrls[i]);
            const data = await response.arrayBuffer();
            await ffmpeg.writeFile(fileName, new Uint8Array(data));
        }
        
        const concatFileContent = fileNames.map(name => `file '${name}'`).join('\n');
        await ffmpeg.writeFile('concat.txt', concatFileContent);
        
        setStatusMessage(t('statusCombiningVideos', { count: successfulVideos.length }));
        await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'concatenated.mp4']);
        setGenerationProgress(75);

        setStatusMessage(t('statusAddingAudio'));
        const audioData = await audioFile!.arrayBuffer();
        await ffmpeg.writeFile('audio.mp3', new Uint8Array(audioData));
        await ffmpeg.exec(['-i', 'concatenated.mp4', '-i', 'audio.mp3', '-c:v', 'copy', '-c:a', 'aac', '-shortest', 'output.mp4']);
        setGenerationProgress(95);
        
        setStatusMessage(t('statusFinalizing'));
        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
        setFinalVideoUrl(URL.createObjectURL(blob));
        setGenerationProgress(100);

        setStep('finished');

    } catch (err) {
        setError(getFriendlyErrorMessage(err));
        setStep('upload'); 
    }
  };

  const handleRestart = () => {
    setAudioFile(null);
    setLyricsFile(null);
    setImageFiles([]);
    setLyrics('');
    setTheme('');
    setSuggestedStyle('');
    setScenes([]);
    setFinalVideoUrl('');
    setError('');
    setStatusMessage('');
    setStep('upload');
  };

  const renderStep = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Lyrics */}
              <div className="flex flex-col space-y-4">
                <div className="flex-grow flex flex-col p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-lg font-semibold text-gray-200">{t('fileLabelLyrics')}</label>
                    {lyrics && (
                      <button onClick={clearGeneratedLyrics} title={t('clearLyricsTooltip')} className="text-gray-500 hover:text-red-400 transition-colors">
                        <XIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                   <FileUpload
                       label=""
                       acceptedTypes=".txt,.lrc"
                       file={lyricsFile}
                       onFileChange={(file) => handleFileChange(file, 'lyrics')}
                       Icon={UploadCloudIcon}
                   />
                  <textarea
                      value={lyrics}
                      onChange={handleLyricsChange}
                      placeholder={t('lyricsPlaceholder')}
                      className="flex-grow w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500 mt-4 min-h-[200px]"
                  />
                </div>
                
                <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <h2 className="text-xl font-semibold text-center mb-2 text-gray-200">{t('noLyricsTitle')}</h2>
                  <p className="text-center text-gray-400 mb-5">{t('noLyricsSubtitle')}</p>
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                    <button
                      onClick={handleGenerateTheme}
                      disabled={isGeneratingTheme || isGeneratingLyrics}
                      className="w-full sm:w-auto flex items-center justify-center font-semibold py-2 px-5 rounded-lg transition-all duration-300 bg-gradient-to-r from-teal-400 to-blue-500 hover:from-teal-500 hover:to-blue-600 shadow-lg hover:shadow-blue-500/50 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                    >
                      {isGeneratingTheme ? (
                        <><ClockIcon className="h-5 w-5 mr-2 animate-spin" />{t('thinking')}</>
                      ) : (
                        <><SparklesIcon className="h-5 w-5 mr-2" />{t('aiChoice')}</>
                      )}
                    </button>
                    <span className="text-gray-500 hidden sm:block">{t('or')}</span>
                     <input
                      type="text"
                      value={theme}
                      onChange={(e) => { setTheme(e.target.value); setSuggestedStyle(''); }}
                      placeholder={t('themePlaceholder')}
                      className="flex-grow w-full sm:w-auto bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500"
                      disabled={isGeneratingTheme || isGeneratingLyrics}
                    />
                  </div>
                   {suggestedStyle && (
                      <div className="mt-5 text-center bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                          <h4 className="text-sm font-semibold text-purple-300 mb-2">{t('sunoStyleSuggestion')}</h4>
                          <div className="flex items-center justify-center gap-3">
                            <p className="text-gray-300 text-sm italic">{suggestedStyle}</p>
                            <button onClick={handleCopyStyle} title={t('copyStyleTooltip')} className="flex-shrink-0 flex items-center text-xs py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">
                              {copySuccess ? (
                                <><CheckIcon className="h-4 w-4 mr-1 text-green-400"/>{t('copied')}</>
                              ) : (
                                <><ClipboardCopyIcon className="h-4 w-4 mr-1"/>{t('copy')}</>
                              )}
                            </button>
                          </div>
                      </div>
                  )}
                  {theme && (
                    <div className="mt-5 text-center">
                        <button
                          onClick={handleGenerateLyrics}
                          disabled={isGeneratingLyrics || isGeneratingTheme}
                          className="w-full sm:w-auto flex items-center justify-center font-semibold py-2 px-5 rounded-lg transition-all duration-300 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 shadow-lg hover:shadow-orange-500/50 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                        >
                          {isGeneratingLyrics ? (
                            <><ClockIcon className="h-5 w-5 mr-2 animate-spin" />{t('generatingLyrics')}</>
                          ) : (
                            <><Wand2Icon className="h-5 w-5 mr-2" />{t('generateLyricsButton')}</>
                          )}
                        </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Media */}
              <div className="space-y-6 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div>
                    <label className="block text-lg font-semibold text-gray-200 mb-2">{t('fileLabelAudio')}</label>
                     <FileUpload
                        label=""
                        acceptedTypes="audio/*"
                        file={audioFile}
                        onFileChange={(file) => handleFileChange(file, 'audio')}
                        Icon={MusicIcon}
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-semibold text-gray-200 mb-2">{t('fileLabelImages')}</label>
                    <FileUpload
                        label=""
                        acceptedTypes="image/*"
                        files={imageFiles}
                        onFileChange={(file) => handleFileChange(file, 'image')}
                        Icon={FileImageIcon}
                        multiple
                    />
                  </div>
              </div>
            </div>

            <div className="mt-10 text-center">
                <button
                    onClick={handleStart}
                    disabled={!audioFile || !lyrics.trim() || imageFiles.length === 0}
                    className="w-full max-w-sm mx-auto flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                    <FilmIcon className="h-6 w-6 mr-2" />
                    {t('startGenerationButton')}
                </button>
            </div>
          </div>
        );
      case 'lyrics':
        return <LyricsDisplay scenes={scenes} setScenes={setScenes} onContinue={handleGenerate} onBack={() => setStep('upload')} statusMessage={statusMessage} />;
      case 'generating':
        return <Loader statusMessage={statusMessage} progress={generationProgress} scenes={scenes} />;
      case 'finished':
        return <VideoResult videoUrl={finalVideoUrl} onRestart={handleRestart} />;
      default:
        return null;
    }
  };
  
  if (!isKeySelected) {
    return <SelectApiKeyScreen onSelect={handleSelectApiKey} error={error} />;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-8">
       <header className="container mx-auto mb-8">
         <div className="flex justify-between items-start">
             <div className="text-left">
                 <div className="flex items-center gap-2">
                     <FilmIcon className="h-8 w-8 text-purple-400" />
                     <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                       {t('appTitle')}
                     </h1>
                 </div>
                 <p className="mt-3 text-gray-400 max-w-2xl">{t('appSubtitle')}</p>
             </div>
             <div className="flex gap-2 flex-shrink-0">
               <button
                 onClick={() => setLanguage('ja')}
                 className={`py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                   language === 'ja'
                     ? 'bg-purple-600 text-white shadow'
                     : 'bg-gray-700 hover:bg-gray-600'
                 }`}
               >
                 日本語
               </button>
               <button
                 onClick={() => setLanguage('en')}
                 className={`py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                   language === 'en'
                     ? 'bg-purple-600 text-white shadow'
                     : 'bg-gray-700 hover:bg-gray-600'
                 }`}
               >
                 English
               </button>
             </div>
         </div>
       </header>

      <main className="container mx-auto">
        {error && <div className="mb-6"><ErrorMessage message={error} /></div>}
        {renderStep()}
      </main>

       <footer className="text-center mt-12 text-sm text-gray-500">
          <p>{t('footerPoweredBy')}</p>
      </footer>
    </div>
  );
};

export default App;