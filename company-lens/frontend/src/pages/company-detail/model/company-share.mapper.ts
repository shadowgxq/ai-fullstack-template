import {
  findFirstReportText,
  getCompanyResearchAdditionalSections,
  getCompanyResearchAgentResultMarkdown,
  getCompanyResearchAgentResults,
  getCompanyResearchDirectAnswer,
  getLocalizedCompanyResearchIndustry,
  getOverallConclusionField,
  type CompanyResearchReport,
  type CompanyResearchLanguage,
  type CompanyResearchTask,
} from '../../../entities/company-research';
import {
  buildShareCopy,
  buildShareFullText,
  extractSharePosterEditorialContent,
  getCurrentPageShareUrl,
  type SharePayload,
} from '../../../features/share';

export type CompanyShareLabels = Readonly<{
  productName: string;
  slogan: string;
  researchType: string;
  risk: string;
}>;

function fileName(value: string): string {
  const safeValue = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safeValue || 'company-research'}.png`;
}

export function mapCompanyTaskToSharePayload(
  task: CompanyResearchTask,
  report: CompanyResearchReport,
  labels: CompanyShareLabels,
  language: CompanyResearchLanguage = 'zh-CN',
): SharePayload {
  const title = task.companyName || task.objectName || task.query;
  const directAnswer = getCompanyResearchDirectAnswer(report, language);
  const conclusion =
    getOverallConclusionField(report, 'decisionLabel') ||
    getOverallConclusionField(report, 'decision_label') ||
    getOverallConclusionField(report, 'decision') ||
    directAnswer ||
    task.conclusion?.decision;
  const risk =
    getOverallConclusionField(report, 'maximumRisk') ||
    getOverallConclusionField(report, 'maximum_risk');
  const separator = language === 'en-US' ? ': ' : '：';
  const editorial = extractSharePosterEditorialContent(title, directAnswer || conclusion, [
    ...getCompanyResearchAgentResults(report).map((agent) => ({
      label: agent.agentName,
      markdown:
        getCompanyResearchAgentResultMarkdown(agent, language) ||
        findFirstReportText(agent.normalizedOutput),
    })),
    ...getCompanyResearchAdditionalSections(report).map((section) => ({
      label: section.key,
      markdown: findFirstReportText(section.value),
    })),
  ]);
  const productEntry = getCurrentPageShareUrl();
  const resultText = buildShareCopy([
    editorial.headline,
    ...editorial.highlights.slice(0, 2).map((item) => item.title),
    risk ? `${labels.risk}${separator}${risk}` : undefined,
  ]);
  const fullText = buildShareFullText([
    labels.slogan,
    resultText,
    directAnswer,
    conclusion,
    ...editorial.highlights.map((item) =>
      [item.label, item.title, item.description].filter(Boolean).join(separator),
    ),
    risk ? `${labels.risk}${separator}${risk}` : undefined,
  ]);

  return {
    subjectKind: 'company',
    targetId: task.taskId,
    projectId: task.taskId,
    title,
    slogan: labels.slogan,
    result: resultText,
    fullText,
    fileName: fileName(task.stockCode || task.taskId),
    ...(task.completedAt || task.createdAt ? { dataDate: task.completedAt || task.createdAt } : {}),
    ...(risk ? { riskStatement: risk } : {}),
    productEntry,
    landingCapability: 'none',
    poster: {
      variant: 'research-brief',
      eyebrow: labels.productName,
      badge: labels.researchType,
      title: editorial.headline,
      ...(editorial.summary
        ? { identity: editorial.summary }
        : task.stockCode
          ? { identity: task.stockCode }
          : {}),
      metadata: [
        task.market,
        getLocalizedCompanyResearchIndustry(
          language,
          task.industryZh,
          task.industryEn,
          task.industry,
        ),
        title,
      ].filter((value): value is string => Boolean(value)),
      ...(editorial.highlights.length ? { highlights: editorial.highlights } : {}),
      ...(risk ? { riskLabel: labels.risk, riskStatement: risk } : {}),
      ...(task.completedAt || task.createdAt
        ? { dataDate: task.completedAt || task.createdAt }
        : {}),
      productEntry,
    },
  };
}
