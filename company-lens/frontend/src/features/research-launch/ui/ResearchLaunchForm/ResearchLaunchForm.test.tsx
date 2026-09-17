import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  setCompanyResearchRepositoryForTests,
  type CompanyResearchRepository,
  type CompanyResearchEventHandlers,
  type CompanyResearchEventSubscription,
  type CompanyResearchRecognition,
  type CompanyResearchTask,
} from '../../../../entities/company-research';
import { i18n, useLocaleStore } from '../../../../shared/i18n';
import { ResearchLaunchForm } from './ResearchLaunchForm';

const task: CompanyResearchTask = {
  taskId: 'task-1',
  query: 'NVDA',
  status: 'pending',
  reportReady: false,
  capabilities: [],
};

function emitRecognition(
  recognition: CompanyResearchRecognition,
  handlers: CompanyResearchEventHandlers,
): CompanyResearchEventSubscription {
  const close = vi.fn();
  queueMicrotask(() => {
    if (close.mock.calls.length > 0) return;
    handlers.onEvent({
      type: 'recognition_result',
      recognitionId: recognition.recognitionId,
      conversationId: recognition.conversationId,
      status: recognition.status,
      recognition,
      isTerminal: false,
    });
  });
  return { close };
}

function createRepository(
  overrides: Partial<CompanyResearchRepository> = {},
): CompanyResearchRepository {
  return {
    subscribeRecognition: vi.fn((_query: string, handlers: CompanyResearchEventHandlers) =>
      emitRecognition(
        {
          recognitionId: 'recognition-1',
          status: 'resolved',
          selectedCandidateId: 'candidate-1',
          conversationId: 'conversation-1',
          candidates: [],
        },
        handlers,
      ),
    ),
    createTask: vi.fn().mockResolvedValue(task),
    getTask: vi.fn(),
    getReport: vi.fn(),
    getCapabilityResult: vi.fn(),
    retryCapability: vi.fn(),
    retryReport: vi.fn(),
    listHistory: vi.fn(),
    deleteHistory: vi.fn(),
    bindTask: vi.fn(),
    subscribeEvents: vi.fn(() => ({ close: vi.fn() })),
    ...overrides,
  };
}

function renderForm(repository: CompanyResearchRepository) {
  setCompanyResearchRepositoryForTests(repository);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ResearchLaunchForm />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('ResearchLaunchForm', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useLocaleStore.setState({ locale: 'en' });
  });
  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: 'en' });
    setCompanyResearchRepositoryForTests(undefined);
    vi.restoreAllMocks();
  });

  it('recognizes a trimmed object without creating a duplicate resolved task', async () => {
    const repository = createRepository();
    const user = userEvent.setup();
    renderForm(repository);
    await user.type(screen.getByRole('textbox', { name: 'Research object' }), '  NVDA  ');
    await user.click(screen.getByRole('button', { name: 'Start research' }));
    await waitFor(() =>
      expect(repository.subscribeRecognition).toHaveBeenCalledWith(
        'NVDA',
        expect.anything(),
        'en-US',
      ),
    );
    await waitFor(() => expect(repository.createTask).not.toHaveBeenCalled());
  });

  it('submits with Enter and does not submit while an IME composition is active', async () => {
    const repository = createRepository({
      subscribeRecognition: vi.fn(() => ({ close: vi.fn() })),
    });
    const user = userEvent.setup();
    renderForm(repository);
    const input = screen.getByRole('textbox', { name: 'Research object' });

    await user.type(input, 'NVDA');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(repository.subscribeRecognition).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(repository.subscribeRecognition).toHaveBeenCalledWith(
        'NVDA',
        expect.anything(),
        'en-US',
      ),
    );
    expect(input).toHaveValue('NVDA');
  });

  it('keeps the input at four rows and hides the count until a limit is exceeded', async () => {
    const repository = createRepository();
    const user = userEvent.setup();
    renderForm(repository);
    const input = screen.getByRole('textbox', { name: 'Research object' });

    expect(input).toHaveAttribute('rows', '4');
    expect(screen.queryByText('0 / 100')).not.toBeInTheDocument();

    await user.type(input, 'NVDA');
    expect(screen.queryByText('4 / 100')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'one\ntwo\nthree\nfour\nfive' } });
    expect(input).toHaveValue('one\ntwo\nthree\nfour');
    expect(screen.getByText('Up to 4 lines')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'a'.repeat(101));
    expect(input).toHaveValue('a'.repeat(100));
    expect(screen.getByText('100 / 100')).toBeInTheDocument();
    expect(screen.getByText('Up to 100 characters')).toBeInTheDocument();
  });

  it('enforces the 2 character minimum and does not call the repository', async () => {
    const repository = createRepository();
    const user = userEvent.setup();
    renderForm(repository);
    await user.type(screen.getByRole('textbox', { name: 'Research object' }), 'A');
    await user.click(screen.getByRole('button', { name: 'Start research' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('between 2 and 100');
    expect(repository.subscribeRecognition).not.toHaveBeenCalled();
  });

  it('fills the selected localized example without submitting it', async () => {
    const repository = createRepository();
    const user = userEvent.setup();
    renderForm(repository);
    const examples = screen.getByRole('group', { name: 'Examples:' });
    const [exampleButton] = within(examples).getAllByRole('button');
    if (!exampleButton) throw new Error('Expected at least one research example.');
    const exampleLabel = exampleButton.textContent ?? '';
    await user.click(exampleButton);
    expect(screen.getByRole('textbox', { name: 'Research object' })).toHaveValue(exampleLabel);
    expect(repository.subscribeRecognition).not.toHaveBeenCalled();
    expect(screen.queryByText('Target market')).not.toBeInTheDocument();
  });

  it('replaces all visible examples when requesting another batch', async () => {
    const user = userEvent.setup();
    renderForm(createRepository());
    const examples = screen.getByRole('group', { name: 'Examples:' });
    const firstBatch = within(examples)
      .getAllByRole('button')
      .map((button) => button.textContent);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    const nextBatch = within(examples)
      .getAllByRole('button')
      .map((button) => button.textContent);
    const firstBatchSet = new Set(firstBatch);
    expect(firstBatch).toHaveLength(6);
    expect(nextBatch).toHaveLength(6);
    expect(nextBatch.every((example) => !firstBatchSet.has(example))).toBe(true);
  });

  it('opens an accessible ambiguity dialog and blocks unsupported candidates', async () => {
    const repository = createRepository({
      subscribeRecognition: vi.fn((_query: string, handlers: CompanyResearchEventHandlers) =>
        emitRecognition(
          {
            recognitionId: 'recognition-2',
            status: 'ambiguous',
            conversationId: 'conversation-2',
            candidates: [
              {
                candidateId: 'listed',
                objectName: 'Apple Inc.',
                stockCode: 'AAPL',
                canResearch: true,
              },
              {
                candidateId: 'private',
                objectName: 'Apple Brand',
                canResearch: false,
                disabledReason: 'Not listed',
              },
            ],
          },
          handlers,
        ),
      ),
    });
    const user = userEvent.setup();
    renderForm(repository);
    await user.type(screen.getByRole('textbox', { name: 'Research object' }), 'Apple');
    await user.click(screen.getByRole('button', { name: 'Start research' }));
    expect(
      await screen.findByRole('dialog', { name: 'Choose a research object' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apple Brand/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Apple Inc/ }));
    await waitFor(() =>
      expect(repository.createTask).toHaveBeenCalledWith({
        recognitionId: 'recognition-2',
        candidateId: 'listed',
        query: 'Apple',
        conversationId: 'conversation-2',
        language: 'en-US',
      }),
    );
  });

  it('sends the backend language code for the Chinese locale', async () => {
    useLocaleStore.setState({ locale: 'zh' });
    const repository = createRepository();
    const user = userEvent.setup();
    renderForm(repository);
    await user.type(screen.getByRole('textbox', { name: 'Research object' }), 'NVDA');
    await user.click(screen.getByRole('button', { name: 'Start research' }));

    await waitFor(() =>
      expect(repository.subscribeRecognition).toHaveBeenCalledWith(
        'NVDA',
        expect.anything(),
        'zh-CN',
      ),
    );
  });

  it('keeps the input and shows the unsupported explanation', async () => {
    const repository = createRepository({
      subscribeRecognition: vi.fn((_query: string, handlers: CompanyResearchEventHandlers) =>
        emitRecognition(
          { recognitionId: 'recognition-3', status: 'unsupported', candidates: [] },
          handlers,
        ),
      ),
    });
    const user = userEvent.setup();
    renderForm(repository);
    const input = screen.getByRole('textbox', { name: 'Research object' });
    await user.type(input, 'Private company');
    await user.click(screen.getByRole('button', { name: 'Start research' }));
    expect(await screen.findByText('This object is not supported')).toBeInTheDocument();
    expect(input).toHaveValue('Private company');
    expect(repository.createTask).not.toHaveBeenCalled();
  });

  it('shows the reason from a terminal recognition event', async () => {
    const repository = createRepository({
      subscribeRecognition: vi.fn((_query: string, handlers: CompanyResearchEventHandlers) => {
        queueMicrotask(() =>
          handlers.onEvent({
            type: 'done',
            message: 'Cannot recognize the research object',
            isTerminal: true,
          }),
        );
        return { close: vi.fn() };
      }),
    });
    const user = userEvent.setup();
    renderForm(repository);
    const input = screen.getByRole('textbox', { name: 'Research object' });
    await user.type(input, 'Unknown target');
    await user.click(screen.getByRole('button', { name: 'Start research' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot recognize the research object.',
    );
    expect(input).toHaveValue('Unknown target');
    expect(input).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start research' })).not.toBeDisabled();
  });

  it('disables submission while recognition is pending', async () => {
    const repository = createRepository({
      subscribeRecognition: vi.fn(() => ({ close: vi.fn() })),
    });
    const user = userEvent.setup();
    renderForm(repository);
    await user.type(screen.getByRole('textbox', { name: 'Research object' }), 'NVDA');
    const submit = screen.getByRole('button', { name: 'Start research' });
    await user.click(submit);
    expect(screen.getByRole('button', { name: 'AI is analyzing…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('AI is analyzing the research object');
    expect(screen.getByRole('textbox', { name: 'Research object' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(
      within(screen.getByRole('group', { name: 'Examples:' }))
        .getAllByRole('button')
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    expect(repository.subscribeRecognition).toHaveBeenCalledTimes(1);
  });

  it('restores the form after recognition fails and keeps the input', async () => {
    const repository = createRepository({
      subscribeRecognition: vi.fn((_query: string, handlers: CompanyResearchEventHandlers) => {
        queueMicrotask(() => handlers.onError?.(new Error('network error')));
        return { close: vi.fn() };
      }),
    });
    const user = userEvent.setup();
    renderForm(repository);
    const input = screen.getByRole('textbox', { name: 'Research object' });
    await user.type(input, 'NVDA');
    await user.click(screen.getByRole('button', { name: 'Start research' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'System error, please try again later.',
    );
    expect(input).toHaveValue('NVDA');
    expect(input).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start research' })).not.toBeDisabled();
  });
});
