import {
  findFirstReportText,
  getCompanyResearchAdditionalSections,
  getCompanyResearchAgentResultMarkdown,
  getCompanyResearchAgentResults,
  getCompanyResearchDirectAnswer,
  getLocalizedOverallConclusionField,
  getOverallConclusionField,
  normalizeCompanyResearchConclusionValue,
  selectCompanyResearchText,
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

export type CompanyResearchShareLabels = Readonly<{
  productName: string;
  slogan: string;
  researchType: string;
  conclusion: string;
  judgments: string;
  decision: string;
  confidence: string;
  companyQuality: string;
  valuationStatus: string;
  longTermOutlook: string;
  opportunity: string;
  risk: string;
  insufficientData: string;
  decisionLabels?: Readonly<Record<string, string>>;
}>;

const OVERALL_CONCLUSION_FIELD_ALIASES = {
  decision: ['decision'],
  decisionLabel: ['decision_label', 'decisionLabel'],
  reason: ['reason'],
  confidence: ['confidence', 'confidence_level', 'confidenceLevel'],
  companyQuality: ['companyQuality', 'company_quality'],
  valuationStatus: ['valuationStatus', 'valuation_status'],
  longTermOutlook: ['longTermOutlook', 'long_term_outlook'],
  biggestOpportunity: [
    'biggestOpportunity',
    'biggest_opportunity',
    'maximumOpportunity',
    'maximum_opportunity',
  ],
  biggestRisk: ['biggestRisk', 'biggest_risk', 'maximumRisk', 'maximum_risk'],
} as const;

function getFirstOverallConclusionField(
  report: CompanyResearchReport,
  fields: readonly string[],
): string | undefined {
  for (const field of fields) {
    const value = getOverallConclusionField(report, field);
    if (value) return value;
  }
  return undefined;
}

function fileName(value: string): string {
  const safeValue = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safeValue || 'research-result'}.png`;
}

function getFirstLocalizedOverallConclusionField(
  report: CompanyResearchReport,
  fields: readonly string[],
  language: CompanyResearchLanguage,
): string | undefined {
  for (const field of fields) {
    const value = getLocalizedOverallConclusionField(report, field, language);
    if (value) return value;
  }
  return undefined;
}

export function mapCompanyResearchReportToSharePayload(
  task: CompanyResearchTask,
  report: CompanyResearchReport,
  labels: CompanyResearchShareLabels,
  language: CompanyResearchLanguage = 'zh-CN',
): SharePayload {
  const title = task.companyName || task.objectName || task.query;
  const directAnswer = normalizeCompanyResearchConclusionValue(
    getCompanyResearchDirectAnswer(report, language),
  );
  const decisionValue = getFirstOverallConclusionField(
    report,
    OVERALL_CONCLUSION_FIELD_ALIASES.decision,
  );
  const decision =
    getFirstOverallConclusionField(report, OVERALL_CONCLUSION_FIELD_ALIASES.decisionLabel) ||
    (decisionValue ? labels.decisionLabels?.[decisionValue.toUpperCase()] : undefined) ||
    decisionValue ||
    normalizeCompanyResearchConclusionValue(task.conclusion?.decision);
  const reason = getFirstOverallConclusionField(report, OVERALL_CONCLUSION_FIELD_ALIASES.reason);
  const conclusion = decision || directAnswer || labels.insufficientData;
  const risk =
    getFirstLocalizedOverallConclusionField(
      report,
      OVERALL_CONCLUSION_FIELD_ALIASES.biggestRisk,
      language,
    ) ||
    selectCompanyResearchText(
      language,
      normalizeCompanyResearchConclusionValue(task.conclusion?.biggestRiskZh),
      normalizeCompanyResearchConclusionValue(task.conclusion?.biggestRiskEn),
      normalizeCompanyResearchConclusionValue(task.conclusion?.biggestRisk),
    );
  const companyQuality =
    getFirstOverallConclusionField(report, OVERALL_CONCLUSION_FIELD_ALIASES.companyQuality) ||
    normalizeCompanyResearchConclusionValue(task.conclusion?.companyQuality);
  const valuationStatus =
    getFirstOverallConclusionField(report, OVERALL_CONCLUSION_FIELD_ALIASES.valuationStatus) ||
    normalizeCompanyResearchConclusionValue(task.conclusion?.valuationStatus);
  const longTermOutlook =
    getFirstOverallConclusionField(report, OVERALL_CONCLUSION_FIELD_ALIASES.longTermOutlook) ||
    normalizeCompanyResearchConclusionValue(task.conclusion?.longTermOutlook);
  const biggestOpportunity =
    getFirstLocalizedOverallConclusionField(
      report,
      OVERALL_CONCLUSION_FIELD_ALIASES.biggestOpportunity,
      language,
    ) ||
    selectCompanyResearchText(
      language,
      normalizeCompanyResearchConclusionValue(task.conclusion?.biggestOpportunityZh),
      normalizeCompanyResearchConclusionValue(task.conclusion?.biggestOpportunityEn),
      normalizeCompanyResearchConclusionValue(task.conclusion?.biggestOpportunity),
    );
  const agentSections = getCompanyResearchAgentResults(report).map((agent) => ({
    label: agent.agentName,
    markdown:
      getCompanyResearchAgentResultMarkdown(agent, language) ||
      findFirstReportText(agent.normalizedOutput),
  }));
  const editorial = extractSharePosterEditorialContent(title, directAnswer || conclusion, [
    ...agentSections,
    ...getCompanyResearchAdditionalSections(report).map((section) => ({
      label: section.key,
      markdown: findFirstReportText(section.value),
    })),
  ]);
  const productEntry = getCurrentPageShareUrl();
  const metrics = [
    {
      label: labels.companyQuality,
      value: companyQuality ?? labels.insufficientData,
      tone: 'positive' as const,
    },
    {
      label: labels.valuationStatus,
      value: valuationStatus ?? labels.insufficientData,
      tone: 'caution' as const,
    },
    {
      label: labels.longTermOutlook,
      value: longTermOutlook ?? labels.insufficientData,
      tone: 'positive' as const,
    },
  ];
  const signals = [
    {
      label: labels.opportunity,
      value: biggestOpportunity ?? labels.insufficientData,
      tone: 'opportunity' as const,
    },
    { label: labels.risk, value: risk ?? labels.insufficientData, tone: 'risk' as const },
  ];
  const summary = reason || editorial.summary || directAnswer || labels.insufficientData;
  const separator = language === 'en-US' ? ': ' : '：';
  const resultText = buildShareCopy([
    editorial.headline,
    ...editorial.highlights.slice(0, 2).map((item) => item.title),
    risk ? `${labels.risk}${separator}${risk}` : undefined,
  ]);
  const fullText = buildShareFullText([
    labels.slogan,
    resultText,
    summary,
    directAnswer,
    conclusion,
    ...editorial.highlights.map((item) =>
      [item.label, item.title, item.description].filter(Boolean).join(separator),
    ),
    risk ? `${labels.risk}${separator}${risk}` : undefined,
  ]);

  return {
    subjectKind: 'research-result',
    targetId: task.taskId,
    projectId: task.taskId,
    title,
    slogan: labels.slogan,
    result: resultText,
    fullText,
    fileName: fileName(task.taskId),
    dataDate: task.completedAt || task.createdAt,
    riskStatement: risk,
    productEntry,
    landingCapability: 'project',
    poster: {
      variant: 'research-brief',
      eyebrow: labels.productName,
      badge: labels.conclusion,
      title: editorial.headline,
      identity: summary || task.stockCode,
      metadata: [title, task.stockCode, labels.researchType].filter((value): value is string =>
        Boolean(value),
      ),
      highlights: editorial.highlights,
      conclusionLabel: labels.conclusion,
      conclusion,
      riskLabel: labels.risk,
      riskStatement: risk,
      dataDate: task.completedAt || task.createdAt,
      productEntry,
      researchBrief: {
        decisionLabel: labels.decision,
        decision: decision || '',
        confidenceLabel: labels.confidence,
        confidence:
          getFirstOverallConclusionField(report, OVERALL_CONCLUSION_FIELD_ALIASES.confidence) ||
          normalizeCompanyResearchConclusionValue(task.conclusion?.confidence) ||
          labels.insufficientData,
        summary,
        summaryDetail:
          reason && directAnswer && reason !== directAnswer
            ? directAnswer
            : editorial.summary && directAnswer && editorial.summary !== directAnswer
              ? directAnswer
              : undefined,
        metricsLabel: labels.judgments,
        metrics,
        signals,
      },
    },
  };
}
