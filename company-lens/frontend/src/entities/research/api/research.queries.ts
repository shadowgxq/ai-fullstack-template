import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { getResearchRepository } from './research.composition';
import { appendResearchMessageToReport } from '../model/research-report.utils';
import {
  createResearchThinkingStepFromEvent,
  extractResearchThinkingSteps,
  mergeResearchThinkingSteps,
} from '../model/research-thinking.utils';
import type {
  AgentReport,
  ConfirmResearchResolutionCommand,
  CreateResearchCommand,
  ResearchAgentProgress,
  ResearchCompany,
  ResearchEvent,
  ResearchMessage,
  ResearchProject,
  ResearchProjectStatus,
  ResearchProgress,
  ResearchProjectSnapshot,
  ResearchResult,
  ResearchThinkingStep,
  StockCandidate,
} from '../model/research.types';

export const researchQueryKeys = {
  all: () => ['research'] as const,
  projects: () => ['research', 'projects'] as const,
  projectSnapshot: (projectId: string) => ['research', 'project-snapshot', projectId] as const,
  project: (projectId: string) => researchQueryKeys.projectSnapshot(projectId),
  progress: (projectId: string) => researchQueryKeys.projectSnapshot(projectId),
  result: (projectId: string) => researchQueryKeys.projectSnapshot(projectId),
  stockCandidates: (query: string) => ['research', 'stock-candidates', query] as const,
  agentReports: (projectId: string) => ['research', 'agent-report', projectId] as const,
  agentReport: (projectId: string, agentId: string) =>
    [...researchQueryKeys.agentReports(projectId), agentId] as const,
  agentReportMessages: (projectId: string, agentId: string) =>
    ['research', 'agent-report-messages', projectId, agentId] as const,
  thinkingHistory: (projectId: string, conversationId: string) =>
    ['research', 'thinking-history', projectId, conversationId] as const,
  thinkingLive: (projectId: string) => ['research', 'thinking-live', projectId] as const,
  company: (projectId: string, companyId: string) =>
    ['research', 'company', projectId, companyId] as const,
};

export function listResearchProjects(): Promise<readonly ResearchProject[]> {
  return getResearchRepository().listProjects?.() ?? Promise.resolve([]);
}

export function useSearchStockCandidates(
  query?: string,
): UseQueryResult<readonly StockCandidate[], Error> {
  const normalizedQuery = query?.trim() ?? '';
  const enabled = normalizedQuery.length > 0;

  return useQuery({
    queryKey: researchQueryKeys.stockCandidates(normalizedQuery),
    queryFn: () => getResearchRepository().searchStockCandidates(normalizedQuery),
    enabled,
    staleTime: 30 * 1000,
  });
}

export type RetryResearchAgentInput = {
  projectId: string;
  agentType: string;
};

const TERMINAL_PROJECT_STATUSES = new Set<ResearchProjectStatus>([
  'completed',
  'failed',
  'cancelled',
]);

function isTerminalProjectStatus(status: ResearchProjectStatus): boolean {
  return TERMINAL_PROJECT_STATUSES.has(status);
}

function isTerminalAgentStatus(status: ResearchAgentProgress['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function maxProgress(
  current: number | undefined,
  incoming: number | undefined,
): number | undefined {
  if (incoming === undefined) {
    return current;
  }
  return current === undefined ? incoming : Math.max(current, incoming);
}

export function reconcileResearchSnapshot(
  snapshot: ResearchProjectSnapshot,
): ResearchProjectSnapshot {
  const isSuccessfulTerminal =
    snapshot.project.status === 'completed' &&
    snapshot.result.resultReady &&
    snapshot.result.resultCompleteness === 'full';
  if (!isSuccessfulTerminal) {
    return snapshot;
  }

  const staleAgents = snapshot.progress.agentTasks.filter(
    (agent) => agent.status === 'waiting' || agent.status === 'running',
  );
  if (staleAgents.length === 0) {
    return snapshot;
  }

  const hasIssue = snapshot.contractIssues?.some(
    (issue) =>
      issue.code === 'snapshot-inconsistent' && issue.details?.reason === 'terminal-agent-stale',
  );
  const agentTasks = snapshot.progress.agentTasks.map((agent) =>
    agent.status === 'waiting' || agent.status === 'running'
      ? {
          ...agent,
          rawStatus: agent.rawStatus ?? agent.status,
          status: 'completed' as const,
          progressPercent: 100,
          reportReady: true,
          canRetry: false,
        }
      : agent,
  );

  return {
    ...snapshot,
    progress: { ...snapshot.progress, agentTasks },
    ...(!hasIssue
      ? {
          contractIssues: [
            ...(snapshot.contractIssues ?? []),
            {
              code: 'snapshot-inconsistent' as const,
              message: `Completed project ${snapshot.project.projectId} returned non-terminal Agent states.`,
              projectId: snapshot.project.projectId,
              details: {
                reason: 'terminal-agent-stale',
                agentIds: staleAgents.map((agent) => agent.agentId),
              },
            },
          ],
        }
      : {}),
  };
}

function snapshotQueryOptions(projectId: string) {
  return {
    queryKey: researchQueryKeys.projectSnapshot(projectId),
    queryFn: async () =>
      reconcileResearchSnapshot(await getResearchRepository().getProjectSnapshot(projectId)),
    enabled: projectId.length > 0,
  } as const;
}

export function useResearchProject(projectId?: string): UseQueryResult<ResearchProject, Error> {
  const normalizedProjectId = projectId ?? '';
  return useQuery({
    ...snapshotQueryOptions(normalizedProjectId),
    select: (snapshot: ResearchProjectSnapshot) => snapshot.project,
  });
}

export function useResearchProgress(projectId?: string): UseQueryResult<ResearchProgress, Error> {
  const normalizedProjectId = projectId ?? '';
  return useQuery({
    ...snapshotQueryOptions(normalizedProjectId),
    select: (snapshot: ResearchProjectSnapshot) => snapshot.progress,
  });
}

export function useResearchResult(projectId?: string): UseQueryResult<ResearchResult, Error> {
  const normalizedProjectId = projectId ?? '';
  return useQuery({
    ...snapshotQueryOptions(normalizedProjectId),
    select: (snapshot: ResearchProjectSnapshot) => snapshot.result,
  });
}

export function useResearchThinkingSteps(
  projectId?: string,
  conversationId?: string,
): readonly ResearchThinkingStep[] {
  const normalizedProjectId = projectId ?? '';
  const normalizedConversationId = conversationId ?? '';
  const historyQuery = useQuery({
    queryKey: researchQueryKeys.thinkingHistory(normalizedProjectId, normalizedConversationId),
    queryFn: async () => {
      const messages =
        (await getResearchRepository().getConversationMessages?.(normalizedConversationId)) ?? [];
      return extractResearchThinkingSteps(messages);
    },
    enabled: normalizedProjectId.length > 0 && normalizedConversationId.length > 0,
    staleTime: 30 * 1000,
  });
  const liveQuery = useQuery<readonly ResearchThinkingStep[]>({
    queryKey: researchQueryKeys.thinkingLive(normalizedProjectId),
    queryFn: () => Promise.resolve([]),
    enabled: false,
    initialData: [],
  });

  return useMemo(
    () => mergeResearchThinkingSteps(historyQuery.data ?? [], liveQuery.data),
    [historyQuery.data, liveQuery.data],
  );
}

export function useResearchAgentReport(
  projectId?: string,
  agentId?: string,
): UseQueryResult<AgentReport, Error> {
  const queryClient = useQueryClient();
  const normalizedProjectId = projectId ?? '';
  const normalizedAgentId = agentId ?? '';
  const enabled = normalizedProjectId.length > 0 && normalizedAgentId.length > 0;
  const messageKey = researchQueryKeys.agentReportMessages(normalizedProjectId, normalizedAgentId);

  return useQuery({
    queryKey: researchQueryKeys.agentReport(normalizedProjectId, normalizedAgentId),
    queryFn: async () => {
      const report = await getResearchRepository().getAgentReport(
        normalizedProjectId,
        normalizedAgentId,
      );
      const pendingMessages = queryClient.getQueryData<ResearchMessage[]>(messageKey) ?? [];
      return pendingMessages.reduce(appendResearchMessageToReport, report);
    },
    enabled,
  });
}

export function useResearchCompany(
  projectId?: string,
  companyId?: string,
): UseQueryResult<ResearchCompany, Error> {
  const normalizedProjectId = projectId ?? '';
  const normalizedCompanyId = companyId ?? '';
  const enabled = normalizedProjectId.length > 0 && normalizedCompanyId.length > 0;

  return useQuery({
    queryKey: researchQueryKeys.company(normalizedProjectId, normalizedCompanyId),
    queryFn: () => getResearchRepository().getCompany(normalizedProjectId, normalizedCompanyId),
    enabled,
  });
}

export function useCreateResearchProject(): UseMutationResult<
  ResearchProject,
  Error,
  CreateResearchCommand
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (command) => getResearchRepository().createResearch(command),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: researchQueryKeys.all() });
      queryClient.removeQueries({ queryKey: researchQueryKeys.projectSnapshot(project.projectId) });
    },
  });
}

export function useConfirmResearchResolution(): UseMutationResult<
  ResearchProject,
  Error,
  ConfirmResearchResolutionCommand
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (command) => getResearchRepository().confirmResearchResolution(command),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: researchQueryKeys.all() });
      queryClient.removeQueries({ queryKey: researchQueryKeys.projectSnapshot(project.projectId) });
    },
  });
}

function updateAgent(
  agent: ResearchAgentProgress,
  event: Extract<
    ResearchEvent,
    { type: 'agent_status' | 'agent_progress' | 'agent_summary' | 'agent_completed' }
  >,
): ResearchAgentProgress {
  if (agent.agentId !== event.agentId) {
    return agent;
  }
  if (event.type === 'agent_status') {
    if (isTerminalAgentStatus(agent.status) && event.status !== agent.status) {
      return agent;
    }
    const status =
      (agent.status === 'running' && event.status === 'waiting') ||
      (agent.status !== 'unknown' && event.status === 'unknown')
        ? agent.status
        : event.status;
    return {
      ...agent,
      status,
      ...(event.rawStatus ? { rawStatus: event.rawStatus } : {}),
      ...(maxProgress(agent.progressPercent, event.progressPercent) !== undefined
        ? { progressPercent: maxProgress(agent.progressPercent, event.progressPercent) }
        : {}),
      ...(event.displayName ? { displayName: event.displayName } : {}),
      reportReady: status === 'completed' ? agent.reportReady : false,
      canRetry: status === 'failed',
    };
  }
  if (event.type === 'agent_progress') {
    if (isTerminalAgentStatus(agent.status)) {
      return agent;
    }
    return {
      ...agent,
      progressPercent: maxProgress(agent.progressPercent, event.progressPercent),
    };
  }
  if (event.type === 'agent_completed') {
    if (agent.status === 'failed' || agent.status === 'cancelled') {
      return agent;
    }
    return {
      ...agent,
      status: 'completed',
      progressPercent: maxProgress(agent.progressPercent, event.progressPercent ?? 100),
      ...(event.displayName ? { displayName: event.displayName } : {}),
      reportReady: true,
      canRetry: false,
    };
  }
  return { ...agent, summary: event.summary };
}

export function applyResearchEventToSnapshot(
  snapshot: ResearchProjectSnapshot,
  event: ResearchEvent,
): ResearchProjectSnapshot {
  if (isTerminalProjectStatus(snapshot.project.status)) {
    return snapshot;
  }

  if (
    event.type === 'agent_status' ||
    event.type === 'agent_progress' ||
    event.type === 'agent_summary' ||
    event.type === 'agent_completed'
  ) {
    const agentTasks = snapshot.progress.agentTasks.map((agent) => updateAgent(agent, event));
    return {
      ...snapshot,
      progress: { ...snapshot.progress, agentTasks },
    };
  }

  if (event.type === 'project_status') {
    if (isTerminalProjectStatus(event.status)) {
      return snapshot;
    }
    const status =
      (snapshot.project.status === 'running' && event.status === 'waiting') ||
      (snapshot.project.status !== 'unknown' && event.status === 'unknown')
        ? snapshot.project.status
        : event.status;
    const progressPercent = maxProgress(snapshot.progress.progressPercent, event.progressPercent);
    return {
      ...snapshot,
      project: {
        ...snapshot.project,
        status,
        ...(event.rawStatus ? { rawStatus: event.rawStatus } : {}),
      },
      progress: {
        ...snapshot.progress,
        status,
        ...(event.rawStatus ? { rawStatus: event.rawStatus } : {}),
        ...(progressPercent !== undefined ? { progressPercent } : {}),
      },
    };
  }

  return snapshot;
}

export function useResearchProjectEvents(projectId?: string, afterSeq = 0): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const snapshotKey = researchQueryKeys.projectSnapshot(projectId);
    let active = true;
    let refreshPromise: Promise<void> | undefined;
    let regularRefreshQueued = false;
    let terminalRefreshQueued = false;

    const requestSnapshotRefresh = (kind: 'regular' | 'terminal') => {
      if (!active) {
        return;
      }
      if (refreshPromise) {
        if (kind === 'regular') {
          regularRefreshQueued = true;
        } else {
          terminalRefreshQueued = true;
        }
        return;
      }

      refreshPromise = queryClient.invalidateQueries({ queryKey: snapshotKey });
      const handleRefreshSettled = () => {
        refreshPromise = undefined;
        if (!active) {
          return;
        }

        const snapshot = queryClient.getQueryData<ResearchProjectSnapshot>(snapshotKey);
        const shouldRunTrailingRefresh =
          regularRefreshQueued ||
          (terminalRefreshQueued &&
            (!snapshot || !isTerminalProjectStatus(snapshot.project.status)));
        regularRefreshQueued = false;
        terminalRefreshQueued = false;
        if (shouldRunTrailingRefresh) {
          requestSnapshotRefresh('regular');
        }
      };
      void refreshPromise.then(handleRefreshSettled, handleRefreshSettled);
    };

    const subscription = getResearchRepository().subscribeProjectEvents(projectId, afterSeq, {
      onEvent: (event) => {
        const snapshot = queryClient.getQueryData<ResearchProjectSnapshot>(snapshotKey);
        if (event.type === 'agent_progress') {
          const thinkingStep = createResearchThinkingStepFromEvent(event);
          const belongsToSnapshot = snapshot?.progress.agentTasks.some(
            (agent) => agent.agentId === event.agentId,
          );
          if (thinkingStep && belongsToSnapshot) {
            queryClient.setQueryData<readonly ResearchThinkingStep[]>(
              researchQueryKeys.thinkingLive(projectId),
              (steps = []) => mergeResearchThinkingSteps(steps, [thinkingStep]),
            );
          }
        }
        const agentBeforeEvent =
          event.type === 'agent_completed'
            ? snapshot?.progress.agentTasks.find((agent) => agent.agentId === event.agentId)
            : undefined;
        const shouldRefreshAgentCompletion = Boolean(
          event.type === 'agent_completed' &&
          (!agentBeforeEvent ||
            agentBeforeEvent.status !== 'completed' ||
            !agentBeforeEvent.reportReady),
        );
        const shouldRefreshTerminalEvent = Boolean(
          (event.type === 'workflow_completed' ||
            event.type === 'done' ||
            (event.type === 'project_status' && isTerminalProjectStatus(event.status))) &&
          (!snapshot || !isTerminalProjectStatus(snapshot.project.status)),
        );

        if (event.type !== 'heartbeat' && event.type !== 'done' && event.type !== 'message') {
          queryClient.setQueryData<ResearchProjectSnapshot>(snapshotKey, (snapshot) =>
            snapshot ? applyResearchEventToSnapshot(snapshot, event) : snapshot,
          );
        }
        if (shouldRefreshAgentCompletion) {
          requestSnapshotRefresh('regular');
        } else if (shouldRefreshTerminalEvent) {
          requestSnapshotRefresh('terminal');
        }
        if (event.type === 'message' && event.message.agentRunId) {
          const reportKey = researchQueryKeys.agentReport(projectId, event.message.agentRunId);
          const messageKey = researchQueryKeys.agentReportMessages(
            projectId,
            event.message.agentRunId,
          );
          queryClient.setQueryData<ResearchMessage[]>(messageKey, (messages = []) =>
            messages.some((message) => message.messageId === event.message.messageId)
              ? messages
              : [...messages, event.message],
          );
          const cachedReport = queryClient.getQueryData<AgentReport>(reportKey);
          queryClient.setQueryData<AgentReport>(reportKey, (report) => {
            if (!report) {
              return report;
            }
            return appendResearchMessageToReport(report, event.message);
          });
          if (!cachedReport) {
            void queryClient.invalidateQueries({ queryKey: reportKey });
          }
        }
      },
      onSnapshotInvalidated: () => {
        requestSnapshotRefresh('regular');
      },
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [afterSeq, projectId, queryClient]);
}

export function useRetryResearchAgent(): UseMutationResult<
  ResearchProjectSnapshot,
  Error,
  RetryResearchAgentInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, agentType }) =>
      getResearchRepository().retryAgent(projectId, agentType),
    onSuccess: (snapshot, { projectId }) => {
      const snapshotKey = researchQueryKeys.projectSnapshot(projectId);
      queryClient.setQueryData(snapshotKey, reconcileResearchSnapshot(snapshot));
      void queryClient.invalidateQueries({ queryKey: snapshotKey });
      void queryClient.invalidateQueries({ queryKey: researchQueryKeys.agentReports(projectId) });
    },
  });
}
