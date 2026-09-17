import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getDeviceId } from '../../../shared/identity';
import type {
  CompanyResearchEvent,
  CompanyResearchEventHandlers,
  CompanyResearchEventSubscription,
  CompanyResearchLanguage,
  CompanyResearchTask,
} from '../model/company-research.types';
import { getCompanyResearchRepository } from './company-research.composition';
import { createTaskEventRefreshScheduler } from './company-research-event-refresh';
import type { CompanyResearchTaskQueryOptions } from './company-research.repository';

type CompanyResearchTaskKey =
  | readonly [string, string, 'task', string]
  | readonly [string, string, 'task', string, { includeMessages: false }];

export const companyResearchQueryKeys = {
  all: () => ['company-research'] as const,
  identity: (identityScope: string) => ['company-research', identityScope] as const,
  taskPrefix: (identityScope: string, taskId: string) =>
    ['company-research', identityScope, 'task', taskId] as const,
  task: (identityScope: string, taskId: string, includeMessages = true): CompanyResearchTaskKey =>
    includeMessages
      ? ['company-research', identityScope, 'task', taskId]
      : ['company-research', identityScope, 'task', taskId, { includeMessages: false }],
  report: (identityScope: string, taskId: string) =>
    ['company-research', identityScope, 'report', taskId] as const,
  capabilityResult: (identityScope: string, taskId: string, capability: string) =>
    ['company-research', identityScope, 'capability-result', taskId, capability] as const,
  history: (identityScope: string, keyword: string, page: number, size: number) =>
    ['company-research', identityScope, 'history', { keyword, page, size }] as const,
};

export function getCompanyResearchIdentityScope(userId?: string | null): string {
  return userId ? `user:${userId}` : `device:${getDeviceId()}`;
}

export function useCompanyResearchTask(
  taskId?: string,
  identityScope = getCompanyResearchIdentityScope(),
  options: CompanyResearchTaskQueryOptions = {},
) {
  const normalizedTaskId = taskId?.trim() ?? '';
  const includeMessages = options.includeMessages ?? true;
  return useQuery({
    queryKey: companyResearchQueryKeys.task(identityScope, normalizedTaskId, includeMessages),
    queryFn: () =>
      getCompanyResearchRepository().getTask(normalizedTaskId, {
        includeMessages,
      }),
    enabled: Boolean(normalizedTaskId),
    // The launch flow seeds this exact query before navigation; avoid an immediate duplicate GET.
    staleTime: 5_000,
    // Task events are the live source; focusing the tab must not create a second refresh path.
    refetchOnWindowFocus: false,
  });
}

export function useCompanyResearchReport(
  task: CompanyResearchTask | undefined,
  identityScope = getCompanyResearchIdentityScope(),
) {
  const isAvailable = task?.reportReady === true;
  return useQuery({
    queryKey: companyResearchQueryKeys.report(identityScope, task?.taskId ?? ''),
    queryFn: () => getCompanyResearchRepository().getReport(task?.taskId ?? ''),
    enabled: Boolean(task?.taskId && isAvailable),
  });
}

export function useCompanyResearchCapabilityResult(
  task: CompanyResearchTask | undefined,
  capability: string | undefined,
  identityScope = getCompanyResearchIdentityScope(),
) {
  const normalizedCapability = capability?.trim() ?? '';
  const capabilityStatus = task?.capabilities.find(
    (item) => item.name === normalizedCapability,
  )?.status;
  return useQuery({
    queryKey: companyResearchQueryKeys.capabilityResult(
      identityScope,
      task?.taskId ?? '',
      normalizedCapability,
    ),
    queryFn: () =>
      getCompanyResearchRepository().getCapabilityResult(task?.taskId ?? '', normalizedCapability),
    enabled: Boolean(task?.taskId && normalizedCapability && capabilityStatus === 'succeeded'),
  });
}

export function useRetryCompanyResearchCapability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      capability,
    }: {
      taskId: string;
      capability: string;
      identityScope?: string;
    }) => getCompanyResearchRepository().retryCapability(taskId, capability),
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({
        queryKey: companyResearchQueryKeys.taskPrefix(
          input.identityScope ?? getCompanyResearchIdentityScope(),
          input.taskId,
        ),
      });
    },
  });
}

export function useRetryCompanyResearchReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; identityScope?: string }) =>
      getCompanyResearchRepository().retryReport(taskId),
    onSuccess: async (_, input) => {
      const identityScope = input.identityScope ?? getCompanyResearchIdentityScope();
      const taskKey = companyResearchQueryKeys.taskPrefix(identityScope, input.taskId);

      queryClient.setQueriesData<CompanyResearchTask>({ queryKey: taskKey }, (task) =>
        task
          ? {
              ...task,
              status: 'collecting',
              reportReady: false,
              finalResultAvailable: false,
              failReason: undefined,
            }
          : task,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKey }),
        queryClient.invalidateQueries({
          queryKey: companyResearchQueryKeys.report(identityScope, input.taskId),
        }),
        queryClient.invalidateQueries({
          queryKey: companyResearchQueryKeys.identity(identityScope),
        }),
      ]);
    },
  });
}

export function useCompanyResearchEvents(
  task: CompanyResearchTask | undefined,
  identityScope = getCompanyResearchIdentityScope(),
): void {
  const queryClient = useQueryClient();
  const taskId = task?.taskId;
  const taskStatus = task?.status;
  const lastSeqRef = useRef<{ taskId: string; seq: number }>({ taskId: '', seq: 0 });
  const isActive = Boolean(
    taskId && taskStatus && !['completed', 'partial', 'failed', 'cancelled'].includes(taskStatus),
  );

  useEffect(() => {
    if (lastSeqRef.current.taskId !== (taskId ?? '')) {
      lastSeqRef.current = { taskId: taskId ?? '', seq: 0 };
    }
    if (!taskId || !isActive) return;
    const afterSeq = lastSeqRef.current.seq;
    const refreshScheduler = createTaskEventRefreshScheduler(() =>
      queryClient.invalidateQueries({
        queryKey: companyResearchQueryKeys.taskPrefix(identityScope, taskId),
      }),
    );
    const handlers: CompanyResearchEventHandlers = {
      onEvent: (event) => {
        if (event.seq !== undefined && event.seq > lastSeqRef.current.seq) {
          lastSeqRef.current.seq = event.seq;
        }
        if (event.type.trim().toLowerCase() === 'heartbeat') return;
        if (event.isTerminal) {
          refreshScheduler.flush();
          return;
        }
        refreshScheduler.schedule();
      },
      onError: () => {
        refreshScheduler.schedule();
      },
    };
    const repository = getCompanyResearchRepository();
    const subscription =
      afterSeq > 0
        ? repository.subscribeEvents(taskId, handlers, afterSeq)
        : repository.subscribeEvents(taskId, handlers);
    return () => {
      refreshScheduler.close();
      subscription.close();
    };
  }, [identityScope, isActive, queryClient, taskId]);
}

export function useRecognizeCompanyResearchObject() {
  const subscriptionRef = useRef<CompanyResearchEventSubscription>();
  const sessionIdRef = useRef(0);
  const [state, setState] = useState<{
    isPending: boolean;
    isError: boolean;
    error?: Error;
  }>({ isPending: false, isError: false });

  const close = useCallback(() => {
    sessionIdRef.current += 1;
    subscriptionRef.current?.close();
    subscriptionRef.current = undefined;
    setState({ isPending: false, isError: false });
  }, []);

  const reset = useCallback(() => {
    close();
  }, [close]);

  const start = useCallback(
    (
      query: string,
      handlers?: {
        language?: CompanyResearchLanguage;
        onEvent?: (event: CompanyResearchEvent) => void;
        onError?: (error: Error) => void;
      },
    ) => {
      const sessionId = ++sessionIdRef.current;
      subscriptionRef.current?.close();
      subscriptionRef.current = undefined;
      setState({ isPending: true, isError: false });

      const handleError = (error: unknown) => {
        if (sessionId !== sessionIdRef.current) return;
        const normalizedError = error instanceof Error ? error : new Error('Recognition failed.');
        subscriptionRef.current = undefined;
        setState({ isPending: false, isError: true, error: normalizedError });
        handlers?.onError?.(normalizedError);
      };

      try {
        const subscription = getCompanyResearchRepository().subscribeRecognition(
          query,
          {
            onEvent: (event) => {
              if (sessionId !== sessionIdRef.current) return;
              if (event.isTerminal) {
                subscriptionRef.current = undefined;
                setState({ isPending: false, isError: false });
              }
              handlers?.onEvent?.(event);
            },
            onError: handleError,
          },
          handlers?.language,
        );
        if (sessionId === sessionIdRef.current) {
          subscriptionRef.current = subscription;
        } else {
          subscription.close();
        }
      } catch (error) {
        handleError(error);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      sessionIdRef.current += 1;
      subscriptionRef.current?.close();
      subscriptionRef.current = undefined;
    },
    [],
  );

  return { ...state, start, close, reset };
}

export function useCreateCompanyResearchTask(identityScope = getCompanyResearchIdentityScope()) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      recognitionId: string;
      candidateId: string;
      query?: string;
      conversationId?: string;
      language?: CompanyResearchLanguage;
    }) => getCompanyResearchRepository().createTask(input),
    onSuccess: (task) => {
      queryClient.setQueryData(companyResearchQueryKeys.task(identityScope, task.taskId), task);
      void queryClient.invalidateQueries({
        queryKey: companyResearchQueryKeys.identity(identityScope),
      });
    },
  });
}

export function useCompanyResearchHistory(
  input: { keyword?: string; page: number; size: number },
  identityScope = getCompanyResearchIdentityScope(),
) {
  const keyword = input.keyword?.trim() ?? '';
  return useQuery({
    queryKey: companyResearchQueryKeys.history(identityScope, keyword, input.page, input.size),
    queryFn: () => getCompanyResearchRepository().listHistory({ ...input, keyword }),
    placeholderData: (previousData) => previousData,
  });
}

export function useDeleteCompanyResearchHistory(identityScope = getCompanyResearchIdentityScope()) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => getCompanyResearchRepository().deleteHistory(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyResearchQueryKeys.identity(identityScope),
      });
    },
  });
}

export function useBindCompanyResearchTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; identityScope: string }) =>
      getCompanyResearchRepository().bindTask(input.taskId),
    onSuccess: (_, input) => {
      const identityScope = input.identityScope;
      queryClient.setQueryData<CompanyResearchTask>(
        companyResearchQueryKeys.task(identityScope, input.taskId),
        (task) => (task ? { ...task, canBind: false, isBound: true } : task),
      );
      void queryClient.invalidateQueries({
        queryKey: companyResearchQueryKeys.taskPrefix(identityScope, input.taskId),
      });
      void queryClient.invalidateQueries({
        queryKey: companyResearchQueryKeys.identity(identityScope),
      });
    },
  });
}
