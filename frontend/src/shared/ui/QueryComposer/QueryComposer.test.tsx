import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryComposer } from './QueryComposer';
import type { QueryComposerMessages, QueryComposerRemoteSearch } from './query-composer.types';

const MESSAGES: QueryComposerMessages = {
  clearInput: 'Clear',
  suggestionsLabel: 'Suggestions',
  searching: 'Searching',
  empty: 'No matches',
  searchError: 'Failed',
  retry: 'Retry',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function Harness({
  search,
  mode = 'hybrid',
  onItem = () => {},
  onQuery = () => {},
}: {
  search: QueryComposerRemoteSearch<string>;
  mode?: 'hybrid' | 'remote_only';
  onItem?: (item: string) => void;
  onQuery?: (query: string) => void;
}) {
  const [value, setValue] = useState('');
  const common = {
    value,
    onValueChange: setValue,
    label: 'Query',
    messages: MESSAGES,
    remoteSearch: search,
    getItemKey: (item: string) => item,
    renderItem: (item: string) => item,
    onCommitItem: onItem,
  };
  return mode === 'remote_only' ? (
    <QueryComposer mode="remote_only" {...common} />
  ) : (
    <QueryComposer
      mode="hybrid"
      {...common}
      onCommitQuery={onQuery}
      renderFreeform={(query) => `Use ${query}`}
    />
  );
}
async function typeQuery(value: string) {
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  return input;
}
afterEach(() => {
  vi.useRealTimers();
});

describe('QueryComposer', () => {
  it('ignores stale responses and aborts superseded requests', async () => {
    vi.useFakeTimers();
    const first = deferred<readonly string[]>();
    const second = deferred<readonly string[]>();
    const signals: AbortSignal[] = [];
    render(
      <Harness
        mode="remote_only"
        search={{
          search: (query, { signal }) => {
            signals.push(signal);
            return query === 'ab' ? first.promise : second.promise;
          },
        }}
      />,
    );
    await typeQuery('ab');
    await typeQuery('abc');
    expect(signals[0].aborted).toBe(true);
    await act(async () => second.resolve(['New result']));
    await act(async () => first.resolve(['Old result']));
    expect(screen.getByRole('option', { name: 'New result' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Old result' })).not.toBeInTheDocument();
  });
  it('commits the keyboard-selected item before free text', async () => {
    vi.useFakeTimers();
    const onItem = vi.fn();
    const onQuery = vi.fn();
    render(
      <Harness search={{ search: () => ['Alpha', 'Beta'] }} onItem={onItem} onQuery={onQuery} />,
    );
    const input = await typeQuery('ab');
    expect(screen.queryByRole('option', { name: 'Use ab' })).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onItem).toHaveBeenCalledWith('Alpha');
    expect(onQuery).not.toHaveBeenCalled();
  });
  it('allows free text after an empty hybrid search', async () => {
    vi.useFakeTimers();
    const onQuery = vi.fn();
    render(<Harness search={{ search: () => [] }} onQuery={onQuery} />);
    const input = await typeQuery('unlisted');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onQuery).toHaveBeenCalledWith('unlisted');
  });
  it('does not commit unmatched text in remote-only mode', async () => {
    vi.useFakeTimers();
    const onItem = vi.fn();
    render(<Harness mode="remote_only" search={{ search: () => [] }} onItem={onItem} />);
    const input = await typeQuery('unlisted');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onItem).not.toHaveBeenCalled();
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });
  it('supports natural-language bypass without a remote request', async () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const onQuery = vi.fn();
    render(<Harness search={{ search, shouldSearch: () => false }} onQuery={onQuery} />);
    const input = await typeQuery('Write a summary');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).not.toHaveBeenCalled();
    expect(onQuery).toHaveBeenCalledWith('Write a summary');
  });
  it('clear cancels the debounce and restores focus', async () => {
    vi.useFakeTimers();
    const search = vi.fn(() => ['Alpha']);
    render(<Harness search={{ search }} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(search).not.toHaveBeenCalled();
  });
  it('Escape closes the panel first, then removes input focus', async () => {
    vi.useFakeTimers();
    render(<Harness search={{ search: () => ['Alpha'] }} />);
    const input = await typeQuery('ab');
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).not.toHaveFocus();
  });
  it('retries failed search and bounds the suggestions panel', async () => {
    vi.useFakeTimers();
    const search = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(['Alpha']);
    render(<Harness search={{ search }} />);
    await typeQuery('ab');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('listbox').parentElement).toHaveClass(
      'max-h-[28rem]',
      'overflow-y-auto',
      'overscroll-contain',
    );
  });
  it('limits multiline input and does not submit during IME composition', () => {
    const onQuery = vi.fn();
    function NaturalHarness() {
      const [value, setValue] = useState('');
      return (
        <QueryComposer
          mode="natural_language_only"
          value={value}
          onValueChange={setValue}
          label="Prompt"
          messages={MESSAGES}
          isMultiline
          maxLines={4}
          onCommitQuery={onQuery}
        />
      );
    }
    render(<NaturalHarness />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '1\n2\n3\n4\n5' } });
    expect(input).toHaveValue('1\n2\n3\n4');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onQuery).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(false);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onQuery).toHaveBeenCalledWith('1\n2\n3\n4');
  });
  it('accepts a numeric zero as a valid generic remote item', async () => {
    vi.useFakeTimers();
    const onItem = vi.fn();
    render(
      <QueryComposer
        mode="remote_only"
        value="zero"
        onValueChange={() => {}}
        label="Query"
        messages={MESSAGES}
        remoteSearch={{ search: () => [0] }}
        getItemKey={String}
        renderItem={String}
        onCommitItem={onItem}
      />,
    );
    fireEvent.focus(screen.getByRole('combobox'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onItem).toHaveBeenCalledWith(0);
  });
});
