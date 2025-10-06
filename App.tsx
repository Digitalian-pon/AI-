import React, { useState, useCallback } from 'react';
import { AppStatus } from './types';
import { generateMusicVideo, fileToBase64 } from './services/geminiService';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import VideoResult from './components/VideoResult';
import { SparklesIcon, AlertTriangleIcon } from './components/Icons';

const cameraWorkOptions = {
  '': 'なし',
  'slow zoom in': 'ズームイン',
  'slow zoom out': 'ズームアウト',
  'pan from left to right': 'パン（左から右へ）',
  'slight rotation': 'ゆっくりと回転',
};

const effectOptions = {
  'sparkling lights': 'キラキラ光る',
  'neon glow': 'ネオン',
  'confetti falling': '紙吹雪',
  'petals blowing in the wind': '風に舞う花びら',
};

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [cameraWork, setCameraWork] = useState<string>('');
  const [effects, setEffects] = useState<string[]>([]);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [audioObjectUrl, setAudioObjectUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [lipSync, setLipSync] = useState<boolean>(true);

  const handleGenerateClick = useCallback(async () => {
    if (!imageFile || !prompt) {
      setError('画像ファイルとプロンプトの両方を入力してください。');
      setStatus(AppStatus.ERROR);
      return;
    }

    setStatus(AppStatus.LOADING);
    setError('');

    try {
      let finalPrompt = prompt;

      // Add camera work to prompt
      if (cameraWork) {
        finalPrompt += `, cinematic shot with ${cameraWork}`;
      }

      // Add effects to prompt
      if (effects.length > 0) {
        finalPrompt += `, with ${effects.join(' and ')} effects`;
      }

      // Add lip-sync instruction to prompt
      if (lipSync) {
        finalPrompt += ", the character is singing passionately, with mouth movements synced to the rhythm of a song.";
      }
      
      const imageBase64 = await fileToBase64(imageFile);
      const videoUrl = await generateMusicVideo(finalPrompt, imageBase64, imageFile.type);
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
  }, [imageFile, prompt, audioFile, lipSync, cameraWork, effects]);

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setAudioFile(null);
    setImageFile(null);
    setPrompt('');
    setCameraWork('');
    setEffects([]);
    setGeneratedVideoUrl('');
    setAudioObjectUrl('');
    setError('');
    setLipSync(true);
    // Revoke old object URLs to prevent memory leaks
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

  const isGenerateDisabled = status === AppStatus.LOADING || !imageFile || !prompt;

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
          {status === AppStatus.LOADING && <Loader />}
          
          {status === AppStatus.SUCCESS && generatedVideoUrl && (
            <VideoResult 
              videoUrl={generatedVideoUrl} 
              audioUrl={audioObjectUrl} 
              onReset={handleReset} 
            />
          )}

          {(status === AppStatus.IDLE || status === AppStatus.ERROR) && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload 
                  label="① 楽曲をアップロード"
                  acceptedTypes="audio/mpeg,audio/wav"
                  file={audioFile}
                  onFileChange={setAudioFile}
                  isAudio={true}
                />
                <FileUpload 
                  label="② 画像をアップロード"
                  acceptedTypes="image/png,image/jpeg"
                  file={imageFile}
                  onFileChange={setImageFile}
                />
              </div>
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
                  ③ アニメーションの指示を入力 (プロンプト)
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例：口を大きく開けて情熱的に歌っている。背景にはサイバーパンクな街並み。"
                  rows={4}
                  className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ④ 動きとエフェクトを追加 (オプション)
                </label>
                <div className="bg-gray-700/50 p-4 rounded-lg space-y-4">
                  <div>
                    <label htmlFor="camera-work" className="block text-xs font-medium text-gray-400 mb-1">カメラワーク</label>
                    <select 
                      id="camera-work"
                      value={cameraWork}
                      onChange={e => setCameraWork(e.target.value)}
                      className="w-full bg-gray-600 border-gray-500 rounded-md p-2 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    >
                      {Object.entries(cameraWorkOptions).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">エフェクト (複数選択可)</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(effectOptions).map(([value, label]) => (
                        <label key={value} className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${effects.includes(value) ? 'bg-purple-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={effects.includes(value)}
                            onChange={() => handleEffectChange(value)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="lipsync-toggle" className="flex items-center justify-between cursor-pointer">
                  <span className="font-medium text-gray-300">⑤ キャラクターにリップシンクさせる</span>
                  <div className="relative">
                    <input 
                      id="lipsync-toggle" 
                      type="checkbox" 
                      className="sr-only" 
                      checked={lipSync} 
                      onChange={() => setLipSync(!lipSync)} 
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${lipSync ? 'bg-purple-600' : 'bg-gray-600'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${lipSync ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  オンにすると、AIに口の動きを意識させるプロンプトが追加されます。より良い結果を得るために、プロンプトでも口の動きを具体的に指示することをお勧めします。
                </p>
              </div>

              {status === AppStatus.ERROR && error && (
                <div className="bg-red-900/50 text-red-300 p-4 rounded-lg flex items-center space-x-3">
                  <AlertTriangleIcon className="h-6 w-6" />
                  <p>{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerateClick}
                disabled={isGenerateDisabled}
                className={`w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-300 ${
                  isGenerateDisabled
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 transform hover:-translate-y-1'
                }`}
              >
                <SparklesIcon className="h-6 w-6 mr-2" />
                ビデオを生成する
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
