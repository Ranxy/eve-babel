/**
 * Русский (ru) файл локализации.
 *
 * Для интерполяции используются разделители [[ ]]. Не используйте {{ }}.
 * В русском есть формы множественного числа, но текущая схема локалей
 * фиксирована на _one и _other, поэтому здесь сохранена та же структура.
 */
import type { LocaleSchema } from './en'

const ru = {
  // ── Экраны приложения ────────────────────────────────────────────────
  app: {
    directorySetup: {
      eyebrow: 'Настройка каталога',
      title: 'Папка Chatlogs не обнаружена',
      cta: 'Выбрать папку Chatlogs',
    },
    providerSetup: {
      eyebrow: 'Настройка провайдера',
      title: 'Перевод приостановлен, пока не настроен профиль провайдера.',
      description:
        'Откройте настройки из dock-меню, введите API-ключ, выберите одну из найденных моделей и затем активируйте этот профиль.',
      cta: 'Открыть окно настроек',
    },
    noCharacters: {
      eyebrow: 'Нет персонажей',
      title: 'Персонажи чата не найдены',
      description: 'Добавьте или выберите каталог EVE Chatlogs, содержащий историю чатов персонажа.',
    },
    dockMenu: {
      settings: 'Настройки перевода',
      changeLogs: 'Изменить папку логов',
      refresh: 'Обновить сканирование',
    },
  },

  // ── StatusBar ───────────────────────────────────────────────────────
  statusBar: {
    showChannels: 'Показать каналы',
    hideChannels: 'Скрыть каналы',
    noCharacterFound: 'Персонаж не найден',
    targetLanguage: 'Язык перевода',
    uiLanguage: 'Язык интерфейса',
    queue: 'Очередь',
    active: 'Активно: [[count]]',
  },

  // ── ChannelList ─────────────────────────────────────────────────────
  channelList: {
    eyebrow: 'Каналы',
    title: 'Маршруты',
    focused: 'В фокусе',
    total: 'Всего [[count]]',
    noChannels: 'Для выбранного персонажа каналы не обнаружены.',
    msgCount: '[[count]] сообщ.',
    translationOn: 'Перевод включен',
    translationOff: 'Перевод выключен',
    unpinLabel: 'Открепить [[name]]',
    pinLabel: 'Закрепить [[name]]',
    pinned: 'Закреплено',
    pin: 'Закрепить',
    noSession: 'Нет сессии',
  },

  // ── MessageFeed ─────────────────────────────────────────────────────
  messageFeed: {
    eyebrow: 'Диалог',
    chooseChannel: 'Выберите канал',
    subtitleLive: 'Новые сообщения отправляются в очередь живого перевода.',
    subtitleMuted: 'Этот маршрут виден, но перевод сейчас отключен.',
    translationLive: 'Перевод активен',
    translationMuted: 'Перевод отключен',
    messages: 'сообщений',
    selectChannelHint: 'Выберите канал слева, чтобы открыть поток его сообщений.',
    loadingMessages: 'Загрузка кэшированных сообщений…',
    noMessages: 'У этого канала пока нет кэшированных сообщений.',
    loadingEarlier: 'Загрузка более ранних кэшированных сообщений…',
    scrollForEarlier: 'Прокрутите вверх, чтобы загрузить более ранние сообщения.',
    reachedStart: 'Достигнуто начало кэшированной истории.',
    translationLabel: 'Перевод',
    waitingForTranslation: 'Ожидание перевода.',
    scrollToLatest: 'Прокрутить к последнему сообщению',
    scrollToLatestTitle: 'К последнему сообщению',
    translationStatus: {
      translated: 'Переведено',
      error: 'Ошибка перевода',
      queued: 'В очереди на перевод',
      translating: 'Переводится',
      skipped: 'Перевод пропущен',
      idle: 'Перевод не активен',
    },
  },

  // ── CharacterPicker ────────────────────────────────────────────────
  characterPicker: {
    eyebrow: 'Выбор персонажа',
    title: 'Выберите активного пилота EVE',
    description:
      'Обнаружение каналов выполняется только для одного персонажа за раз, поэтому локальный, корпоративный и приватный чаты остаются разделены по лог-файлам, которым они действительно принадлежат.',
    characterId: 'ID персонажа [[id]]',
    channels: '[[count]] каналов',
    sessions: '[[count]] сессий',
  },

  // ── SettingsPanel ───────────────────────────────────────────────────
  settingsPanel: {
    ariaLabel: 'Разделы настроек',
    sections: {
      general: 'Общие',
      providers: 'Провайдеры',
      terminology: 'Глоссарий',
    },
    footer: {
      allSaved: 'Все изменения сохранены',
      close: 'Закрыть',
      save: 'Сохранить',
    },
  },

  // ── GeneralSettingsPage ─────────────────────────────────────────────
  generalSettings: {
    queueSnapshot: {
      label: 'Снимок очереди',
      waiting: 'Ожидают: [[count]]',
      activeBatches: 'Активных пакетов: [[count]]',
    },
    providerCoverage: {
      label: 'Состояние провайдеров',
      profiles_one: 'Сохранен [[count]] профиль',
      profiles_other: 'Сохранено [[count]] профилей',
      activeHint: 'Один профиль провайдера активен для живого перевода.',
      noActiveHint: 'Пока нет активного профиля провайдера.',
    },
    activeModel: {
      label: 'Активная модель перевода',
      noModels: 'Модели не настроены',
      hint: 'Модель, используемая для живого перевода. Настройте модели на вкладке «Провайдеры».',
    },
    targetLanguage: {
      label: 'Язык перевода',
      hint: 'Выберите язык, на который будет переводиться каждая строка чата.',
    },
    debounceMs: {
      label: 'Debounce, мс',
      hint: 'Задержка перед постановкой нового пакета в очередь на перевод.',
    },
    maxQueueSize: {
      label: 'Максимальный размер очереди',
      hint: 'Не дает бэклогу бесконтрольно расти при активности множества каналов.',
    },
    llmDebugger: {
      label: 'Включить отладчик LLM',
      hint: 'Сохранять каждый payload запроса к LLM и сырой ответ в отдельные JSON-файлы в папке `llm-debug` в данных приложения.',
      enabled: 'Отладчик включен',
      disabled: 'Отладчик выключен',
    },
    translationPrompt: {
      label: 'Промпт перевода',
      placeholder: 'Используйте {{targetLanguage}}, чтобы подставить выбранный язык перевода.',
      hint: 'Используйте {{targetLanguage}} в любом месте промпта, чтобы привязать выбранный язык.',
    },
    actions: {
      openDebugFolder: 'Открыть папку отладки',
      cancelTranslations: 'Отменить переводы в очереди',
      save: 'Сохранить общие настройки',
    },
  },

  // ── ProvidersSettingsPage ───────────────────────────────────────────
  providersSettings: {
    searchPlaceholder: 'Поиск провайдеров...',
    addCustomProvider: 'Добавить свой провайдер',
    notConfigured: 'Не настроено',
    customSection: 'Пользовательские',
    unnamedProvider: 'Провайдер без имени',
    newCustomProvider: 'Новый пользовательский провайдер',
    draft: 'Черновик',
    customProvider: 'Пользовательский провайдер',
    customDescription: 'Подключите любой OpenAI-совместимый API endpoint с собственным именем и моделью.',
    displayName: {
      eyebrow: 'Отображаемое имя',
      placeholder: 'Мой пользовательский провайдер',
    },
    apiBaseUrl: {
      eyebrow: 'API Base URL',
      placeholder: 'https://api.example.com/v1',
    },
    apiKey: {
      eyebrow: 'API-ключ',
      replaceTitle: 'Нажмите, чтобы заменить API-ключ',
      hideKey: 'Скрыть ключ',
      showKey: 'Показать ключ',
      placeholder: 'Вставьте API-ключ...',
      getKey: 'Получить API-ключ',
    },
    modelName: {
      eyebrow: 'Имя модели',
      placeholder: 'например, gpt-4o, claude-3-5-sonnet-20241022, ...',
    },
    validation: {
      nameRequired: 'Требуется отображаемое имя.',
      urlRequired: 'Требуется API Base URL.',
      modelRequired: 'Требуется имя модели.',
    },
    actions: {
      setActive: 'Сделать активным',
      delete: 'Удалить',
      addProvider: 'Добавить провайдера',
      saveChanges: 'Сохранить изменения',
    },
    status: {
      active: 'Активен',
      inactive: 'Неактивен',
      model_one: '[[count]] модель',
      model_other: '[[count]] моделей',
    },
    models: {
      eyebrow: 'Модели',
      fetching: 'Загрузка...',
      fetchModels: 'Получить модели',
      searchPlaceholder: 'Поиск моделей...',
      showing_one: 'Показана [[count]] модель · включено [[enabled]]',
      showing_other: 'Показано [[count]] моделей · включено [[enabled]]',
      fetchHintNoKey: 'Введите API-ключ и нажмите «Получить модели», чтобы увидеть доступные модели.',
      fetchHintHasKey: 'Нажмите «Получить модели», чтобы загрузить доступные модели.',
      failedToFetch: 'Не удалось получить модели',
    },
  },

  // ── Страница настройки глоссария ──────────────────────────────────────
  terminologySettings: {
    summary: {
      label: 'Глоссарий',
      count_one: '[[count]] термин',
      count_other: '[[count]] терминов',
      hint: 'Термины вставляются в промпт LLM, если для активного целевого языка задан перевод.',
    },
    activeLanguage: {
      label: 'Активный целевой язык',
      hint: 'Используются только термины с переводом на этот язык.',
    },
    searchPlaceholder: 'Поиск терминов...',
    emptyState: 'Термины пока не заданы. Добавьте игровые термины с переводами, чтобы помочь LLM точно переводить сообщения чата EVE.',
    termsLabel: 'Термины',
    actions: {
      addTerm: 'Добавить термин',
      addFirst: 'Добавить первый термин',
      delete: 'Удалить',
    },
    editor: {
      newTitle: 'Новый термин',
      editTitle: 'Редактировать термин',
      description: 'Определите один и тот же игровой термин на одном или нескольких языках. Ни один язык не считается исходным — все равноправны.',
      notesLabel: 'Примечания (опционально)',
      notesPlaceholder: 'напр. Cynosural Field — используется для прыжков капитальных кораблей',
      termsLabel: 'Языки',
      addLanguage: '+ Добавить язык',
      noLanguages: 'Языки ещё не добавлены. Нажмите "+ Добавить язык", чтобы задать хотя бы один вариант.',
      termPlaceholder: 'напр. cyno, POS, 诱导力场...',
      multiValueHint: 'Разделяйте варианты запятыми, например: "cyno, cynosural, cyno field".',
      removeLanguage: 'Удалить язык',
      cancel: 'Отмена',
      addEntry: 'Добавить',
      saveEntry: 'Сохранить',
    },
  },
} satisfies LocaleSchema

export default ru