export type ResearchSuggestionKey =
  | 'aiCompute'
  | 'nuclearPower'
  | 'humanoidRobot'
  | 'commercialSpace'
  | 'innovativeDrugs'
  | 'solidStateBattery'
  | 'semiconductorEquipment'
  | 'lowAltitudeEconomy'
  | 'intelligentDriving';

export type ResearchSuggestionPromptKey =
  | 'aiComputeOpportunity'
  | 'aiComputeOutlook'
  | 'aiComputeScreen'
  | 'nuclearPowerOpportunity'
  | 'nuclearPowerValueChain'
  | 'nuclearPowerScreen'
  | 'humanoidRobotOpportunity'
  | 'humanoidRobotValueChain'
  | 'humanoidRobotScreen'
  | 'commercialSpaceOpportunity'
  | 'commercialSpaceValueChain'
  | 'commercialSpaceScreen'
  | 'innovativeDrugsOpportunity'
  | 'innovativeDrugsOutlook'
  | 'innovativeDrugsScreen'
  | 'solidStateBatteryOpportunity'
  | 'solidStateBatteryValueChain'
  | 'solidStateBatteryScreen'
  | 'semiconductorEquipmentOpportunity'
  | 'semiconductorEquipmentLocalization'
  | 'semiconductorEquipmentScreen'
  | 'lowAltitudeEconomyOpportunity'
  | 'lowAltitudeEconomyValueChain'
  | 'lowAltitudeEconomyScreen'
  | 'intelligentDrivingOpportunity'
  | 'intelligentDrivingOutlook'
  | 'intelligentDrivingScreen';

/**
 * 首页研究对象推荐池。面向海外推广的 global 条目占 50/60，同时保留 10 个中国市场常见对象。
 * 单屏展示数量与换批策略由 ResearchLaunchForm 控制。
 */
export const RESEARCH_EXAMPLE_POOLS = {
  global: [
    'nvidia',
    'nvda',
    'tesla',
    'apple',
    'microsoft',
    'amazon',
    'meta',
    'google',
    'berkshireHathaway',
    'tsmc',
    'asml',
    'broadcom',
    'amd',
    'palantir',
    'jpmorganChase',
    'visa',
    'costco',
    'eliLilly',
    'novoNordisk',
    'exxonMobil',
    'toyota',
    'mercadoLibre',
    'shopify',
    'lvmh',
    'jensenHuang',
    'elonMusk',
    'iphone',
    'aws',
    'oracle',
    'salesforce',
    'netflix',
    'adobe',
    'qualcomm',
    'armHoldings',
    'micron',
    'appliedMaterials',
    'lamResearch',
    'serviceNow',
    'uber',
    'airbnb',
    'walmart',
    'cocaCola',
    'mcdonalds',
    'johnsonJohnson',
    'astraZeneca',
    'shell',
    'siemens',
    'sap',
    'sony',
    'samsungElectronics',
  ],
  china: [
    'tencent',
    'meituan',
    'alibaba',
    'byd',
    'catl',
    'kweichowMoutai',
    'pingAn',
    'xiaomi',
    'smic',
    'wechat',
  ],
} as const;

export const RESEARCH_EXAMPLES = [
  ...RESEARCH_EXAMPLE_POOLS.global,
  ...RESEARCH_EXAMPLE_POOLS.china,
] as const;

export type ResearchExampleKey = (typeof RESEARCH_EXAMPLES)[number];

export type ResearchSuggestion = {
  /** i18n 文案 key：`research.suggestions.<key>`。 */
  key: ResearchSuggestionKey;
  objectType: 'industry' | 'theme';
  promptKeys: readonly [
    ResearchSuggestionPromptKey,
    ResearchSuggestionPromptKey,
    ResearchSuggestionPromptKey,
  ];
};

/** 单次研究启动指令的前端输入上限，按 Unicode code point 计数。 */
export const MAX_RESEARCH_QUERY_LENGTH = 500;

/** 自然语言研究示例；点击后从固定文案池中选择一句回填，不触发股票搜索。 */
export const SUGGESTIONS: readonly ResearchSuggestion[] = [
  {
    key: 'aiCompute',
    objectType: 'theme',
    promptKeys: ['aiComputeOpportunity', 'aiComputeOutlook', 'aiComputeScreen'],
  },
  {
    key: 'nuclearPower',
    objectType: 'industry',
    promptKeys: ['nuclearPowerOpportunity', 'nuclearPowerValueChain', 'nuclearPowerScreen'],
  },
  {
    key: 'humanoidRobot',
    objectType: 'theme',
    promptKeys: ['humanoidRobotOpportunity', 'humanoidRobotValueChain', 'humanoidRobotScreen'],
  },
  {
    key: 'commercialSpace',
    objectType: 'theme',
    promptKeys: [
      'commercialSpaceOpportunity',
      'commercialSpaceValueChain',
      'commercialSpaceScreen',
    ],
  },
  {
    key: 'innovativeDrugs',
    objectType: 'industry',
    promptKeys: ['innovativeDrugsOpportunity', 'innovativeDrugsOutlook', 'innovativeDrugsScreen'],
  },
  {
    key: 'solidStateBattery',
    objectType: 'theme',
    promptKeys: [
      'solidStateBatteryOpportunity',
      'solidStateBatteryValueChain',
      'solidStateBatteryScreen',
    ],
  },
  {
    key: 'semiconductorEquipment',
    objectType: 'industry',
    promptKeys: [
      'semiconductorEquipmentOpportunity',
      'semiconductorEquipmentLocalization',
      'semiconductorEquipmentScreen',
    ],
  },
  {
    key: 'lowAltitudeEconomy',
    objectType: 'theme',
    promptKeys: [
      'lowAltitudeEconomyOpportunity',
      'lowAltitudeEconomyValueChain',
      'lowAltitudeEconomyScreen',
    ],
  },
  {
    key: 'intelligentDriving',
    objectType: 'theme',
    promptKeys: [
      'intelligentDrivingOpportunity',
      'intelligentDrivingOutlook',
      'intelligentDrivingScreen',
    ],
  },
];

export const SUGGESTIONS_PER_BATCH = 3;
