import React, { createContext, useState, useContext, useMemo } from 'react';

type Language = 'ja' | 'en';

const translations = {
  ja: {
    appTitle: 'AI Music Video Maker',
    appSubtitle: 'Suno AIの楽曲、歌詞、Midjourneyの画像をアップロードして、あなただけのオリジナルMVを生成しよう。',
    // Welcome Screen
    welcomeTitle: 'MV制作を始めよう',
    welcomeSubtitle: 'どのように制作を開始しますか？',
    welcomeButtonAI: 'AIで歌詞を生成',
    welcomeDescAI: 'テーマやアイデアからAIに作詞を任せる。',
    welcomeButtonManual: '自分で素材を用意',
    welcomeDescManual: '既にある楽曲、歌詞、画像をアップロードする。',
    // Prepare Lyrics Screen
    prepareLyricsTitle: 'ステップ1: 歌詞を準備する',
    prepareLyricsSubtitle: 'AIにテーマをおまかせするか、テーマやキーワードを入力して歌詞を生成できます。',
    lyricsGeneratedSuccessTitle: '歌詞が完成しました！',
    lyricsGeneratedSuccessDesc: '次のステップに進んで、楽曲と画像をアップロードしましょう。',
    nextStepButton: '次のステップへ',
    // Upload Media Screen
    uploadMediaTitle: 'ステップ2: 素材をアップロード',
    uploadMediaSubtitle: 'MVに使用する楽曲、歌詞、画像（複数可）をアップロードしてください。',
    reviewScenesButton: 'シーンを確認・編集する',
    // API Key
    selectApiKeyTitle: 'APIキーを選択してください',
    selectApiKeyDescription: 'このアプリケーションを動作させるには、Google AI StudioのAPIキーが必要です。下のボタンを押して、ご利用のAPIキーを選択してください。',
    selectApiKeyButton: 'APIキーを選択',
    authErrorHelpTitle: '認証エラーが解決しない場合:',
    authErrorHelp1: '選択したAPIキーが正しいGoogle Cloudプロジェクトに属しているか確認してください。',
    authErrorHelp2: 'そのCloudプロジェクトで<strong class="text-purple-300">課金が有効</strong>になっていることを確認してください。',
    authErrorHelp3: 'プロジェクトで<strong class="text-purple-300">Gemini APIが有効</strong>になっているか確認してください。',
    billingInfoPreLink: 'APIキーの管理と課金に関する詳細は',
    billingInfoLink: 'こちら',
    billingInfoPostLink: 'をご覧ください。',
    // Errors
    errorApiKeyAuth: 'APIキーの認証に失敗しました。キーを再選択するか、Google AI Studioで設定をご確認ください。',
    error500: 'ビデオ生成サービスで一時的なエラーが発生しました。時間を置いて再試行してください。',
    errorQuota: 'APIの利用上限に達した可能性があります。Google AI Studioで支払い設定をご確認ください。',
    errorNetwork: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
    errorUnexpected: '予期せぬエラーが発生しました。',
    errorApiKeyNotSelected: 'APIキーが選択されていません。再度APIキーを選択してください。',
    errorAistudioUnavailable: 'AI StudioのAPIキー選択機能が利用できません。',
    errorOpenSelectKey: 'キー選択ダイアログを開けませんでした:',
    errorMissingFiles: '楽曲ファイル、歌詞、そして画像を1枚以上用意してください。',
    errorPromptGeneration: 'プロンプトの生成に失敗しました:',
    errorThemeGeneration: 'テーマの生成に失敗しました:',
    errorTitleGeneration: 'タイトルの生成に失敗しました:',
    errorLyricsGeneration: '歌詞の生成に失敗しました:',
    errorThemeInput: '歌詞を生成するためのテーマを入力してください。',
    errorAllVideosFailed: "すべてのビデオ生成に失敗しました。",
    // AI Lyrics Generation
    thinking: '考え中...',
    aiChoice: 'AIにおまかせ',
    or: 'または',
    themePlaceholder: '曲のテーマやアイデアを入力',
    sunoStyleSuggestion: 'Suno AI用の音楽スタイル案:',
    generatingLyrics: '歌詞を生成中...',
    generateLyricsButton: 'AIで歌詞を生成',
    // File Upload
    fileLabelAudio: '楽曲ファイル',
    fileLabelLyrics: '歌詞',
    fileLabelImages: '画像ファイル',
    lyricsPlaceholder: 'ここに入力するか、.txtまたは.lrcファイルをアップロードしてください...',
    uploadAddMoreImages: 'クリックまたはドラッグ＆ドロップで画像を追加',
    uploadClickToChange: 'クリックして変更',
    uploadDragAndDrop: 'ファイルをここにドラッグ＆ドロップ',
    uploadOrClick: 'またはクリックして選択',
    // Review Screen
    lyricsDisplayTitle: 'ステップ3: シーンを確認＆編集',
    lyricsDisplaySubtitle_withLipSync: '各シーンのプロンプトがAIによって生成されました。AIがリップシンクを試みますが、完全な同期は保証されません。最高の映像にするため、プロンプトを自由に編集・再生成してください。',
    regeneratePromptTooltip: 'AIでプロンプトを再生成',
    promptForScene: 'シーン{sceneNum}のプロンプト',
    promptEditPlaceholder: 'ここにビデオプロンプトを入力...',
    lipSyncToggle: 'リップシンク',
    lipSyncTooltip: 'ONにすると、このシーンでキャラクターが歌っているような映像を試みます。',
    // Generation
    startGenerationButton: 'MV生成を開始',
    statusGeneratingTitle: "歌詞からタイトルを生成中...",
    promptGenerating: 'プロンプト生成中...',
    statusGeneratingPrompts: '各シーンのプロンプトを生成しています...',
    loaderTitle: 'MVを生成中...',
    loaderSubtitle: 'AIが各シーンのビデオを生成しています。完了まで数分かかることがあります。',
    loaderSceneProgress: 'シーンの進捗',
    scene: 'シーン',
    loaderFailedScenesWarning: '一部のシーンの生成に失敗しました。失敗したシーンは最終的なビデオから除外されます。',
    statusGeneratingScene: '{current}/{total}シーンのビデオを生成中...',
    statusCombiningVideos: '{count}個のビデオクリップを結合しています...',
    statusAddingAudio: '音声トラックを追加しています...',
    statusFinalProcessing: '最終処理中',
    statusFinalizing: '最終処理を完了しています...',
    statusWaiting: '{delay}分待機中...',
    // Final Screen
    resultTitle: 'ミュージックビデオが完成しました！',
    resultDownloadButton: 'ビデオをダウンロード',
    resultCreateAnotherButton: 'もう一度作成',
    // Common
    backButton: '戻る',
    generateVideoButton: 'ビデオを生成する',
    copy: 'コピー',
    copied: 'コピー完了!',
    copyStyleTooltip: 'スタイルをコピー',
    copyLyricsTooltip: '歌詞をコピー',
    copyPromptTooltip: 'プロンプトをコピー',
    footerPoweredBy: "Google's Veo and Gemini APIsを搭載しています。",
    // Settings
    settingsTitle: '設定',
    settingsLanguageLabel: '言語',
    settingsDelayLabel: 'シーン間の遅延 (分)',
    settingsDelayDescription: '各ビデオ生成API呼び出しの間に分単位で待機時間を追加します。これにより、レート制限のエラーを回避できる場合があります。',
    settingsSaved: '保存しました',
    settingsSaveButton: '保存',
    untitledProject: "無題のプロジェクト",
  },
  en: {
    appTitle: 'AI Music Video Maker',
    appSubtitle: 'Upload your Suno AI music, lyrics, and Midjourney images to generate your own original music video.',
    // Welcome Screen
    welcomeTitle: 'Start Your Music Video',
    welcomeSubtitle: 'How would you like to begin?',
    welcomeButtonAI: 'Generate Lyrics with AI',
    welcomeDescAI: 'Let AI write lyrics based on your theme or idea.',
    welcomeButtonManual: 'Use My Own Assets',
    welcomeDescManual: 'Upload your existing music, lyrics, and images.',
    // Prepare Lyrics Screen
    prepareLyricsTitle: 'Step 1: Prepare Lyrics',
    prepareLyricsSubtitle: 'Let AI suggest a theme, or enter your own theme/keywords to generate lyrics.',
    lyricsGeneratedSuccessTitle: 'Lyrics Generated!',
    lyricsGeneratedSuccessDesc: "Let's move on to the next step to upload your music and images.",
    nextStepButton: 'Next Step',
    // Upload Media Screen
    uploadMediaTitle: 'Step 2: Upload Your Assets',
    uploadMediaSubtitle: 'Upload your music file, lyrics, and one or more images for the video.',
    reviewScenesButton: 'Review & Edit Scenes',
    // API Key
    selectApiKeyTitle: 'Select Your API Key',
    selectApiKeyDescription: 'This application requires an API key from Google AI Studio to function. Please press the button below to select your API key.',
    selectApiKeyButton: 'Select API Key',
    authErrorHelpTitle: 'If authentication errors persist:',
    authErrorHelp1: 'Ensure the selected API key belongs to the correct Google Cloud project.',
    authErrorHelp2: 'Verify that <strong class="text-purple-300">billing is enabled</strong> for that Cloud project.',
    authErrorHelp3: 'Check if the <strong class="text-purple-300">Gemini API is enabled</strong> in the project.',
    billingInfoPreLink: 'For more details on API key management and billing, please see ',
    billingInfoLink: 'here',
    billingInfoPostLink: '.',
    // Errors
    errorApiKeyAuth: 'API key authentication failed. Please re-select your key or check your settings in Google AI Studio.',
    error500: 'A temporary error occurred with the video generation service. Please try again later.',
    errorQuota: 'You may have reached your API usage limit. Please check your billing settings in Google AI Studio.',
    errorNetwork: 'A network error occurred. Please check your internet connection.',
    errorUnexpected: 'An unexpected error occurred.',
    errorApiKeyNotSelected: 'API key not selected. Please select your API key again.',
    errorAistudioUnavailable: 'AI Studio API key selection feature is not available.',
    errorOpenSelectKey: 'Could not open the key selection dialog:',
    errorMissingFiles: 'Please provide a music file, lyrics, and at least one image.',
    errorPromptGeneration: 'Failed to generate prompts:',
    errorThemeGeneration: 'Failed to generate theme:',
    errorTitleGeneration: 'Failed to generate title:',
    errorLyricsGeneration: 'Failed to generate lyrics:',
    errorThemeInput: 'Please enter a theme to generate lyrics.',
    errorAllVideosFailed: "All video generations failed.",
    // AI Lyrics Generation
    thinking: 'Thinking...',
    aiChoice: "Let AI decide",
    or: 'or',
    themePlaceholder: 'Enter song theme or idea',
    sunoStyleSuggestion: 'Suggested music style for Suno AI:',
    generatingLyrics: 'Generating lyrics...',
    generateLyricsButton: 'Generate lyrics with AI',
    // File Upload
    fileLabelAudio: 'Music File',
    fileLabelLyrics: 'Lyrics',
    fileLabelImages: 'Image Files',
    lyricsPlaceholder: 'Enter lyrics here, or upload a .txt or .lrc file...',
    uploadAddMoreImages: 'Click or drag & drop to add more images',
    uploadClickToChange: 'Click to change',
    uploadDragAndDrop: 'Drag & drop your file here',
    uploadOrClick: 'or click to select',
    // Review Screen
    lyricsDisplayTitle: 'Step 3: Review & Edit Scenes',
    lyricsDisplaySubtitle_withLipSync: 'AI has generated prompts for each scene. It will attempt a lip-sync effect, but perfect sync is not guaranteed. Feel free to edit or regenerate prompts for the best result.',
    regeneratePromptTooltip: 'Regenerate prompt with AI',
    promptForScene: 'Prompt for scene {sceneNum}',
    promptEditPlaceholder: 'Enter video prompt here...',
    lipSyncToggle: 'Lip-Sync',
    lipSyncTooltip: 'If enabled, the AI will try to make a character sing in this scene.',
    // Generation
    startGenerationButton: 'Start MV Generation',
    statusGeneratingTitle: "Generating title from lyrics...",
    promptGenerating: 'Generating prompt...',
    statusGeneratingPrompts: 'Generating prompts for each scene...',
    loaderTitle: 'Generating Music Video...',
    loaderSubtitle: 'The AI is generating videos for each scene. This may take a few minutes.',
    loaderSceneProgress: 'Scene Progress',
    scene: 'Scene',
    loaderFailedScenesWarning: 'Some scenes failed to generate. They will be excluded from the final video.',
    statusGeneratingScene: 'Generating video for scene {current}/{total}...',
    statusCombiningVideos: 'Combining {count} video clips...',
    statusAddingAudio: 'Adding audio track...',
    statusFinalProcessing: 'Final processing',
    statusFinalizing: 'Finalizing video...',
    statusWaiting: 'Waiting for {delay} minutes...',
    // Final Screen
    resultTitle: 'Your Music Video is Ready!',
    resultDownloadButton: 'Download Video',
    resultCreateAnotherButton: 'Create Another',
    // Common
    backButton: 'Back',
    generateVideoButton: 'Generate Video',
    copy: 'Copy',
    copied: 'Copied!',
    copyStyleTooltip: 'Copy style',
    copyLyricsTooltip: 'Copy lyrics',
    copyPromptTooltip: 'Copy prompt',
    footerPoweredBy: "Powered by Google's Veo and Gemini APIs.",
    // Settings
    settingsTitle: 'Settings',
    settingsLanguageLabel: 'Language',
    settingsDelayLabel: 'Delay between scenes (minutes)',
    settingsDelayDescription: 'Adds a wait time (in minutes) between each video generation API call. This can help avoid rate limit errors.',
    settingsSaved: 'Saved',
    settingsSaveButton: 'Save',
    untitledProject: "Untitled Project",
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.ja, options?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ja');

  const t = (key: keyof typeof translations.ja, options?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations['en'][key];
    if (options) {
      Object.keys(options).forEach(placeholder => {
        text = text.replace(`{${placeholder}}`, String(options[placeholder]));
      });
    }
    return text;
  };

  const value = useMemo(() => ({ language, setLanguage, t }), [language]);

  // FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
  return React.createElement(I18nContext.Provider, { value }, children);
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
