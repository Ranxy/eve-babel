/**
 * 简体中文 (zh-CN) 本地化文件。
 *
 * 插值定界符为 [[ ]]（与英文版相同），请勿使用 {{ }}。
 * 中文无复数形式，_one 与 _other 保持相同内容即可。
 */
import type { LocaleSchema } from './en'

const zhCN: LocaleSchema = {
  // ── 应用级页面 ────────────────────────────────────────────────────────
  app: {
    directorySetup: {
      eyebrow: '目录设置',
      title: '未检测到聊天日志文件夹',
      cta: '选择日志文件夹',
    },
    providerSetup: {
      eyebrow: '服务商设置',
      title: '尚未配置翻译服务商，翻译功能已暂停。',
      description:
        '点击停靠菜单中的设置选项，填入 API 密钥，选择已发现的模型，然后将该配置设为激活状态。',
      cta: '打开设置窗口',
    },
    noCharacters: {
      eyebrow: '无角色',
      title: '未找到聊天角色',
      description: '请添加或选择包含角色聊天历史的 EVE 聊天日志目录。',
    },
    dockMenu: {
      settings: '翻译设置',
      changeLogs: '更改日志文件夹',
      refresh: '刷新扫描',
    },
  },

  // ── 状态栏 ────────────────────────────────────────────────────────────
  statusBar: {
    showChannels: '显示频道',
    hideChannels: '隐藏频道',
    noCharacterFound: '未找到角色',
    targetLanguage: '目标语言',
    uiLanguage: '界面语言',
    queue: '队列',
    active: '[[count]] 个进行中',
  },

  // ── 频道列表 ──────────────────────────────────────────────────────────
  channelList: {
    eyebrow: '频道',
    title: '路由',
    focused: '当前聚焦',
    total: '共 [[count]] 个',
    noChannels: '所选角色下未发现任何频道。',
    msgCount: '[[count]] 条',
    translationOn: '翻译已开启',
    translationOff: '翻译已关闭',
    unpinLabel: '取消固定 [[name]]',
    pinLabel: '固定 [[name]]',
    pinned: '已固定',
    pin: '固定',
    noSession: '无会话',
  },

  // ── 消息面板 ──────────────────────────────────────────────────────────
  messageFeed: {
    eyebrow: '对话',
    chooseChannel: '请选择一个频道',
    subtitleLive: '新消息将自动进入实时翻译队列。',
    subtitleMuted: '此路由可见，但翻译当前已静音。',
    translationLive: '翻译实时',
    translationMuted: '翻译已静音',
    messages: '条消息',
    selectChannelHint: '在左侧选择一个频道以打开其对话流。',
    loadingMessages: '正在加载缓存消息\u2026',
    noMessages: '该频道暂无缓存消息。',
    loadingEarlier: '正在加载更早的缓存消息\u2026',
    scrollForEarlier: '向上滚动以加载更早的消息。',
    reachedStart: '已到达缓存历史记录的起点。',
    translationLabel: '译文',
    waitingForTranslation: '等待翻译中。',
    scrollToLatest: '滚动到最新消息',
    scrollToLatestTitle: '最新消息',
    translationStatus: {
      translated: '已翻译',
      error: '翻译错误',
      queued: '已加入翻译队列',
      translating: '翻译中',
      skipped: '翻译已跳过',
      idle: '翻译空闲',
    },
  },

  // ── 角色选择 ──────────────────────────────────────────────────────────
  characterPicker: {
    eyebrow: '角色选择',
    title: '选择当前 EVE 飞行员',
    description:
      '频道发现一次只针对一个角色，本地、军团及私聊记录按各自所属的日志文件分开管理。',
    characterId: '角色 ID [[id]]',
    channels: '[[count]] 个频道',
    sessions: '[[count]] 个会话',
  },

  // ── 设置面板 ──────────────────────────────────────────────────────────
  settingsPanel: {
    ariaLabel: '设置分区',
    sections: {
      general: '通用',
      providers: '服务商',
      terminology: '术语表',
    },
    footer: {
      allSaved: '所有更改已保存',
      close: '关闭',
      save: '保存',
    },
  },

  // ── 通用设置页 ────────────────────────────────────────────────────────
  generalSettings: {
    queueSnapshot: {
      label: '队列快照',
      waiting: '[[count]] 个等待中',
      activeBatches: '[[count]] 个活跃批次',
    },
    providerCoverage: {
      label: '服务商概况',
      profiles_one: '已保存 [[count]] 个配置',
      profiles_other: '已保存 [[count]] 个配置',
      activeHint: '当前有一个服务商配置处于激活状态，用于实时翻译。',
      noActiveHint: '尚未激活任何服务商配置。',
    },
    activeModel: {
      label: '当前翻译模型',
      noModels: '未配置任何模型',
      hint: '用于实时翻译的模型。请在「服务商」标签页中配置模型。',
    },
    targetLanguage: {
      label: '目标语言',
      hint: '选择每条翻译聊天所用的语言。',
    },
    debounceMs: {
      label: '防抖延迟（毫秒）',
      hint: '新批次进入翻译队列前的等待时间。',
    },
    maxQueueSize: {
      label: '队列最大容量',
      hint: '当多个频道同时活跃时，防止积压过多。',
    },
    llmDebugger: {
      label: '启用 LLM 调试器',
      hint: '将每次 LLM 请求的载荷及原始响应保存为 JSON 文件，存放在应用数据的 `llm-debug` 目录下。',
      enabled: '调试器已启用',
      disabled: '调试器已禁用',
    },
    translationPrompt: {
      label: '翻译提示词',
      // {{targetLanguage}} 是展示给用户的字面示例，不是 i18next 插值变量
      placeholder: '使用 {{targetLanguage}} 注入所选的目标语言。',
      hint: '在提示词任意位置使用 {{targetLanguage}} 以绑定所选语言。',
    },
    actions: {
      openDebugFolder: '打开调试文件夹',
      cancelTranslations: '取消排队中的翻译',
      save: '保存通用设置',
    },
  },

  // ── 服务商设置页 ──────────────────────────────────────────────────────
  providersSettings: {
    searchPlaceholder: '搜索服务商...',
    addCustomProvider: '添加自定义服务商',
    notConfigured: '未配置',
    customSection: '自定义',
    unnamedProvider: '未命名服务商',
    newCustomProvider: '新建自定义服务商',
    draft: '草稿',
    customProvider: '自定义服务商',
    customDescription: '连接任何兼容 OpenAI 的 API 端点，设置自定义名称和模型。',
    displayName: {
      eyebrow: '显示名称',
      placeholder: '我的自定义服务商',
    },
    apiBaseUrl: {
      eyebrow: 'API Base URL',
      placeholder: 'https://api.example.com/v1',
    },
    apiKey: {
      eyebrow: 'API 密钥',
      replaceTitle: '点击以替换 API 密钥',
      hideKey: '隐藏密钥',
      showKey: '显示密钥',
      placeholder: '在此粘贴您的 API 密钥...',
      getKey: '获取 API 密钥',
    },
    modelName: {
      eyebrow: '模型名称',
      placeholder: '例如 gpt-4o、claude-3-5-sonnet-20241022、...',
    },
    validation: {
      nameRequired: '显示名称不能为空。',
      urlRequired: 'API Base URL 不能为空。',
      modelRequired: '模型名称不能为空。',
    },
    actions: {
      setActive: '设为激活',
      delete: '删除',
      addProvider: '添加服务商',
      saveChanges: '保存更改',
    },
    status: {
      active: '已激活',
      inactive: '未激活',
      model_one: '[[count]] 个模型',
      model_other: '[[count]] 个模型',
    },
    models: {
      eyebrow: '模型',
      fetching: '获取中...',
      fetchModels: '获取模型列表',
      searchPlaceholder: '搜索模型...',
      showing_one: '显示 [[count]] 个模型 \u00b7 [[enabled]] 个已启用',
      showing_other: '显示 [[count]] 个模型 \u00b7 [[enabled]] 个已启用',
      fetchHintNoKey: '请输入 API 密钥后点击\u201c获取模型列表\u201d以查看可用模型。',
      fetchHintHasKey: '点击\u201c获取模型列表\u201d以加载可用模型。',
      failedToFetch: '获取模型列表失败',
    },
  },

  // ── 术语表设置页 ──────────────────────────────────────────────────────
  terminologySettings: {
    summary: {
      label: '术语表',
      count_one: '[[count]] 个术语',
      count_other: '[[count]] 个术语',
      hint: '当某个术语在激活的目标语言下有定义时，该术语会被注入到 LLM 提示词中。',
    },
    activeLanguage: {
      label: '当前目标语言',
      hint: '只有已定义了该语言翻译的术语才会被使用。',
    },
    searchPlaceholder: '搜索术语...',
    emptyState: '尚未定义任何术语条目。添加游戏专属术语及翻译，以帮助 LLM 准确翻译 EVE 聊天消息。',
    termsLabel: '术语',
    actions: {
      addTerm: '添加术语',
      addFirst: '添加第一个术语',
      delete: '删除',
    },
    editor: {
      newTitle: '新增术语',
      editTitle: '编辑术语',
      description: '定义同一游戏术语在一种或多种语言下的表达。不区分源语言与目标语言——所有语言地位均等。',
      notesLabel: '备注（可选）',
      notesPlaceholder: '例如: Cynosural Field — 用于旗舰跳跃导航',
      termsLabel: '语言',
      addLanguage: '+ 添加语言',
      noLanguages: '尚未添加任何语言。点击"+ 添加语言"以定义至少一种语言变体。',
      termPlaceholder: '例如: cyno, POS, 诱导力场...',
      multiValueHint: '多个变体请用逗号分隔，例如"cyno, cynosural, cyno field"。',
      removeLanguage: '移除语言',
      cancel: '取消',
      addEntry: '添加条目',
      saveEntry: '保存条目',
    },
  },
} satisfies LocaleSchema

export default zhCN
