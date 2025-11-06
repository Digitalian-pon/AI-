import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { fileToBase64 } from './services/geminiService';
import { parseLyrics, generatePromptsForScenes, generateLyricsFromTheme, generateRandomThemeAndStyle, generateTitleFromLyrics } from './utils';
import { Scene } from './types';
import FileUpload from './components/FileUpload';
import LyricsDisplay from './components/LyricsDisplay';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import SettingsModal from './components/SettingsModal';
import { useI18n } from './i18n';
import { KeyRoundIcon, SparklesIcon, AlertTriangleIcon, FilmIcon, Wand2Icon, MusicIcon, FileImageIcon, UploadCloudIcon, ClockIcon, XIcon, ClipboardCopyIcon, CheckIcon, SettingsIcon, ArrowRightIcon, PenSquareIcon } from './components/Icons';

type VideoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';
type AppStep = 'welcome' | 'prepareLyrics' | 'uploadMedia' | 'review' | 'generating' | 'result';

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
  
  const [step, setStep] = useState<AppStep>('welcome');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [lyrics, setLyrics] = useState<string>('');
  const [theme, setTheme] = useState<string>(''); 
  const [title, setTitle] = useState<string>(''); 
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState<boolean>(false);
  const [suggestedStyle, setSuggestedStyle] = useState<string>('');
  const [styleCopySuccess, setStyleCopySuccess] = useState<boolean>(false);
  const [lyricsCopySuccess, setLyricsCopySuccess] = useState<boolean>(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState(0);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [delay, setDelay] = useState(0);

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
            reader.onload = (e) => setLyrics(e.target?.result as string);
            reader.readAsText(file);
        } else {
            setLyrics('');
        }
    }
    if (type === 'image' && file) setImageFiles(prev => [...prev, file]);
  };
  
  const handleGoToReview = async () => {
    if (!audioFile || !lyrics.trim() || imageFiles.length === 0) {
      setError(t('errorMissingFiles'));
      return;
    }
    setError('');
    
    let currentTitle = title;
    if (!currentTitle.trim()) {
      try {
        setStatusMessage(t('statusGeneratingTitle'));
        setIsGeneratingTitle(true);
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const newTitle = await generateTitleFromLyrics(ai, lyrics, language);
        setTitle(newTitle);
        currentTitle = newTitle;
      } catch(err) {
         setError(`${t('errorTitleGeneration')} ${getFriendlyErrorMessage(err)}`);
         setStatusMessage('');
         setIsGeneratingTitle(false);
         return;
      } finally {
        setStatusMessage('');
        setIsGeneratingTitle(false);
      }
    }

    const parsedScenes = parseLyrics(lyrics);
    const scenesWithPlaceholders = parsedScenes.map((scene, index) => ({
      ...scene,
      id: index,
      prompt: t('promptGenerating'),
      image: imageFiles[index % imageFiles.length],
      status: 'pending' as const,
      lipSync: true,
    }));
    setScenes(scenesWithPlaceholders);
    setStep('review');
  };

  const generatePrompts = async () => {
    try {
      setStatusMessage(t('statusGeneratingPrompts'));
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const prompts = await generatePromptsForScenes(ai, scenes, title);
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
    if (step === 'review' && scenes.length > 0 && scenes[0].prompt === t('promptGenerating')) {
      generatePrompts();
    }
  }, [step, scenes, t, title]);
  
  const handleGenerateTheme = async () => {
    setError('');
    setIsGeneratingTitle(true);
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
      setIsGeneratingTitle(false);
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
      setTitle('');
    } catch (err) {
      setError(`${t('errorLyricsGeneration')} ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const handleCopyStyle = () => {
    if (!suggestedStyle) return;
    navigator.clipboard.writeText(suggestedStyle);
    setStyleCopySuccess(true);
    setTimeout(() => setStyleCopySuccess(false), 2000);
  };
  
    const handleRegeneratePrompt = async (sceneId: number) => {
    const sceneToRegenerate = scenes.find(s => s.id === sceneId);
    if (!sceneToRegenerate) return;
    setError('');
    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const [newPrompt] = await generatePromptsForScenes(ai, [sceneToRegenerate], title);
      
      setScenes(prevScenes => 
        prevScenes.map(s => 
          s.id === sceneId ? { ...s, prompt: newPrompt } : s
        )
      );
    } catch (err) {
      setError(`${t('errorPromptGeneration')} ${getFriendlyErrorMessage(err)}`);
    }
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
            
            if (delay > 0 && i > 0) {
              setStatusMessage(t('statusWaiting', { delay: (delay / 60000).toFixed(1) }));
              await new Promise(resolve => setTimeout(resolve, delay));
            }

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

        setStep('result');

    } catch (err) {
        setError(getFriendlyErrorMessage(err));
        setStep('welcome'); 
    }
  };

  const handleRestart = () => {
    setAudioFile(null);
    setLyricsFile(null);
    setImageFiles([]);
    setLyrics('');
    setTheme('');
    setTitle('');
    setSuggestedStyle('');
    setScenes([]);
    setFinalVideoUrl('');
    setError('');
    setStatusMessage('');
    setStep('welcome');
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
            <div className="text-center max-w-2xl mx-auto py-16">
                <h2 className="text-3xl font-bold mb-4">{t('welcomeTitle')}</h2>
                <p className="text-gray-400 mb-10">{t('welcomeSubtitle')}</p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center">
                    <button onClick={() => setStep('prepareLyrics')} className="group flex-1 flex flex-col items-center justify-center p-8 bg-gray-800/50 hover:bg-purple-900/40 border border-gray-700 hover:border-purple-500 rounded-lg transition-all duration-300 transform hover:-translate-y-1">
                        <Wand2Icon className="h-12 w-12 mb-4 text-purple-400 group-hover:text-white transition-colors" />
                        <h3 className="text-xl font-semibold mb-2">{t('welcomeButtonAI')}</h3>
                        <p className="text-gray-400 text-sm">{t('welcomeDescAI')}</p>
                    </button>
                    <button onClick={() => setStep('uploadMedia')} className="group flex-1 flex flex-col items-center justify-center p-8 bg-gray-800/50 hover:bg-pink-900/40 border border-gray-700 hover:border-pink-500 rounded-lg transition-all duration-300 transform hover:-translate-y-1">
                        <UploadCloudIcon className="h-12 w-12 mb-4 text-pink-400 group-hover:text-white transition-colors" />
                        <h3 className="text-xl font-semibold mb-2">{t('welcomeButtonManual')}</h3>
                        <p className="text-gray-400 text-sm">{t('welcomeDescManual')}</p>
                    </button>
                </div>
            </div>
        );
      case 'prepareLyrics':
        return (
          <div className="max-w-2xl mx-auto">
             <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex justify-between items-center">
                     <h2 className="text-2xl font-semibold text-center mb-2 text-gray-200">{t('prepareLyricsTitle')}</h2>
                     <button onClick={() => setStep('welcome')} className="text-gray-400 hover:text-white">&larr; {t('backButton')}</button>
                  </div>
                  <p className="text-center text-gray-400 mb-5">{t('prepareLyricsSubtitle')}</p>
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                    <button
                      onClick={handleGenerateTheme}
                      disabled={isGeneratingTitle || isGeneratingLyrics}
                      className="w-full sm:w-auto flex items-center justify-center font-semibold py-2 px-5 rounded-lg transition-all duration-300 bg-gradient-to-r from-teal-400 to-blue-500 hover:from-teal-500 hover:to-blue-600 shadow-lg hover:shadow-blue-500/50 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                    >
                      {isGeneratingTitle ? (
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
                      disabled={isGeneratingTitle || isGeneratingLyrics}
                    />
                  </div>
                   {suggestedStyle && (
                      <div className="mt-5 text-center bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                          <h4 className="text-sm font-semibold text-purple-300 mb-2">{t('sunoStyleSuggestion')}</h4>
                          <div className="flex items-center justify-center gap-3">
                            <p className="text-gray-300 text-sm italic">{suggestedStyle}</p>
                            <button onClick={handleCopyStyle} title={t('copyStyleTooltip')} className="flex-shrink-0 flex items-center text-xs py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">
                              {styleCopySuccess ? (
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
                          disabled={isGeneratingLyrics || isGeneratingTitle}
                          className="w-full sm:w-auto flex items-center justify-center font-semibold py-2 px-5 rounded-lg transition-all duration-300 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 shadow-lg hover:shadow-orange-500/50 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                        >
                          {isGeneratingLyrics ? (
                            <><ClockIcon className="h-5 w-5 mr-2 animate-spin" />{t('generatingLyrics')}</>
                          ) : (
                            <><PenSquareIcon className="h-5 w-5 mr-2" />{t('generateLyricsButton')}</>
                          )}
                        </button>
                    </div>
                  )}
                  {lyrics && !isGeneratingLyrics && (
                     <div className="mt-8 text-center border-t border-gray-700 pt-6">
                        <h3 className="text-lg font-semibold text-green-400 mb-2">{t('lyricsGeneratedSuccessTitle')}</h3>
                        <p className="text-gray-400 mb-6">{t('lyricsGeneratedSuccessDesc')}</p>
                         <button
                            onClick={() => setStep('uploadMedia')}
                            className="w-full max-w-xs mx-auto flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1"
                        >
                             {t('nextStepButton')} <ArrowRightIcon className="h-5 w-5 ml-2" />
                        </button>
                     </div>
                  )}
                </div>
          </div>
        );
      case 'uploadMedia':
        return (
          <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold">{t('uploadMediaTitle')}</h2>
                <p className="text-gray-400">{t('uploadMediaSubtitle')}</p>
              </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg flex flex-col">
                <label className="block text-lg font-semibold text-gray-200">{t('fileLabelLyrics')}</label>
                 <FileUpload
                     label=""
                     acceptedTypes=".txt,.lrc"
                     file={lyricsFile}
                     onFileChange={(file) => handleFileChange(file, 'lyrics')}
                     Icon={UploadCloudIcon}
                 />
                 <div className="relative flex-grow flex flex-col mt-4">
                    <textarea
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                        placeholder={t('lyricsPlaceholder')}
                        className="flex-grow w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500 min-h-[200px]"
                    />
                  </div>
              </div>

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
                    onClick={handleGoToReview}
                    disabled={!audioFile || !lyrics.trim() || imageFiles.length === 0 || isGeneratingTitle}
                    className="w-full max-w-sm mx-auto flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                    {isGeneratingTitle ?
                        <><ClockIcon className="h-6 w-6 mr-2 animate-spin" /> {t('statusGeneratingTitle')}</> :
                        <>{t('reviewScenesButton')} <ArrowRightIcon className="h-5 w-5 ml-2" /></>
                    }
                </button>
            </div>
          </div>
        );
      case 'review':
        return <LyricsDisplay title={title} scenes={scenes} setScenes={setScenes} onContinue={handleGenerate} onBack={() => setStep('uploadMedia')} statusMessage={statusMessage} onRegeneratePrompt={handleRegeneratePrompt} />;
      case 'generating':
        return <Loader title={title} statusMessage={statusMessage} progress={generationProgress} scenes={scenes} />;
      case 'result':
        return <VideoResult title={title} videoUrl={finalVideoUrl} onRestart={handleRestart} />;
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
             <div className="flex gap-2 flex-shrink-0 items-center">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-md text-sm font-semibold transition-colors bg-gray-700 hover:bg-gray-600"
                  title={t('settingsTitle')}
                >
                  <SettingsIcon className="h-5 w-5" />
                </button>
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
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        delay={delay}
        setDelay={setDelay}
      />
    </div>
  );
};

export default App;
