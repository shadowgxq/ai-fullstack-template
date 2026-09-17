import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ArrowRight, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  getCompanyResearchIdentityScope,
  useCreateCompanyResearchTask,
  useRecognizeCompanyResearchObject,
  type CompanyResearchLanguage,
  type CompanyResearchCandidate,
  type CompanyResearchEvent,
  type CompanyResearchRecognition,
} from '../../../../entities/company-research';
import { getApiErrorMessage, translateApiMessage } from '../../../../shared/api';
import { useLocale } from '../../../../shared/i18n';
import { useAuthStore } from '../../../auth';
import { RESEARCH_EXAMPLES, type ResearchExampleKey } from '../../model/research-launch.constants';
import styles from './ResearchLaunchForm.module.css';

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const MAX_QUERY_LINES = 4;
const EXAMPLES_PER_BATCH = 6;

type QueryLimitNotice = 'characters' | 'lines' | 'both';

function getLength(value: string): number {
  return Array.from(value.trim()).length;
}

function getQueryLimitNotice(
  characterLimitReached: boolean,
  lineLimitReached: boolean,
): QueryLimitNotice | undefined {
  if (characterLimitReached && lineLimitReached) return 'both';
  if (characterLimitReached) return 'characters';
  if (lineLimitReached) return 'lines';
  return undefined;
}

function limitQueryValue(value: string): {
  value: string;
  notice?: QueryLimitNotice;
} {
  const characterLimitReached = Array.from(value).length > MAX_QUERY_LENGTH;
  const lineLimitReached = value.split('\n').length > MAX_QUERY_LINES;
  const limitedValue = Array.from(value)
    .slice(0, MAX_QUERY_LENGTH)
    .join('')
    .split('\n')
    .slice(0, MAX_QUERY_LINES)
    .join('\n');

  return {
    value: limitedValue,
    notice: getQueryLimitNotice(characterLimitReached, lineLimitReached),
  };
}

function getRandomExamples(
  excludedExamples: readonly ResearchExampleKey[] = [],
): readonly ResearchExampleKey[] {
  const excludedExampleSet = new Set(excludedExamples);
  const candidates = RESEARCH_EXAMPLES.filter((example) => !excludedExampleSet.has(example));
  const selectedExamples: ResearchExampleKey[] = [];

  while (selectedExamples.length < EXAMPLES_PER_BATCH && candidates.length > 0) {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const [example] = candidates.splice(randomIndex, 1);
    if (example) selectedExamples.push(example);
  }

  return selectedExamples;
}

export function ResearchLaunchForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.userId);
  const { locale } = useLocale();
  const researchLanguage: CompanyResearchLanguage = locale === 'zh' ? 'zh-CN' : 'en-US';
  const identityScope = getCompanyResearchIdentityScope(userId);
  const recognizeMutation = useRecognizeCompanyResearchObject();
  const createMutation = useCreateCompanyResearchTask(identityScope);
  const recognitionActionGuardRef = useRef(false);
  const taskActionGuardRef = useRef(false);
  const navigatedTaskIdRef = useRef<string>();
  const createdTaskIdRef = useRef<string>();
  const [query, setQuery] = useState('');
  const [examples, setExamples] = useState(getRandomExamples);
  const [queryLimitNotice, setQueryLimitNotice] = useState<QueryLimitNotice>();
  const [recognition, setRecognition] = useState<CompanyResearchRecognition>();
  const [recognitionErrorMessage, setRecognitionErrorMessage] = useState<string>();
  const [candidateSubmitted, setCandidateSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const normalizedQuery = query.trim();
  const queryLength = getLength(query);
  const rawQueryLength = Array.from(query).length;
  const isRecognizing = recognizeMutation.isPending;
  const isCreatingTask = createMutation.isPending;
  const isPending = isRecognizing || isCreatingTask;
  const translatedRecognitionError = recognitionErrorMessage
    ? translateApiMessage(recognitionErrorMessage)
    : undefined;
  const requestErrorMessage = createMutation.error
    ? getApiErrorMessage(createMutation.error)
    : recognizeMutation.error
      ? getApiErrorMessage(recognizeMutation.error)
      : undefined;

  function createTask(recognitionId: string, candidateId: string, conversationId?: string) {
    if (taskActionGuardRef.current || isCreatingTask) return;
    taskActionGuardRef.current = true;
    const input = {
      recognitionId,
      candidateId,
      query: normalizedQuery,
      language: researchLanguage,
      ...(conversationId ? { conversationId } : {}),
    };
    createMutation.mutate(input, {
      onSuccess: (task) => {
        createdTaskIdRef.current = task.taskId;
        setCandidateSubmitted(true);
      },
      onSettled: () => {
        taskActionGuardRef.current = false;
      },
    });
  }

  function navigateToTask(taskId: string) {
    if (navigatedTaskIdRef.current === taskId) return;
    navigatedTaskIdRef.current = taskId;
    recognizeMutation.close();
    navigate(`/research/${encodeURIComponent(taskId)}/progress`);
  }

  function handleRecognitionEvent(event: CompanyResearchEvent) {
    if (event.recognition) {
      setRecognition(event.recognition);
      setRecognitionErrorMessage(undefined);
    }
    if (event.type === 'recognition_error' || event.isTerminal) {
      setRecognitionErrorMessage(event.message);
    }
    if (event.isTerminal) {
      recognitionActionGuardRef.current = false;
    }
    if (
      event.taskId &&
      ['status_change', 'task_complete', 'task_partial', 'task_failed'].includes(event.type)
    ) {
      navigateToTask(event.taskId);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recognitionActionGuardRef.current || taskActionGuardRef.current || isPending) return;
    if (queryLength < MIN_QUERY_LENGTH || queryLength > MAX_QUERY_LENGTH) {
      setValidationError(t('companyResearch.launch.validation'));
      return;
    }
    setValidationError(undefined);
    setRecognition(undefined);
    setRecognitionErrorMessage(undefined);
    setCandidateSubmitted(false);
    createMutation.reset();
    navigatedTaskIdRef.current = undefined;
    createdTaskIdRef.current = undefined;
    recognitionActionGuardRef.current = true;
    recognizeMutation.start(normalizedQuery, {
      language: researchLanguage,
      onEvent: handleRecognitionEvent,
      onError: () => {
        const createdTaskId = createdTaskIdRef.current;
        if (createdTaskId) {
          navigateToTask(createdTaskId);
          return;
        }
        recognitionActionGuardRef.current = false;
      },
    });
  }

  function handleSelectCandidate(candidate: CompanyResearchCandidate) {
    if (!recognition || !candidate.canResearch) return;
    createTask(recognition.recognitionId, candidate.candidateId, recognition.conversationId);
  }

  const inlineStatus =
    recognition && recognition.status !== 'ambiguous' ? recognition.status : undefined;

  return (
    <>
      <form className={styles.card} onSubmit={handleSubmit} aria-busy={isPending} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="research-query">
            {t('companyResearch.launch.label')}
          </label>
          <div className={styles.inputWrap}>
            <Search className={styles.searchIcon} size={18} aria-hidden />
            <textarea
              id="research-query"
              className={styles.input}
              value={query}
              onChange={(event) => {
                const limitedQuery = limitQueryValue(event.target.value);
                setQuery(limitedQuery.value);
                setQueryLimitNotice(limitedQuery.notice);
                setValidationError(undefined);
                setRecognition(undefined);
                setRecognitionErrorMessage(undefined);
                setCandidateSubmitted(false);
                recognitionActionGuardRef.current = false;
                createdTaskIdRef.current = undefined;
                recognizeMutation.reset();
                createMutation.reset();
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                if (event.shiftKey) {
                  if (query.split('\n').length >= MAX_QUERY_LINES) {
                    event.preventDefault();
                    setQueryLimitNotice((currentNotice) =>
                      getQueryLimitNotice(
                        currentNotice === 'characters' || currentNotice === 'both',
                        true,
                      ),
                    );
                  }
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              disabled={isPending}
              aria-invalid={Boolean(validationError)}
              aria-describedby={
                queryLimitNotice
                  ? 'research-query-error research-query-limit'
                  : 'research-query-error'
              }
              placeholder={t('companyResearch.launch.placeholder')}
              autoComplete="off"
              rows={4}
            />
            {isRecognizing ? (
              <span className={styles.inputLoading} aria-hidden="true">
                <Loader2 size={14} />
                {t('companyResearch.launch.recognizing')}
              </span>
            ) : null}
            {queryLimitNotice === 'characters' || queryLimitNotice === 'both' ? (
              <span className={styles.queryCount} data-limit-reached="true">
                {rawQueryLength} / {MAX_QUERY_LENGTH}
              </span>
            ) : null}
          </div>
          {queryLimitNotice ? (
            <p className={styles.limitNotice} id="research-query-limit" role="status">
              {queryLimitNotice === 'lines'
                ? t('companyResearch.launch.lineLimitNotice', { max: MAX_QUERY_LINES })
                : queryLimitNotice === 'both'
                  ? t('companyResearch.launch.combinedLimitNotice', {
                      maxCharacters: MAX_QUERY_LENGTH,
                      maxLines: MAX_QUERY_LINES,
                    })
                  : t('companyResearch.launch.limitNotice', { max: MAX_QUERY_LENGTH })}
            </p>
          ) : null}
        </div>

        {isRecognizing ? (
          <div className={styles.pendingNotice} role="status" aria-live="polite" aria-atomic="true">
            <div className={styles.pendingIcon} aria-hidden="true">
              <Loader2 className={styles.pendingSpinner} size={17} />
            </div>
            <div className={styles.pendingCopy}>
              <strong>{t('companyResearch.launch.recognizingTitle')}</strong>
              <p>{t('companyResearch.launch.recognizingDescription')}</p>
            </div>
          </div>
        ) : null}

        <div className={styles.suggestions}>
          <span className={styles.suggestionsLabel} id="research-examples-label">
            {t('companyResearch.launch.examplesLabel')}
          </span>
          <div
            className={styles.suggestionList}
            role="group"
            aria-labelledby="research-examples-label"
          >
            {examples.map((example) => {
              const exampleLabel = t(`companyResearch.launch.examples.${example}`);
              return (
                <button
                  className={styles.chip}
                  type="button"
                  key={example}
                  disabled={isPending}
                  onClick={() => {
                    setQuery(exampleLabel);
                    setQueryLimitNotice(undefined);
                    setValidationError(undefined);
                    setRecognition(undefined);
                    setRecognitionErrorMessage(undefined);
                    setCandidateSubmitted(false);
                    recognitionActionGuardRef.current = false;
                    createdTaskIdRef.current = undefined;
                    recognizeMutation.reset();
                    createMutation.reset();
                  }}
                >
                  {exampleLabel}
                </button>
              );
            })}
          </div>
          <button
            className={styles.refreshExamples}
            type="button"
            disabled={isPending}
            onClick={() => setExamples((currentExamples) => getRandomExamples(currentExamples))}
          >
            <RefreshCw size={14} aria-hidden />
            {t('research.form.switchSuggestions')}
          </button>
        </div>

        {validationError ||
        recognitionErrorMessage ||
        recognizeMutation.isError ||
        createMutation.isError ? (
          <p className={styles.error} id="research-query-error" role="alert">
            {validationError ??
              translatedRecognitionError ??
              requestErrorMessage ??
              t('companyResearch.launch.requestError')}
          </p>
        ) : null}

        {inlineStatus ? (
          <div className={styles.notice} data-status={inlineStatus} role="status">
            <AlertCircle size={18} aria-hidden />
            <div>
              <strong>{t(`companyResearch.launch.${inlineStatus}Title`)}</strong>
              <p>
                {translatedRecognitionError ||
                  (recognition?.message ? translateApiMessage(recognition.message) : undefined) ||
                  t(`companyResearch.launch.${inlineStatus}Description`)}
              </p>
            </div>
          </div>
        ) : null}

        <button className={styles.submit} type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className={styles.buttonSpinner} size={18} aria-hidden />
          ) : (
            <ArrowRight size={18} aria-hidden />
          )}
          {isRecognizing
            ? t('companyResearch.launch.recognizing')
            : isCreatingTask
              ? t('companyResearch.launch.pending')
              : t('companyResearch.launch.submit')}
        </button>
      </form>

      <Dialog.Root
        open={recognition?.status === 'ambiguous' && !candidateSubmitted}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending && !candidateSubmitted) {
            setRecognition(undefined);
            setRecognitionErrorMessage(undefined);
            recognitionActionGuardRef.current = false;
            createdTaskIdRef.current = undefined;
            recognizeMutation.close();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogOverlay} />
          <Dialog.Content className={styles.dialogContent}>
            <div className={styles.dialogHeader}>
              <div>
                <Dialog.Title className={styles.dialogTitle}>
                  {t('companyResearch.launch.ambiguousTitle')}
                </Dialog.Title>
                <Dialog.Description className={styles.dialogDescription}>
                  {t('companyResearch.launch.ambiguousDescription')}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  className={styles.dialogClose}
                  type="button"
                  aria-label={t('companyResearch.launch.close')}
                  disabled={createMutation.isPending}
                >
                  <X size={18} aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <div className={styles.candidateList}>
              {recognition?.candidates.map((candidate) => (
                <button
                  className={styles.candidate}
                  type="button"
                  key={candidate.candidateId}
                  disabled={
                    !candidate.canResearch || createMutation.isPending || candidateSubmitted
                  }
                  onClick={() => handleSelectCandidate(candidate)}
                >
                  <span className={styles.candidateMain}>
                    <strong>{candidate.objectName}</strong>
                    <span>
                      {[candidate.companyName, candidate.stockCode, candidate.market]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={styles.candidateAction}>
                    {candidate.canResearch ? (
                      <>
                        {t('companyResearch.launch.select')}
                        <ArrowRight size={15} aria-hidden />
                      </>
                    ) : (
                      candidate.disabledReason
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
