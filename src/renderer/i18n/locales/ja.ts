/**
 * 日本語 (ja) ローカライズファイル。
 *
 * 補間区切り文字は [[ ]] です。{{ }} は使用しないでください。
 * 日本語に複数形はないため、_one と _other には同じ文言を入れます。
 */
import type { LocaleSchema } from './en'

const ja = {
  // ── アプリ全体の画面 ───────────────────────────────────────────────
  app: {
    directorySetup: {
      eyebrow: 'ディレクトリ設定',
      title: 'Chatlogs フォルダーが検出されませんでした',
      cta: 'Chatlogs フォルダーを選択',
    },
    providerSetup: {
      eyebrow: 'プロバイダー設定',
      title: 'プロバイダープロファイルが設定されるまで翻訳は一時停止されます。',
      description:
        'ドックメニューから設定を開き、API キーを入力し、検出されたモデルを選択して、そのプロファイルを有効化してください。',
      cta: '設定ウィンドウを開く',
    },
    noCharacters: {
      eyebrow: 'キャラクターなし',
      title: 'チャットキャラクターが見つかりません',
      description: 'EVE のチャット履歴を含む Chatlogs ディレクトリを追加または選択してください。',
    },
    dockMenu: {
      settings: '翻訳設定',
      changeLogs: 'ログフォルダーを変更',
      refresh: '再スキャン',
    },
  },

  // ── ステータスバー ───────────────────────────────────────────────
  statusBar: {
    showChannels: 'チャンネルを表示',
    hideChannels: 'チャンネルを隠す',
    noCharacterFound: 'キャラクターが見つかりません',
    targetLanguage: '翻訳先言語',
    uiLanguage: '表示言語',
    queue: 'キュー',
    active: '[[count]] 件処理中',
  },

  // ── チャンネル一覧 ───────────────────────────────────────────────
  channelList: {
    eyebrow: 'チャンネル',
    title: 'ルート',
    focused: '選択中',
    total: '合計 [[count]] 件',
    noChannels: '選択したキャラクターではチャンネルが見つかりませんでした。',
    msgCount: '[[count]] 件',
    translationOn: '翻訳オン',
    translationOff: '翻訳オフ',
    unpinLabel: '[[name]] の固定を解除',
    pinLabel: '[[name]] を固定',
    pinned: '固定済み',
    pin: '固定',
    noSession: 'セッションなし',
  },

  // ── メッセージフィード ───────────────────────────────────────────
  messageFeed: {
    eyebrow: '会話',
    chooseChannel: 'チャンネルを選択',
    subtitleLive: '新着メッセージはライブ翻訳キューに追加されます。',
    subtitleMuted: 'このルートは表示中ですが、翻訳は現在ミュートされています。',
    translationLive: 'ライブ翻訳中',
    translationMuted: '翻訳ミュート中',
    messages: '件のメッセージ',
    selectChannelHint: '左側でチャンネルを選択すると会話ストリームを開けます。',
    loadingMessages: 'キャッシュ済みメッセージを読み込み中…',
    noMessages: 'このチャンネルにはまだキャッシュ済みメッセージがありません。',
    loadingEarlier: '以前のキャッシュメッセージを読み込み中…',
    scrollForEarlier: '上にスクロールして以前のメッセージを読み込みます。',
    reachedStart: 'キャッシュ履歴の先頭に到達しました。',
    translationLabel: '翻訳',
    waitingForTranslation: '翻訳待ちです。',
    scrollToLatest: '最新メッセージへスクロール',
    scrollToLatestTitle: '最新へスクロール',
    translationStatus: {
      translated: '翻訳済み',
      error: '翻訳エラー',
      queued: '翻訳待ちキュー',
      translating: '翻訳中',
      skipped: '翻訳をスキップ',
      idle: '翻訳待機中',
    },
  },

  // ── キャラクター選択 ─────────────────────────────────────────────
  characterPicker: {
    eyebrow: 'キャラクター選択',
    title: '使用中の EVE パイロットを選択',
    description:
      'チャンネル検出は一度に 1 キャラクターだけを対象にするため、ローカル、コーポレーション、プライベートチャットは実際のログファイル単位で分離されます。',
    characterId: 'キャラクター ID [[id]]',
    channels: '[[count]] チャンネル',
    sessions: '[[count]] セッション',
  },

  // ── 設定パネル ─────────────────────────────────────────────────
  settingsPanel: {
    ariaLabel: '設定セクション',
    sections: {
      general: '一般',
      providers: 'プロバイダー',
    },
    footer: {
      allSaved: 'すべての変更を保存しました',
      close: '閉じる',
      save: '保存',
    },
  },

  // ── 一般設定ページ ───────────────────────────────────────────────
  generalSettings: {
    queueSnapshot: {
      label: 'キュースナップショット',
      waiting: '[[count]] 件待機中',
      activeBatches: '[[count]] 件のアクティブバッチ',
    },
    providerCoverage: {
      label: 'プロバイダー状況',
      profiles_one: '保存済みプロファイル [[count]] 件',
      profiles_other: '保存済みプロファイル [[count]] 件',
      activeHint: 'ライブ翻訳用に 1 つのプロバイダープロファイルが有効です。',
      noActiveHint: '有効なプロバイダープロファイルはまだありません。',
    },
    activeModel: {
      label: '現在の翻訳モデル',
      noModels: 'モデルが設定されていません',
      hint: 'ライブ翻訳で使うモデルです。プロバイダータブでモデルを設定してください。',
    },
    targetLanguage: {
      label: '翻訳先言語',
      hint: '各チャット行の翻訳先となる言語を選択します。',
    },
    debounceMs: {
      label: 'デバウンス ms',
      hint: '新しいバッチを翻訳キューに入れる前の待機時間です。',
    },
    maxQueueSize: {
      label: '最大キューサイズ',
      hint: '多くのチャンネルが有効なときにバックログが増えすぎるのを防ぎます。',
    },
    llmDebugger: {
      label: 'LLM デバッガーを有効化',
      hint: '各 LLM リクエストのペイロードと生レスポンスを、アプリデータ配下の `llm-debug` フォルダーに個別の JSON として保存します。',
      enabled: 'デバッガー有効',
      disabled: 'デバッガー無効',
    },
    translationPrompt: {
      label: '翻訳プロンプト',
      placeholder: '{{targetLanguage}} を使って選択中の翻訳先言語を挿入します。',
      hint: 'プロンプト内の任意の位置で {{targetLanguage}} を使うと、選択中の言語を埋め込めます。',
    },
    actions: {
      openDebugFolder: 'デバッグフォルダーを開く',
      cancelTranslations: '待機中の翻訳をキャンセル',
      save: '一般設定を保存',
    },
  },

  // ── プロバイダー設定ページ ───────────────────────────────────────
  providersSettings: {
    searchPlaceholder: 'プロバイダーを検索...',
    addCustomProvider: 'カスタムプロバイダーを追加',
    notConfigured: '未設定',
    customSection: 'カスタム',
    unnamedProvider: '名称未設定のプロバイダー',
    newCustomProvider: '新しいカスタムプロバイダー',
    draft: '下書き',
    customProvider: 'カスタムプロバイダー',
    customDescription: '任意の OpenAI 互換 API エンドポイントを、独自の名前とモデルで接続します。',
    displayName: {
      eyebrow: '表示名',
      placeholder: '自分のカスタムプロバイダー',
    },
    apiBaseUrl: {
      eyebrow: 'API Base URL',
      placeholder: 'https://api.example.com/v1',
    },
    apiKey: {
      eyebrow: 'API キー',
      replaceTitle: 'クリックして API キーを置き換え',
      hideKey: 'キーを隠す',
      showKey: 'キーを表示',
      placeholder: 'API キーを貼り付け...',
      getKey: 'API キーを取得',
    },
    modelName: {
      eyebrow: 'モデル名',
      placeholder: '例: gpt-4o, claude-3-5-sonnet-20241022, ...',
    },
    validation: {
      nameRequired: '表示名は必須です。',
      urlRequired: 'API Base URL は必須です。',
      modelRequired: 'モデル名は必須です。',
    },
    actions: {
      setActive: '有効化',
      delete: '削除',
      addProvider: 'プロバイダーを追加',
      saveChanges: '変更を保存',
    },
    status: {
      active: '有効',
      inactive: '無効',
      model_one: '[[count]] モデル',
      model_other: '[[count]] モデル',
    },
    models: {
      eyebrow: 'モデル',
      fetching: '取得中...',
      fetchModels: 'モデルを取得',
      searchPlaceholder: 'モデルを検索...',
      showing_one: '[[count]] 件のモデルを表示中 · [[enabled]] 件有効',
      showing_other: '[[count]] 件のモデルを表示中 · [[enabled]] 件有効',
      fetchHintNoKey: 'API キーを入力して「モデルを取得」をクリックすると、利用可能なモデルを表示します。',
      fetchHintHasKey: '「モデルを取得」をクリックして利用可能なモデルを読み込みます。',
      failedToFetch: 'モデルの取得に失敗しました',
    },
  },
} satisfies LocaleSchema

export default ja