import type {
  CompanyResearchAgentResult,
  CompanyResearchLanguage,
  CompanyResearchReport,
  JsonValue,
} from './company-research.types';
import { i18n } from '../../../shared/i18n';

export const COMPANY_RESEARCH_REPORT_SECTION_ORDER = [
  'overallConclusion',
  'directAnswer',
  'businessModel',
  'financialQuality',
  'industryCompetition',
  'bullCase',
  'bearCase',
  'watchItems',
  'overall_conclusion',
  'direct_answer',
  'direct_conclusion',
  'business_model',
  'moat',
  'financial_quality',
  'industry_competition',
  'management',
  'risks',
  'valuation',
  'perspectives',
  'consensus',
  'disagreements',
  'bull_case',
  'bear_case',
  'watch_items',
  'sources',
  'warnings',
  'limitations',
] as const;

const ACTUAL_REPORT_FIELDS = new Set([
  'overallConclusion',
  'directAnswer',
  'capabilitiesSummary',
  'agentResults',
  'overall_conclusion',
  'direct_answer',
  'capabilities_summary',
  'agent_results',
]);

const SUMMARY_AGENT_NAMES = new Set(['decision_aggregator', 'synthesis']);
const SOURCE_URL_KEYS = ['href', 'link', 'uri', 'url'] as const;
const SOURCE_LABEL_KEYS = ['label', 'name', 'source', 'title'] as const;
const SOURCE_DETAIL_KEYS = ['description', 'publisher', 'summary'] as const;
const MISSING_CONCLUSION_VALUE_PATTERN = /^insufficient[\s_-]*data$/i;
const COMPANY_RESEARCH_INDUSTRY_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
  光通信设备: 'opticalCommunicationEquipment',
  'optical communication equipment': 'opticalCommunicationEquipment',
};

export type CompanyResearchReportSection = Readonly<{
  key: string;
  value: JsonValue;
}>;

export type CompanyResearchSourceItem = Readonly<{
  label: string;
  url?: string;
  detail?: string;
}>;

export function selectCompanyResearchText(
  language: CompanyResearchLanguage,
  zh: string | undefined,
  en: string | undefined,
  fallback?: string,
): string | undefined {
  const candidates = language === 'en-US' ? [en, zh, fallback] : [zh, en, fallback];
  return candidates.find((value) => Boolean(value?.trim()))?.trim();
}

export function getLocalizedCompanyResearchIndustry(
  language: CompanyResearchLanguage,
  industryZh: string | undefined,
  industryEn: string | undefined,
  industry?: string,
): string | undefined {
  const value = selectCompanyResearchText(language, industryZh, industryEn, industry);
  if (!value) return undefined;

  const translationKey =
    COMPANY_RESEARCH_INDUSTRY_TRANSLATION_KEYS[value] ??
    COMPANY_RESEARCH_INDUSTRY_TRANSLATION_KEYS[value.toLowerCase()];
  if (!translationKey) return value;

  const locale = language === 'en-US' ? 'en' : 'zh';
  return i18n.getFixedT(locale)(`companyResearch.industryValues.${translationKey}`, {
    defaultValue: value,
  });
}

export function getCompanyResearchAgentResultMarkdown(
  result: CompanyResearchAgentResult,
  language: CompanyResearchLanguage,
): string | undefined {
  return selectCompanyResearchText(
    language,
    result.reportMarkdownZh,
    result.reportMarkdownEn,
    result.reportMarkdown,
  );
}

function hasContent(value: JsonValue): boolean {
  if (value === null) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasContent);
  return Object.values(value).some(hasContent);
}

export function getCompanyResearchReportSections(
  report: CompanyResearchReport,
): readonly CompanyResearchReportSection[] {
  const orderedKeys = new Set<string>(COMPANY_RESEARCH_REPORT_SECTION_ORDER);
  const keys = [
    ...COMPANY_RESEARCH_REPORT_SECTION_ORDER.filter((key) => key in report),
    ...Object.keys(report)
      .filter((key) => !orderedKeys.has(key))
      .sort(),
  ];
  return keys.flatMap((key) => {
    const value = report[key];
    return value !== undefined && hasContent(value) ? [{ key, value }] : [];
  });
}

function isJsonObject(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeCompanyResearchConclusionValue(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();
  if (!normalizedValue || MISSING_CONCLUSION_VALUE_PATTERN.test(normalizedValue)) {
    return undefined;
  }
  return normalizedValue;
}

function normalizeAgentName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_agent$/, '');
}

function firstObjectString(
  value: Readonly<Record<string, JsonValue>>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const field = jsonString(value[key]);
    if (field) return field;
  }
  return undefined;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseSourceItem(value: JsonValue): CompanyResearchSourceItem | undefined {
  if (typeof value === 'string') {
    const label = value.trim();
    if (!label) return undefined;
    return isHttpUrl(label) ? { label, url: label } : { label };
  }
  if (!isJsonObject(value)) return undefined;

  const urlValue = firstObjectString(value, SOURCE_URL_KEYS);
  const url = urlValue && isHttpUrl(urlValue) ? urlValue : undefined;
  const label = firstObjectString(value, SOURCE_LABEL_KEYS) ?? urlValue;
  const detail = firstObjectString(value, SOURCE_DETAIL_KEYS);
  if (!label && !detail) return undefined;

  return {
    label: label ?? detail ?? '',
    ...(url ? { url } : {}),
    ...(detail && detail !== label ? { detail } : {}),
  };
}

export function isCompanyResearchSummaryAgentName(value: string): boolean {
  const normalizedName = normalizeAgentName(value);
  return SUMMARY_AGENT_NAMES.has(normalizedName) || normalizedName.endsWith('_synthesis');
}

export function getCompanyResearchSourceItems(
  value: JsonValue | undefined,
): readonly CompanyResearchSourceItem[] {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    const parsed = parseSourceItem(item);
    return parsed ? [parsed] : [];
  });
}

export function getCompanyResearchOverallConclusion(
  report: CompanyResearchReport,
): JsonValue | undefined {
  return report.overallConclusion ?? report.overall_conclusion;
}

export function getCompanyResearchDirectAnswer(
  report: CompanyResearchReport,
  language?: CompanyResearchLanguage,
): string | undefined {
  const directAnswer = report.directAnswer ?? report.direct_answer;
  if (typeof directAnswer === 'string') return jsonString(directAnswer);
  if (!isJsonObject(directAnswer)) return undefined;

  const reason = jsonString(directAnswer.reason);
  const reasonZh = jsonString(directAnswer.reasonZh) ?? jsonString(directAnswer.reason_zh);
  const reasonEn = jsonString(directAnswer.reasonEn) ?? jsonString(directAnswer.reason_en);
  return (
    (language ? selectCompanyResearchText(language, reasonZh, reasonEn, reason) : undefined) ??
    reason ??
    jsonString(directAnswer.recommendation) ??
    jsonString(directAnswer.holdingAction) ??
    jsonString(directAnswer.emptyPositionAction) ??
    reasonZh ??
    reasonEn ??
    findFirstReportText(directAnswer)
  );
}

export function getCompanyResearchCapabilitiesSummary(
  report: CompanyResearchReport,
): Readonly<Record<string, JsonValue>> | undefined {
  const summary = report.capabilitiesSummary ?? report.capabilities_summary;
  return isJsonObject(summary) ? summary : undefined;
}

export function getCompanyResearchAgentResults(
  report: CompanyResearchReport,
): readonly CompanyResearchAgentResult[] {
  const values = report.agentResults ?? report.agent_results;
  if (!Array.isArray(values)) return [];

  return values.flatMap((value) => {
    if (!isJsonObject(value)) return [];
    const agentName = jsonString(value.agentName) ?? jsonString(value.agent_name);
    if (!agentName) return [];
    const reportMarkdown = jsonString(value.reportMarkdown) ?? jsonString(value.report_markdown);
    const reportMarkdownZh =
      jsonString(value.reportMarkdownZh) ?? jsonString(value.report_markdown_zh);
    const reportMarkdownEn =
      jsonString(value.reportMarkdownEn) ?? jsonString(value.report_markdown_en);
    const normalizedOutput = value.normalizedOutput ?? value.normalized_output;
    return [
      {
        agentName,
        ...(reportMarkdown ? { reportMarkdown } : {}),
        ...(reportMarkdownZh ? { reportMarkdownZh } : {}),
        ...(reportMarkdownEn ? { reportMarkdownEn } : {}),
        ...(normalizedOutput !== undefined && isCompanyResearchSummaryAgentName(agentName)
          ? { normalizedOutput }
          : {}),
      },
    ];
  });
}

export function getCompanyResearchAdditionalSections(
  report: CompanyResearchReport,
): readonly CompanyResearchReportSection[] {
  return getCompanyResearchReportSections(report).filter(
    (section) => !ACTUAL_REPORT_FIELDS.has(section.key),
  );
}

export function getOverallConclusionField(
  report: CompanyResearchReport,
  field: string,
): string | undefined {
  const conclusion = report.overallConclusion ?? report.overall_conclusion;
  return isJsonObject(conclusion)
    ? normalizeCompanyResearchConclusionValue(jsonString(conclusion[field]))
    : undefined;
}

export function getLocalizedOverallConclusionField(
  report: CompanyResearchReport,
  field: string,
  language: CompanyResearchLanguage,
): string | undefined {
  return selectCompanyResearchText(
    language,
    getOverallConclusionField(report, `${field}Zh`) ??
      getOverallConclusionField(report, `${field}_zh`),
    getOverallConclusionField(report, `${field}En`) ??
      getOverallConclusionField(report, `${field}_en`),
    getOverallConclusionField(report, field),
  );
}

export function humanizeReportKey(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function findFirstReportText(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = findFirstReportText(item);
      if (text) return text;
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const text = findFirstReportText(item);
      if (text) return text;
    }
  }
  return undefined;
}
