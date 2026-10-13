import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../../../shared/i18n';
import { bookmarksApi } from '../../model/bookmarks.api';
import { parseBookmarkFilters } from '../../model/bookmarks.validation';
import type {
  Bookmark,
  BookmarkFilters,
  BookmarkListResult,
  MutationResult,
} from '../../model/bookmarks.types';
import { BookmarksWorkspace } from './BookmarksWorkspace';

const source = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Source', count: 2 };
const target = { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Target', count: 0 };
const items: Bookmark[] = Array.from({ length: 11 }, (_, index) => ({
  id: `bbbbbbbb-bbbb-bbbb-bbbb-${(index + 1).toString(16).padStart(12, '0')}`,
  title: `Resource ${index + 1}`,
  url: `https://example.com/${index + 1}`,
  group_id: source.id,
  note: '',
  updated_at: '2026-10-13T00:00:00Z',
}));
const snapshot: BookmarkListResult = {
  list: items.slice(0, 2),
  total: 2,
  page: 1,
  page_size: 10,
  groups: [source, target],
  all_count: 2,
  ungrouped_count: 0,
};
const scope = { userId: '1', generation: 1 };
const unavailable = {
  __apiError: true,
  status: 409,
  code: 40914,
  message: 'Unavailable move',
  messageFromServer: true,
};

function Harness({
  onChanged,
}: {
  onChanged: (filters: BookmarkFilters, replace?: boolean) => void;
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const filters = parseBookmarkFilters(params);
  const onFiltersChange = useCallback(
    (next: BookmarkFilters, replace?: boolean) => {
      onChanged(next, replace);
      const query = new URLSearchParams({ group: next.group, q: next.q, page: String(next.page) });
      setParams(query, { replace });
    },
    [onChanged, setParams],
  );
  return (
    <>
      <button onClick={() => navigate(-1)}>History back</button>
      <button onClick={() => navigate(1)}>History forward</button>
      <BookmarksWorkspace
        scope={scope}
        filters={filters}
        navigationKey={location.key}
        isCurrentSession={() => true}
        onFiltersChange={onFiltersChange}
      />
    </>
  );
}
function mount(query = '') {
  const client = new QueryClient();
  const onChanged = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/bookmarks' + query]}>
          <Harness onChanged={onChanged} />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { client, onChanged };
}
async function selectBoth(): Promise<void> {
  await screen.findByText(items[0].title);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select current page (2)' }));
}
async function chooseTarget(name = 'Target'): Promise<void> {
  await userEvent.click(screen.getByRole('combobox', { name: 'Move to group' }));
  await userEvent.click(screen.getByRole('option', { name }));
}
function move(count = 2): HTMLElement {
  return screen.getByRole('button', { name: `Move ${count} bookmarks` });
}

describe('current-page batch organization', () => {
  it('clears current-page choices when the user moves to another actual page', async () => {
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) => ({
      ...snapshot,
      list: filters.page === 2 ? [items[10]] : items.slice(0, 10),
      total: 11,
      page: filters.page,
      all_count: 11,
      groups: [{ ...source, count: 11 }, target],
    }));
    mount();
    await screen.findByText('Resource 1');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Resource 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Resource 11');
    expect(screen.getByRole('checkbox', { name: 'Select Resource 11' })).not.toBeChecked();
    expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Resource 11' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Resource 1');
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
    expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument();
  });
  it('keeps a confirmed batch success terminal when its list refresh fails', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => {
      vi.mocked(bookmarksApi.list).mockRejectedValueOnce(Error('offline'));
      return {
        operation_id: intent.operationId,
        kind: 'batch_move',
        resource_id: null,
        changed_count: 2,
      };
    });
    const resolve = vi.spyOn(bookmarksApi, 'resolve');
    mount();
    await selectBoth();
    await userEvent.click(move());
    await screen.findByText(
      'Operation completed, but the list has not updated. Reload to see the latest result.',
    );
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Check latest result' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
    expect(mutate).toHaveBeenCalledOnce();
    expect(resolve).not.toHaveBeenCalled();
  });
  beforeEach(async () => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    if (!Element.prototype.hasPointerCapture)
      Object.defineProperty(Element.prototype, 'hasPointerCapture', {
        configurable: true,
        value: () => false,
      });
    if (!Element.prototype.scrollIntoView)
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: () => {},
      });
    await i18n.changeLanguage('en');
    vi.spyOn(bookmarksApi, 'list').mockResolvedValue(snapshot);
  });
  it('selects only loaded rows, exposes mixed state, excludes All as a target and cancels without writing', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate');
    mount();
    await screen.findByText(items[0].title);
    expect(screen.queryByRole('button', { name: /Move \d+ bookmarks/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Resource 1' }));
    const all = screen.getByRole('checkbox', { name: 'Select current page (2)' });
    expect(all).toHaveAttribute('aria-checked', 'mixed');
    expect(all).toHaveProperty('indeterminate', true);
    expect(screen.getByText('1 selected · current page only')).toBeInTheDocument();
    await userEvent.click(all);
    expect(all).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Resource 2' })).toBeChecked();
    await userEvent.click(screen.getByRole('combobox', { name: 'Move to group' }));
    expect(screen.getAllByRole('option').map((x) => x.textContent)).toEqual([
      'Ungrouped',
      'Source',
      'Target',
    ]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel selection' }));
    expect(all).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Move \d+ bookmarks/ })).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
  it('locks a submitted snapshot across duplicate clicks and refreshes counts even for a zero-change success', async () => {
    let finish: (result: MutationResult) => void = () => {
      throw Error('not initialized');
    };
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    await selectBoth();
    // Already in Source: a no-op still has a confirmed successful receipt.
    await chooseTarget('Source');
    const button = move();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    const intent = mutate.mock.calls[0][0];
    expect(intent).toMatchObject({
      kind: 'batch_move',
      bookmarkIds: items.slice(0, 2).map((x) => x.id),
      targetGroupId: source.id,
    });
    expect(move()).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).toBeDisabled();
    expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual({
      operationId: intent.operationId,
      kind: 'batch_move',
    });
    await act(async () =>
      finish({
        operation_id: intent.operationId,
        kind: 'batch_move',
        resource_id: null,
        changed_count: 0,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
    expect(bookmarksApi.list).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
  });
  it('clears user page changes and corrects the last moved page from the server while keeping the search', async () => {
    let moved = false;
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) => ({
      ...snapshot,
      list: filters.page === 2 && !moved ? [items[10]] : items.slice(0, 10),
      total: moved ? 10 : 11,
      page: moved ? 1 : filters.page,
      groups: [
        { ...source, count: moved ? 10 : 11 },
        { ...target, count: moved ? 1 : 0 },
      ],
      all_count: 11,
    }));
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => {
      moved = true;
      return {
        operation_id: intent.operationId,
        kind: 'batch_move',
        resource_id: null,
        changed_count: 1,
      };
    });
    const { onChanged } = mount(`?group=${source.id}&q=Resource&page=2`);
    await screen.findByText('Resource 11');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Resource 11' }));
    await chooseTarget();
    await userEvent.click(move(1));
    await screen.findByText('Resource 1');
    expect(onChanged).toHaveBeenCalledWith({ group: source.id, q: 'Resource', page: 1 }, true);
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
    expect(mutate.mock.calls[0][0].bookmarkIds).toEqual([items[10].id]);
  });
  it('refreshes an atomic failure, keeps only valid selected IDs and requires choosing a valid target before retrying', async () => {
    const latest = {
      ...snapshot,
      list: [items[0]],
      total: 1,
      groups: [{ ...source, count: 1 }],
      all_count: 1,
    };
    const mutate = vi
      .spyOn(bookmarksApi, 'mutate')
      .mockImplementationOnce(async () => {
        vi.mocked(bookmarksApi.list).mockResolvedValue(latest);
        throw unavailable;
      })
      .mockImplementationOnce(async (intent) => ({
        operation_id: intent.operationId,
        kind: 'batch_move',
        resource_id: null,
        changed_count: 1,
      }));
    mount();
    await selectBoth();
    await chooseTarget();
    await userEvent.click(move());
    await screen.findByText(
      'A bookmark or target group is unavailable. Check the latest contents before retrying.',
    );
    await waitFor(() => expect(screen.queryByText('Resource 2')).not.toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).toBeChecked();
    expect(screen.getByText('1 selected · current page only')).toBeInTheDocument();
    expect(move(1)).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Move to group' })).toHaveTextContent(
      'Unavailable group',
    );
    await chooseTarget('Ungrouped');
    expect(move(1)).toBeEnabled();
    await userEvent.click(move(1));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    const [first, second] = mutate.mock.calls.map(([intent]) => intent);
    expect(second.operationId).not.toBe(first.operationId);
    expect(second).toMatchObject({ bookmarkIds: [items[0].id], targetGroupId: null });
  });
  it('keeps a valid selected ID after an explicit failure automatically corrects the page', async () => {
    let failed = false;
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) => ({
      ...snapshot,
      list: failed || filters.page === 2 ? [items[10]] : items.slice(0, 10),
      total: failed ? 1 : 11,
      page: failed ? 1 : filters.page,
      groups: [{ ...source, count: failed ? 1 : 11 }, target],
      all_count: failed ? 1 : 11,
    }));
    vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async () => {
      failed = true;
      throw unavailable;
    });
    const { onChanged } = mount(`?group=${source.id}&page=2`);
    await screen.findByText('Resource 11');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Resource 11' }));
    await userEvent.click(move(1));
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ group: source.id, q: '', page: 1 }, true),
    );
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Select Resource 11' })).toBeEnabled(),
    );
    expect(screen.getByRole('checkbox', { name: 'Select Resource 11' })).toBeChecked();
    expect(move(1)).toBeEnabled();
  });
  it('disables stale selections when failure refresh fails and intersects them after an explicit reload', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async () => {
      vi.mocked(bookmarksApi.list).mockRejectedValueOnce(Error('offline'));
      throw unavailable;
    });
    mount();
    await selectBoth();
    await userEvent.click(move());
    await screen.findByText(
      'Move was not completed. Could not refresh valid selections; reload before retrying.',
    );
    expect(move()).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).toBeDisabled();
    vi.mocked(bookmarksApi.list).mockResolvedValue({
      ...snapshot,
      list: [items[0]],
      total: 1,
      groups: [{ ...source, count: 1 }, target],
      all_count: 1,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(move(1)).toBeEnabled());
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).toBeChecked();
    expect(mutate).toHaveBeenCalledOnce();
  });
  it.each(['succeeded', 'failed', 'not_executed'] as const)(
    'keeps original IDs/target/key across filtering until resolving %s without resending',
    async (status) => {
      let moved = false;
      vi.mocked(bookmarksApi.list).mockImplementation(async (filters) => {
        const rows = moved
          ? items.slice(0, 2).map((item) => ({ ...item, group_id: target.id }))
          : items.slice(0, 2);
        const list = filters.group === target.id && !moved ? [] : rows;
        return {
          ...snapshot,
          list,
          total: list.length,
          groups: [
            { ...source, count: moved ? 0 : 2 },
            { ...target, count: moved ? 2 : 0 },
          ],
        };
      });
      const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(Error('lost response'));
      const resolve = vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => {
        moved = status === 'succeeded';
        return {
          operation_id: operationId,
          kind: status === 'not_executed' ? null : 'batch_move',
          status,
          resource_id: null,
          changed_count: moved ? 2 : 0,
          error_code: status === 'failed' ? 40914 : null,
        };
      });
      mount();
      await selectBoth();
      await chooseTarget();
      await userEvent.click(move());
      await screen.findByRole('button', { name: 'Check latest result' });
      const intent = mutate.mock.calls[0][0];
      await userEvent.click(screen.getByRole('button', { name: /^Target\s+0$/ }));
      await screen.findByText('This group has no bookmarks');
      expect(screen.getByText('2 selected · current page only')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Move to group' })).toHaveTextContent('Target');
      expect(move()).toBeDisabled();
      expect(intent.bookmarkIds).toEqual(items.slice(0, 2).map((item) => item.id));
      await userEvent.click(screen.getByRole('button', { name: 'Check latest result' }));
      await waitFor(() =>
        expect(
          screen.queryByRole('group', { name: 'Batch bookmark move' }),
        ).not.toBeInTheDocument(),
      );
      expect(resolve).toHaveBeenCalledWith(intent.operationId);
      expect(mutate).toHaveBeenCalledOnce();
      expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
      if (status === 'succeeded') {
        await screen.findByText('Resource 1');
        expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
      } else {
        await userEvent.click(screen.getByRole('button', { name: 'History back' }));
        await screen.findByText('Resource 1');
        expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
      }
    },
  );
  it('never restores the original selection after history returns to the unknown intent page and then resolves failed', async () => {
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) => ({
      ...snapshot,
      list: filters.group === target.id ? [] : snapshot.list,
      total: filters.group === target.id ? 0 : 2,
    }));
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(Error('lost response'));
    vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => ({
      operation_id: operationId,
      kind: 'batch_move',
      status: 'failed',
      resource_id: null,
      changed_count: 0,
      error_code: 40914,
    }));
    mount();
    await selectBoth();
    await userEvent.click(move());
    await screen.findByRole('button', { name: 'Check latest result' });
    await userEvent.click(screen.getByRole('button', { name: /^Target\s+0$/ }));
    await screen.findByText('This group has no bookmarks');
    await userEvent.click(screen.getByRole('button', { name: 'History back' }));
    await screen.findByText('Resource 1');
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
    expect(move()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Check latest result' }));
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
    expect(mutate).toHaveBeenCalledOnce();
  });
  it('clears selection immediately for a loading search and for back/forward history', async () => {
    let finish: (value: BookmarkListResult) => void = () => {
      throw Error('not initialized');
    };
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) =>
      filters.q
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : snapshot,
    );
    mount();
    await selectBoth();
    await userEvent.type(screen.getByRole('textbox', { name: 'Search bookmarks' }), '2{Enter}');
    await screen.findByRole('status', { name: 'Loading bookmarks…' });
    expect(screen.queryByRole('checkbox', { name: 'Select Resource 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument();
    await act(async () => finish({ ...snapshot, list: [items[1]], total: 1 }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Resource 2' }));
    expect(move(1)).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'History back' }));
    await screen.findByText('Resource 1');
    expect(screen.getByRole('checkbox', { name: 'Select Resource 1' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Resource 2' })).not.toBeChecked();
    vi.mocked(bookmarksApi.list).mockResolvedValue({ ...snapshot, list: [items[1]], total: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'History forward' }));
    await screen.findByText('Resource 2');
    expect(screen.getByRole('checkbox', { name: 'Select Resource 2' })).not.toBeChecked();
  });
  it('does not let an old failure-refresh response select items in a newer browsing scope', async () => {
    let finish: (value: BookmarkListResult) => void = () => {
      throw Error('not initialized');
    };
    vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async () => {
      vi.mocked(bookmarksApi.list).mockImplementation(async (filters) =>
        filters.group === target.id
          ? { ...snapshot, list: [{ ...items[2], group_id: target.id }], total: 1 }
          : new Promise((resolve) => {
              finish = resolve;
            }),
      );
      throw unavailable;
    });
    mount();
    await selectBoth();
    await userEvent.click(move());
    await waitFor(() => expect(bookmarksApi.list).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole('button', { name: /^Target\s+0$/ }));
    await screen.findByText('Resource 3');
    await act(async () => finish({ ...snapshot, list: [items[0]], total: 1 }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Select Resource 3' })).toBeEnabled(),
    );
    expect(screen.getByRole('checkbox', { name: 'Select Resource 3' })).not.toBeChecked();
    expect(screen.queryByText('Resource 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument();
  });
  it('replaces an old hidden group recovery target when a new batch becomes unknown', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(Error('lost response'));
    vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => ({
      operation_id: operationId,
      kind: 'group_create',
      status: 'failed',
      resource_id: null,
      changed_count: 0,
      error_code: 40910,
    }));
    mount();
    await screen.findByText('Resource 1');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Group name *'), 'Research');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create group' }));
    await within(dialog).findByRole('button', { name: 'Check latest result' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check latest result' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add bookmark' })).toBeEnabled());
    await selectBoth();
    await userEvent.click(move());
    await screen.findByRole('button', { name: 'Check latest result' });
    expect(screen.queryByRole('button', { name: 'Return to draft' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Return to deletion confirmation' }),
    ).not.toBeInTheDocument();
    expect(mutate.mock.calls[1][0].kind).toBe('batch_move');
    expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual({
      operationId: mutate.mock.calls[1][0].operationId,
      kind: 'batch_move',
    });
  });
});
