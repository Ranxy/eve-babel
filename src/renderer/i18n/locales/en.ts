/**
 * English (en) – default locale.
 *
 * Interpolation uses [[ ]] delimiters (configured in i18n/index.ts) to avoid
 * conflicts with the {{targetLanguage}} syntax that users type in the translation
 * prompt textarea.
 *
 * To add a new language, copy this file, change the values, and register it in
 * src/renderer/i18n/index.ts.
 */
const en = {
  // ── App-level screens ───────────────────────────────────────────────────
  app: {
    directorySetup: {
      eyebrow: 'Directory Setup',
      title: 'Chatlogs folder not detected',
      cta: 'Select Chatlogs folder',
    },
    providerSetup: {
      eyebrow: 'Provider Setup',
      title: 'Translation is paused until a provider profile is configured.',
      description:
        'Open the settings entry from the dock menu, enter an API key, pick one of the discovered models, then activate that profile.',
      cta: 'Open settings window',
    },
    noCharacters: {
      eyebrow: 'No Characters',
      title: 'No chat characters found',
      description: 'Add or select an EVE Chatlogs directory that contains character chat history.',
    },
    dockMenu: {
      settings: 'Translation settings',
      changeLogs: 'Change logs folder',
      refresh: 'Refresh scan',
    },
  },

  // ── StatusBar ───────────────────────────────────────────────────────────
  statusBar: {
    showChannels: 'Show channels',
    hideChannels: 'Hide channels',
    noCharacterFound: 'No character found',
    targetLanguage: 'Target language',
    uiLanguage: 'Display language',
    queue: 'Queue',
    active: '[[count]] active',
  },

  // ── ChannelList ─────────────────────────────────────────────────────────
  channelList: {
    eyebrow: 'Channels',
    title: 'Routes',
    focused: 'Focused',
    total: '[[count]] total',
    noChannels: 'No channels were discovered for the selected character.',
    msgCount: '[[count]] msgs',
    translationOn: 'Translation On',
    translationOff: 'Translation Off',
    unpinLabel: 'Unpin [[name]]',
    pinLabel: 'Pin [[name]]',
    pinned: 'Pinned',
    pin: 'Pin',
    noSession: 'No session',
  },

  // ── MessageFeed ─────────────────────────────────────────────────────────
  messageFeed: {
    eyebrow: 'Conversation',
    chooseChannel: 'Choose a channel',
    subtitleLive: 'New arrivals are queued into live translation.',
    subtitleMuted: 'This route is visible but translation is currently muted.',
    translationLive: 'Translation live',
    translationMuted: 'Translation muted',
    messages: 'messages',
    selectChannelHint: 'Select a channel on the left to open its conversation stream.',
    loadingMessages: 'Loading cached messages\u2026',
    noMessages: 'This channel has no cached messages yet.',
    loadingEarlier: 'Loading earlier cached messages\u2026',
    scrollForEarlier: 'Scroll upward to load earlier messages.',
    reachedStart: 'Reached the start of cached history.',
    translationLabel: 'Translation',
    waitingForTranslation: 'Waiting for translation.',
    scrollToLatest: 'Scroll to latest message',
    scrollToLatestTitle: 'Scroll to latest',
    translationStatus: {
      translated: 'Translated',
      error: 'Translation error',
      queued: 'Queued for translation',
      translating: 'Translating',
      skipped: 'Translation skipped',
      idle: 'Translation idle',
    },
  },

  // ── CharacterPicker ─────────────────────────────────────────────────────
  characterPicker: {
    eyebrow: 'Character Selection',
    title: 'Pick the active EVE pilot',
    description:
      'Channel discovery is scoped to one character at a time so Local, corp, and private chats stay separated by the log files that actually own them.',
    characterId: 'Character ID [[id]]',
    channels: '[[count]] channels',
    sessions: '[[count]] sessions',
  },

  // ── SettingsPanel ───────────────────────────────────────────────────────
  settingsPanel: {
    ariaLabel: 'Settings sections',
    sections: {
      general: 'General',
      providers: 'Providers',
      terminology: 'Terminology',
    },
    footer: {
      allSaved: 'All changes saved',
      close: 'Close',
      save: 'Save',
    },
  },

  // ── GeneralSettingsPage ─────────────────────────────────────────────────
  generalSettings: {
    queueSnapshot: {
      label: 'Queue snapshot',
      waiting: '[[count]] waiting',
      activeBatches: '[[count]] active batches',
    },
    providerCoverage: {
      label: 'Provider coverage',
      // i18next pluralization: _one for count=1, _other for count≠1
      profiles_one: '[[count]] saved profile',
      profiles_other: '[[count]] saved profiles',
      activeHint: 'One provider profile is active for live translation.',
      noActiveHint: 'No active provider profile yet.',
    },
    activeModel: {
      label: 'Active translation model',
      noModels: 'No models configured',
      hint: 'The model used for live translation. Configure models in the Providers tab.',
    },
    targetLanguage: {
      label: 'Target language',
      hint: 'Choose the language used for every translated chat line.',
    },
    debounceMs: {
      label: 'Debounce ms',
      hint: 'Delay before a new batch is queued for translation.',
    },
    maxQueueSize: {
      label: 'Max queue size',
      hint: 'Prevents backlog growth when many channels are active.',
    },
    llmDebugger: {
      label: 'Enable LLM debugger',
      hint: "Save every LLM request payload and raw response into separate JSON files under the app data `llm-debug` folder.",
      enabled: 'Debugger enabled',
      disabled: 'Debugger disabled',
    },
    translationPrompt: {
      label: 'Translation prompt',
      // {{targetLanguage}} here is a literal example shown to the user – it is NOT an
      // i18next interpolation variable (we use [[ ]] delimiters for that).
      placeholder: 'Use {{targetLanguage}} to inject the selected target language.',
      hint: 'Use {{targetLanguage}} anywhere in the prompt to bind the selected language.',
    },
    actions: {
      openDebugFolder: 'Open debug folder',
      cancelTranslations: 'Cancel queued translations',
      save: 'Save general settings',
    },
  },

  // ── ProvidersSettingsPage ───────────────────────────────────────────────
  providersSettings: {
    searchPlaceholder: 'Search providers...',
    addCustomProvider: 'Add Custom Provider',
    notConfigured: 'Not configured',
    customSection: 'Custom',
    unnamedProvider: 'Unnamed Provider',
    newCustomProvider: 'New Custom Provider',
    draft: 'Draft',
    customProvider: 'Custom Provider',
    customDescription: 'Connect any OpenAI-compatible API endpoint with a custom name and model.',
    displayName: {
      eyebrow: 'Display Name',
      placeholder: 'My Custom Provider',
    },
    apiBaseUrl: {
      eyebrow: 'API Base URL',
      placeholder: 'https://api.example.com/v1',
    },
    apiKey: {
      eyebrow: 'API Key',
      replaceTitle: 'Click to replace API key',
      hideKey: 'Hide key',
      showKey: 'Show key',
      placeholder: 'Paste your API key...',
      getKey: 'Get API key',
    },
    modelName: {
      eyebrow: 'Model Name',
      placeholder: 'e.g. gpt-4o, claude-3-5-sonnet-20241022, ...',
    },
    validation: {
      nameRequired: 'Display name is required.',
      urlRequired: 'API Base URL is required.',
      modelRequired: 'Model name is required.',
    },
    actions: {
      setActive: 'Set Active',
      delete: 'Delete',
      addProvider: 'Add Provider',
      saveChanges: 'Save Changes',
    },
    status: {
      active: 'Active',
      inactive: 'Inactive',
      // i18next pluralization
      model_one: '[[count]] model',
      model_other: '[[count]] models',
    },
    models: {
      eyebrow: 'Models',
      fetching: 'Fetching...',
      fetchModels: 'Fetch models',
      searchPlaceholder: 'Search models...',
      // [[count]] = number of shown models (drives plural form), [[enabled]] = enabled count
      showing_one: 'Showing [[count]] model \u00b7 [[enabled]] enabled',
      showing_other: 'Showing [[count]] models \u00b7 [[enabled]] enabled',
      fetchHintNoKey: 'Enter an API key and click \u201cFetch models\u201d to see available models.',
      fetchHintHasKey: 'Click \u201cFetch models\u201d to load available models.',
      failedToFetch: 'Failed to fetch models',
    },
  },

  // ── TerminologySettingsPage ────────────────────────────────────────────
  terminologySettings: {
    summary: {
      label: 'Glossary',
      count_one: '[[count]] term',
      count_other: '[[count]] terms',
      hint: 'Terms are injected into the LLM prompt when a translation exists for the active target language.',
    },
    activeLanguage: {
      label: 'Active target language',
      hint: 'Only terms with a translation defined for this language are used.',
    },
    searchPlaceholder: 'Search terms...',
    emptyState: 'No terminology entries defined yet. Add game-specific terms with their translations to help the LLM translate EVE chat messages accurately.',
    termsLabel: 'Terms',
    actions: {
      addTerm: 'Add term',
      addFirst: 'Add first term',
      delete: 'Delete',
    },
    editor: {
      newTitle: 'New Term',
      editTitle: 'Edit Term',
      description: 'Define the same game term expressed in one or more languages. No single language is treated as the source — all are equal peers.',
      notesLabel: 'Notes (optional)',
      notesPlaceholder: 'e.g. Cynosural Field — used for capital ship jump guidance',
      termsLabel: 'Languages',
      addLanguage: '+ Add language',
      noLanguages: 'No languages added yet. Click "+ Add language" to define at least one language variant.',
      termPlaceholder: 'e.g. cyno, POS, 诱导力场...',
      multiValueHint: 'Separate multiple variants with commas, e.g. "cyno, cynosural, cyno field".',
      removeLanguage: 'Remove language',
      cancel: 'Cancel',
      addEntry: 'Add Entry',
      saveEntry: 'Save Entry',
    },
  },
} as const

export default en
export type TranslationSchema = typeof en

/**
 * Recursive type that maps every leaf string in TranslationSchema to `string`.
 * Use this as the type annotation for non-English locale files so TypeScript
 * verifies the key structure while still accepting translated string values.
 */
type StringLeaves<T> = T extends string ? string : { [K in keyof T]: StringLeaves<T[K]> }
export type LocaleSchema = StringLeaves<TranslationSchema>
