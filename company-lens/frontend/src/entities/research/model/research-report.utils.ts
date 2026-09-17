import type { AgentReport, AgentReportBlock, ResearchMessage } from './research.types';

function appendBlock(block: AgentReportBlock, message: ResearchMessage): AgentReportBlock {
  return {
    ...block,
    content: `${block.content}\n\n${message.content}`,
    messageIds: [...block.messageIds, message.messageId],
    ...(message.messageSequence !== undefined
      ? { messageSequences: [...(block.messageSequences ?? []), message.messageSequence] }
      : {}),
  };
}

function createBlock(message: ResearchMessage): AgentReportBlock {
  return {
    stage: message.stage,
    ...(message.rawStage ? { rawStage: message.rawStage } : {}),
    content: message.content,
    contentType: message.contentType,
    ...(message.rawContentType ? { rawContentType: message.rawContentType } : {}),
    messageIds: [message.messageId],
    ...(message.messageSequence !== undefined
      ? { messageSequences: [message.messageSequence] }
      : {}),
  };
}

/** 将历史和实时 message 统一追加到报告 read model，连续 stage 只形成一个视觉块。 */
export function appendResearchMessageToReport(
  report: AgentReport,
  message: ResearchMessage,
): AgentReport {
  const blocks = [...(report.blocks ?? [])];
  if (blocks.some((block) => block.messageIds.includes(message.messageId))) {
    return report;
  }
  if (message.stage !== 'CITATION') {
    const lastBlock = blocks.at(-1);
    if (
      lastBlock?.stage === message.stage &&
      lastBlock.contentType === message.contentType &&
      lastBlock.rawContentType === message.rawContentType
    ) {
      blocks[blocks.length - 1] = appendBlock(lastBlock, message);
    } else {
      blocks.push(createBlock(message));
    }
  }

  const isReport = message.stage === 'REPORT';
  const isCitation = message.stage === 'CITATION';
  const rawReport = isReport
    ? report.rawReport
      ? `${report.rawReport}\n\n${message.content}`
      : message.content
    : report.rawReport;
  const sources = isCitation
    ? [...(report.sources ?? []), { category: 'source' as const, content: message.content }]
    : report.sources;

  return {
    ...report,
    reportStatus: isReport ? 'available' : report.reportStatus,
    reportReady: report.reportReady || isReport,
    blocks,
    ...(rawReport !== undefined ? { rawReport } : {}),
    ...(sources !== undefined ? { sources } : {}),
  };
}
