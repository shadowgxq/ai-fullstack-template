import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QueryComposer } from './QueryComposer';
import type { QueryComposerMessages, QueryComposerRemoteSearch } from './query-composer.types';

const MESSAGES: QueryComposerMessages = {
  clearInput: 'Clear input',
  suggestionsLabel: 'Suggestions',
  searching: 'Searching…',
  empty: 'No matches',
  searchError: 'Search failed',
  retry: 'Retry',
};

type Deferred<TValue> = {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
};

function deferred<TValue>(): Deferred<TValue> {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

type RemoteHarnessProps = {
  mode: 'remote_only' | 'hybrid';
  remoteSearch: QueryComposerRemoteSearch<string>;
  onCommitItem?: (item: string) => void;
  onCommitQuery?: (query: string) => void;
  isItemDisabled?: (item: string) => boolean;
};

function RemoteHarness({
  mode,
  remoteSearch,
  onCommitItem = () => undefined,
  onCommitQuery = () => undefined,
  isItemDisabled,
}: RemoteHarnessProps) {
  const [value, setValue] = useState('');
  const commonProps = {
    value,
    label: 'Query',
    messages: MESSAGES,
    remoteSearch,
    getItemKey: (item: string) => item,
    renderItem: (item: string) => <span>{item}</span>,
    onValueChange: setValue,
    onCommitItem,
    isItemDisabled,
  } as const;

  if (mode === 'remote_only') {
    return <QueryComposer mode="remote_only" {...commonProps} />;
  }

  return (
    <QueryComposer
      mode="hybrid"
      {...commonProps}
      onCommitQuery={onCommitQuery}
      renderFreeform={(query) => <span>Use {query}</span>}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('QueryComposer', () => {
  it('只接受当前 query 的远程结果，忽略已过期响应', async () => {
    vi.useFakeTimers();
    const firstRequest = deferred<readonly string[]>();
    const secondRequest = deferred<readonly string[]>();
    const search = vi.fn((query: string) =>
      query === 'ap' ? firstRequest.promise : secondRequest.promise,
    );

    render(
      <RemoteHarness mode="remote_only" remoteSearch={{ search, minChars: 1, debounceMs: 300 }} />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ap' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    fireEvent.change(input, { target: { value: 'app' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await act(async () => secondRequest.resolve(['AppLovin']));
    expect(screen.getByRole('option', { name: 'AppLovin' })).toBeInTheDocument();

    await act(async () => firstRequest.resolve(['Apple']));
    expect(screen.queryByRole('option', { name: 'Apple' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AppLovin' })).toBeInTheDocument();
  });

  it('键盘 active item 的优先级高于自由输入', async () => {
    vi.useFakeTimers();
    const onCommitItem = vi.fn();
    const onCommitQuery = vi.fn();

    render(
      <RemoteHarness
        mode="hybrid"
        remoteSearch={{ search: () => ['Apple', 'AppLovin'], minChars: 1, debounceMs: 300 }}
        onCommitItem={onCommitItem}
        onCommitQuery={onCommitQuery}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'app' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommitItem).toHaveBeenCalledWith('Apple');
    expect(onCommitQuery).not.toHaveBeenCalled();
  });

  it('Hybrid 已有实体匹配时不展示自然语言 fallback', async () => {
    vi.useFakeTimers();

    render(
      <RemoteHarness
        mode="hybrid"
        remoteSearch={{ search: () => ['Apple'], minChars: 1, debounceMs: 300 }}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'apple' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Use apple' })).not.toBeInTheDocument();
  });

  it('Hybrid 在没有实体结果时允许 commit 自由输入', async () => {
    vi.useFakeTimers();
    const onCommitQuery = vi.fn();

    render(
      <RemoteHarness
        mode="hybrid"
        remoteSearch={{ search: () => [], minChars: 1, debounceMs: 300 }}
        onCommitQuery={onCommitQuery}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '黄金期货' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommitQuery).toHaveBeenCalledWith('黄金期货');
  });

  it('Hybrid 对自然语言跳过远程搜索并直接 commit query', async () => {
    vi.useFakeTimers();
    const search = vi.fn(() => ['Apple']);
    const onCommitQuery = vi.fn();

    render(
      <RemoteHarness
        mode="hybrid"
        remoteSearch={{
          search,
          minChars: 1,
          debounceMs: 300,
          shouldSearch: (query) => !query.startsWith('帮我'),
        }}
        onCommitQuery={onCommitQuery}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '帮我分析苹果' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitQuery).toHaveBeenCalledWith('帮我分析苹果');
  });

  it('Clear 会取消 debounce、清空当前 query 并恢复输入焦点', async () => {
    vi.useFakeTimers();
    const search = vi.fn(() => ['Apple']);

    render(
      <RemoteHarness mode="remote_only" remoteSearch={{ search, minChars: 1, debounceMs: 300 }} />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'app' } });
    expect(screen.getByRole('button', { name: 'Clear input' })).toHaveClass(
      'top-1/2',
      '-translate-y-1/2',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear input' }));
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(search).not.toHaveBeenCalled();
  });

  it('Escape 先关闭候选层，再让输入框失焦', async () => {
    vi.useFakeTimers();

    render(
      <RemoteHarness
        mode="hybrid"
        remoteSearch={{ search: () => [], minChars: 1, debounceMs: 300 }}
      />,
    );

    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.change(input, { target: { value: 'gold' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(input).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).not.toHaveFocus();
  });

  it('长候选列表限制面板高度并在面板内滚动', async () => {
    vi.useFakeTimers();

    render(
      <RemoteHarness
        mode="remote_only"
        remoteSearch={{ search: () => ['Apple'], minChars: 1, debounceMs: 300 }}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'app' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(screen.getByRole('listbox').parentElement).toHaveClass(
      'max-h-[var(--query-composer-panel-max-height)]',
      'overflow-y-auto',
      'overscroll-contain',
    );
  });

  it('多行自然语言模式限制四行，并使用 Enter commit、Shift+Enter 换行', () => {
    const onCommitQuery = vi.fn();

    function NaturalLanguageHarness() {
      const [value, setValue] = useState('分析最近波动');
      return (
        <QueryComposer
          mode="natural_language_only"
          value={value}
          label="Prompt"
          messages={MESSAGES}
          isMultiline
          maxLines={4}
          onValueChange={setValue}
          onCommitQuery={onCommitQuery}
        />
      );
    }

    render(<NaturalLanguageHarness />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '第一行\n第二行\n第三行\n第四行\n第五行' } });
    expect(input).toHaveValue('第一行\n第二行\n第三行\n第四行');
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(false);
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onCommitQuery).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitQuery).toHaveBeenCalledWith('第一行\n第二行\n第三行\n第四行');
  });
  it('查询进行中不提交，完成后才允许无候选的自由文本提交', async () => {
    vi.useFakeTimers();
    const request = deferred<readonly string[]>();
    const onCommitQuery = vi.fn();
    render(
      <RemoteHarness
        mode="hybrid"
        remoteSearch={{ search: () => request.promise, minChars: 1, debounceMs: 0 }}
        onCommitQuery={onCommitQuery}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'design' } });
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitQuery).not.toHaveBeenCalled();
    await act(async () => request.resolve([]));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitQuery).toHaveBeenCalledWith('design');
  });

  it('重试保留原查询并恢复候选，不自动提交', async () => {
    vi.useFakeTimers();
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(['Design guide']);
    const onCommitItem = vi.fn();
    render(
      <RemoteHarness
        mode="remote_only"
        remoteSearch={{ search, minChars: 1, debounceMs: 0 }}
        onCommitItem={onCommitItem}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'design' } });
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(screen.getByText(MESSAGES.searchError)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: MESSAGES.retry }));
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(input).toHaveValue('design');
    expect(screen.getByRole('option', { name: 'Design guide' })).toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
    expect(onCommitItem).not.toHaveBeenCalled();
  });

  it('remote_only 无候选时不能提交自由文本', async () => {
    vi.useFakeTimers();
    const onCommitItem = vi.fn();
    render(
      <RemoteHarness
        mode="remote_only"
        remoteSearch={{ search: () => [], minChars: 1, debounceMs: 0 }}
        onCommitItem={onCommitItem}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'unknown' } });
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(onCommitItem).not.toHaveBeenCalled();
    expect(input).toHaveValue('unknown');
  });

  it('键盘选择跳过禁用候选', async () => {
    vi.useFakeTimers();
    const onCommitItem = vi.fn();
    render(
      <RemoteHarness
        mode="remote_only"
        remoteSearch={{ search: () => ['Locked', 'Available'], minChars: 1, debounceMs: 0 }}
        isItemDisabled={(item) => item === 'Locked'}
        onCommitItem={onCommitItem}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'result' } });
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommitItem).toHaveBeenCalledWith('Available');
  });
  it('把边框计入多行高度，在上限处保留完整末行并仅在溢出时滚动', () => {
    const common = {
      mode: 'natural_language_only',
      isMultiline: true,
      maxLines: 3,
      label: 'Query',
      messages: MESSAGES,
      onValueChange: vi.fn(),
      onCommitQuery: vi.fn(),
    } as const;
    const { rerender } = render(<QueryComposer {...common} value="One" />);
    const input = screen.getByRole('textbox');
    Object.assign(input.style, {
      lineHeight: '24px',
      paddingTop: '11px',
      paddingBottom: '11px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px',
    });
    Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 94 });
    rerender(<QueryComposer {...common} value={'One\nTwo\nThree'} />);
    expect(input.style.height).toBe('96px');
    expect(input.style.overflowY).toBe('hidden');
    Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 118 });
    rerender(<QueryComposer {...common} value={'One\nTwo\nThree\nFour'} />);
    expect(input.style.height).toBe('96px');
    expect(input.style.overflowY).toBe('auto');
  });
});
