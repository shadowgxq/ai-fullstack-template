import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import { bookmarksApi } from '../../model/bookmarks.api';
import type {
  Bookmark,
  BookmarkFilters,
  BookmarkGroup,
  BookmarkListResult,
  MutationResult,
} from '../../model/bookmarks.types';
import { BookmarksWorkspace } from './BookmarksWorkspace';

const payments: BookmarkGroup = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Payments',
  count: 1,
};
const empty: BookmarkGroup = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  name: 'Empty',
  count: 0,
};
const bookmark: Bookmark = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  title: 'Payment guide',
  url: 'https://example.com/payments',
  note: '',
  group_id: payments.id,
  updated_at: '2026-10-13T00:00:00Z',
};
const snapshot: BookmarkListResult = {
  list: [bookmark],
  total: 1,
  page: 1,
  page_size: 10,
  groups: [payments, empty],
  all_count: 1,
  ungrouped_count: 0,
};
const scope = { userId: '1', generation: 1 };

function Harness({
  initial,
  onChanged,
}: {
  initial: BookmarkFilters;
  onChanged: (filters: BookmarkFilters, replace?: boolean) => void;
}) {
  const [filters, setFilters] = useState(initial);
  const onFiltersChange = useCallback(
    (next: BookmarkFilters, replace?: boolean) => {
      onChanged(next, replace);
      setFilters(next);
    },
    [onChanged],
  );
  return (
    <BookmarksWorkspace
      scope={scope}
      filters={filters}
      isCurrentSession={() => true}
      onFiltersChange={onFiltersChange}
    />
  );
}

function mount(initial: BookmarkFilters = { group: 'all', q: '', page: 1 }) {
  const client = new QueryClient();
  const onChanged = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <Harness initial={initial} onChanged={onChanged} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { client, onChanged };
}

async function openGroupAction(name: string, action: string): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', { name: `Actions for group ${name}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: action }));
  return screen.getByRole('dialog');
}

const conflict = {
  __apiError: true,
  message: 'Count changed',
  messageFromServer: true,
  status: 409,
  code: 40912,
};

describe('group management and bookmark integration', () => {
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

  it('creates an empty group with a trimmed name and preserves the global count', async () => {
    const reading = { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Reading', count: 0 };
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => {
      vi.mocked(bookmarksApi.list).mockResolvedValue({
        ...snapshot,
        groups: [...snapshot.groups, reading],
      });
      return {
        operation_id: intent.operationId,
        kind: intent.kind,
        resource_id: reading.id,
        changed_count: 1,
      };
    });
    mount();
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Group name *'), '  Reading  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create group' }));
    await screen.findByRole('button', { name: 'Actions for group Reading' });
    expect(mutate.mock.calls[0][0]).toMatchObject({ kind: 'group_create', groupName: 'Reading' });
    expect(screen.getByRole('button', { name: /^Reading\s+0$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All bookmarks\s+1$/ })).toBeInTheDocument();
  });

  it('shows reserved and ASCII duplicate name errors without submitting', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate');
    mount();
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    const dialog = screen.getByRole('dialog');
    const field = within(dialog).getByLabelText('Group name *');
    await userEvent.type(field, '全部');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create group' }));
    expect(
      within(dialog).getByText('The names “全部” and “未分组” are reserved.'),
    ).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, '  pAyMENTS  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create group' }));
    expect(
      within(dialog).getByText('A group with this name already exists. Choose another name.'),
    ).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('retains the name for authoritative duplicate and unavailable-resource failures', async () => {
    const mutate = vi
      .spyOn(bookmarksApi, 'mutate')
      .mockRejectedValueOnce({
        __apiError: true,
        message: 'Duplicate',
        messageFromServer: true,
        status: 409,
        code: 40910,
      })
      .mockRejectedValueOnce({
        __apiError: true,
        message: 'Unavailable',
        messageFromServer: true,
        status: 404,
        code: 40410,
      });
    mount();
    await screen.findByText(bookmark.title);
    const dialog = await openGroupAction('Payments', 'Rename group');
    const field = within(dialog).getByLabelText('Group name *');
    await userEvent.clear(field);
    await userEvent.type(field, 'Research');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save name' }));
    await within(dialog).findByText('A group with this name already exists. Choose another name.');
    expect(field).toHaveValue('Research');
    expect(field).toHaveFocus();
    await userEvent.type(field, ' 2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save name' }));
    await within(dialog).findByRole('alert');
    expect(field).toHaveValue('Research 2');
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('cancels rename without writing and applies a target-specific rename without editing bookmark time', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => {
      vi.mocked(bookmarksApi.list).mockResolvedValue({
        ...snapshot,
        groups: [{ ...payments, name: 'Payments 2' }, empty],
      });
      return {
        operation_id: intent.operationId,
        kind: intent.kind,
        resource_id: payments.id,
        changed_count: 1,
      };
    });
    mount();
    await screen.findByText(bookmark.title);
    const original = await openGroupAction('Payments', 'Rename group');
    expect(within(original).getByLabelText('Group name *')).toHaveValue('Payments');
    await userEvent.click(within(original).getByRole('button', { name: 'Cancel' }));
    expect(mutate).not.toHaveBeenCalled();
    const dialog = await openGroupAction('Payments', 'Rename group');
    await userEvent.type(within(dialog).getByLabelText('Group name *'), ' 2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save name' }));
    await screen.findByRole('button', { name: 'Actions for group Payments 2' });
    expect(mutate.mock.calls[0][0]).toMatchObject({
      kind: 'group_rename',
      resourceId: payments.id,
      groupName: 'Payments 2',
    });
    expect(document.querySelector('time')).toHaveAttribute('datetime', bookmark.updated_at);
  });

  it('keeps fixed groups free of rename/delete actions and exposes the mobile management entry', async () => {
    mount();
    await screen.findByText(bookmark.title);
    expect(
      screen.queryByRole('button', { name: 'Actions for group All bookmarks' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Actions for group Ungrouped' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Manage groups' }));
    expect(screen.getByRole('menuitem', { name: 'Create group' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Rename group' })).not.toBeInTheDocument();
  });

  it('defaults a new bookmark to ungrouped while exposing the real group choices', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => ({
      operation_id: intent.operationId,
      kind: intent.kind,
      resource_id: bookmark.id,
      changed_count: 1,
    }));
    mount({ group: payments.id, q: '', page: 1 });
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }));
    const dialog = screen.getByRole('dialog');
    const select = within(dialog).getByRole('combobox');
    expect(select).toHaveTextContent('Ungrouped');
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'Empty' }));
    await userEvent.type(within(dialog).getByLabelText('Title *'), 'New resource');
    await userEvent.type(within(dialog).getByLabelText('Link *'), 'https://example.com/new');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save bookmark' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate.mock.calls[0][0].draft?.group_id).toBe(empty.id);
  });

  it('combines group and submitted keywords while group counts remain unfiltered', async () => {
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) =>
      filters.q ? { ...snapshot, list: [], total: 0 } : snapshot,
    );
    mount({ group: payments.id, q: '', page: 1 });
    await screen.findByText(bookmark.title);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search bookmarks' }),
      ' missing {Enter}',
    );
    await screen.findByText('No matching bookmarks');
    expect(bookmarksApi.list).toHaveBeenCalledWith(
      { group: payments.id, q: 'missing', page: 1 },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('button', { name: /^Payments\s+1$/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Empty\s+0$/ }));
    expect(bookmarksApi.list).toHaveBeenCalledWith(
      { group: empty.id, q: 'missing', page: 1 },
      expect.any(AbortSignal),
    );
  });

  it('deletes an empty background group only after explicit confirmation and leaves the current filter', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => {
      vi.mocked(bookmarksApi.list).mockResolvedValue({ ...snapshot, groups: [payments] });
      return {
        operation_id: intent.operationId,
        kind: intent.kind,
        resource_id: empty.id,
        changed_count: 0,
      };
    });
    const { onChanged } = mount();
    await screen.findByText(bookmark.title);
    const dialog = await openGroupAction('Empty', 'Delete group');
    expect(within(dialog).getByText(/Its 0 bookmarks will move to Ungrouped/)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mutate.mock.calls[0][0]).toMatchObject({
      kind: 'group_delete',
      resourceId: empty.id,
      expectedCount: 0,
    });
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^All bookmarks\s+1$/ })).toBeInTheDocument();
  });

  it.each([1, 2])(
    'preserves keywords while deleting the current group and adopts actual page %s',
    async (actualPage) => {
      const initial = {
        ...snapshot,
        page: 2,
        total: 11,
        all_count: 11,
        groups: [{ ...payments, count: 11 }, empty],
      };
      const after = {
        ...snapshot,
        page: actualPage,
        total: actualPage === 1 ? 1 : 11,
        list: [{ ...bookmark, group_id: null }],
        groups: [empty],
        ungrouped_count: 11,
        all_count: 11,
      };
      vi.mocked(bookmarksApi.list).mockImplementation(async (filters) =>
        filters.group === 'ungrouped' ? after : initial,
      );
      vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => ({
        operation_id: intent.operationId,
        kind: intent.kind,
        resource_id: payments.id,
        changed_count: 11,
      }));
      const { onChanged } = mount({ group: payments.id, q: 'guide', page: 2 });
      await screen.findByText(bookmark.title);
      const dialog = await openGroupAction('Payments', 'Delete group');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));
      await waitFor(() =>
        expect(onChanged).toHaveBeenCalledWith({ group: 'ungrouped', q: 'guide', page: 2 }, true),
      );
      await screen.findByText(`Page ${actualPage} / ${actualPage} · ${after.total} bookmarks`);
      if (actualPage === 1)
        expect(onChanged).toHaveBeenCalledWith({ group: 'ungrouped', q: 'guide', page: 1 }, true);
      expect(
        screen.queryByRole('button', { name: 'Actions for group Payments' }),
      ).not.toBeInTheDocument();
    },
  );

  it('requires fresh impact and another explicit confirmation for every count conflict', async () => {
    let count = 1;
    vi.mocked(bookmarksApi.list).mockImplementation(async () => ({
      ...snapshot,
      all_count: count,
      groups: [{ ...payments, count }, empty],
    }));
    const mutate = vi
      .spyOn(bookmarksApi, 'mutate')
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockImplementation(async (intent) => ({
        operation_id: intent.operationId,
        kind: intent.kind,
        resource_id: payments.id,
        changed_count: count,
      }));
    mount();
    await screen.findByText(bookmark.title);
    const dialog = await openGroupAction('Payments', 'Delete group');
    const confirm = within(dialog).getByRole('button', { name: 'Delete group' });
    await userEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    count = 3;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refresh deletion impact' }));
    await within(dialog).findByText(/Its 3 bookmarks will move to Ungrouped/);
    expect(mutate).toHaveBeenCalledOnce();
    await userEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    count = 4;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refresh deletion impact' }));
    await within(dialog).findByText(/Its 4 bookmarks will move to Ungrouped/);
    await userEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mutate.mock.calls.map((call) => call[0].expectedCount)).toEqual([1, 3, 4]);
    expect(new Set(mutate.mock.calls.map((call) => call[0].operationId)).size).toBe(3);
  });

  it('retains deletion target and keeps confirmation disabled when impact refresh fails', async () => {
    vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(conflict);
    mount();
    await screen.findByText(bookmark.title);
    const dialog = await openGroupAction('Payments', 'Delete group');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));
    await within(dialog).findByRole('button', { name: 'Refresh deletion impact' });
    vi.mocked(bookmarksApi.list).mockRejectedValueOnce(new Error('offline'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refresh deletion impact' }));
    await within(dialog).findByText(
      'Could not refresh deletion impact. Try again before confirming.',
    );
    expect(within(dialog).getByRole('button', { name: 'Delete group' })).toBeDisabled();
    expect(within(dialog).getByText(/Its 1 bookmarks will move to Ungrouped/)).toBeInTheDocument();
  });

  it('retains a closed unknown group draft and resolves the original key without resubmitting', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(new Error('lost response'));
    const resolve = vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => ({
      operation_id: operationId,
      kind: 'group_create',
      status: 'failed',
      resource_id: null,
      changed_count: 0,
      error_code: 40910,
    }));
    mount();
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Group name *'), 'Research');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create group' }));
    await within(dialog).findByRole('button', { name: 'Check latest result' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const key = mutate.mock.calls[0][0].operationId;
    expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual({
      operationId: key,
      kind: 'group_create',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Return to draft' }));
    const resumed = screen.getByRole('dialog');
    expect(within(resumed).getByLabelText('Group name *')).toHaveValue('Research');
    expect(within(resumed).getByRole('button', { name: 'Create group' })).toBeDisabled();
    await userEvent.click(within(resumed).getByRole('button', { name: 'Check latest result' }));
    await within(resumed).findByText('A group with this name already exists. Choose another name.');
    expect(resolve).toHaveBeenCalledWith(key);
    expect(mutate).toHaveBeenCalledOnce();
    expect(within(resumed).getByLabelText('Group name *')).toHaveValue('Research');
  });

  it.each([
    ['group_create', 'bookmark_create'],
    ['group_delete', 'bookmark_create'],
    ['group_delete', 'group_create'],
  ] as const)(
    'replaces a closed terminal %s context with only the new %s recovery target',
    async (previousKind, nextKind) => {
      let rejectNext: (failure: Error) => void = () => {
        throw new Error('not initialized');
      };
      const mutate = vi
        .spyOn(bookmarksApi, 'mutate')
        .mockRejectedValueOnce(new Error('lost response'))
        .mockImplementationOnce(
          () =>
            new Promise<MutationResult>((_resolve, reject) => {
              rejectNext = reject;
            }),
        );
      const resolve = vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => {
        const intent = mutate.mock.calls.find(
          ([intent]) => intent.operationId === operationId,
        )?.[0];
        if (!intent) throw new Error('Unknown operation');
        return {
          operation_id: operationId,
          kind: intent.kind,
          status: 'failed',
          resource_id: null,
          changed_count: 0,
          error_code: intent.kind === 'group_create' ? 40910 : 40410,
        };
      });
      mount();
      await screen.findByText(bookmark.title);
      if (previousKind === 'group_create') {
        await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
        const dialog = screen.getByRole('dialog');
        await userEvent.type(within(dialog).getByLabelText('Group name *'), 'Research');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Create group' }));
      } else {
        const dialog = await openGroupAction('Payments', 'Delete group');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));
      }
      const previous = screen.getByRole('dialog');
      await within(previous).findByRole('button', { name: 'Check latest result' });
      await userEvent.click(within(previous).getByRole('button', { name: 'Cancel' }));
      await userEvent.click(screen.getByRole('button', { name: 'Check latest result' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add bookmark' })).toBeEnabled(),
      );
      expect(resolve).toHaveBeenCalledWith(mutate.mock.calls[0][0].operationId);
      expect(
        screen.getByRole('button', {
          name:
            previousKind === 'group_create' ? 'Return to draft' : 'Return to deletion confirmation',
        }),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {
          name: nextKind === 'bookmark_create' ? 'Add bookmark' : 'Create group',
        }),
      );
      const next = screen.getByRole('dialog');
      if (nextKind === 'bookmark_create') {
        await userEvent.type(within(next).getByLabelText('Title *'), 'New resource');
        await userEvent.type(within(next).getByLabelText('Link *'), 'https://example.com/new');
      } else {
        await userEvent.type(within(next).getByLabelText('Group name *'), 'New group');
      }
      await userEvent.click(
        within(next).getByRole('button', {
          name: nextKind === 'bookmark_create' ? 'Save bookmark' : 'Create group',
        }),
      );
      await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
      await userEvent.click(within(next).getByRole('button', { name: 'Cancel' }));
      expect(screen.getAllByRole('button', { name: 'Return to draft' })).toHaveLength(1);
      expect(
        screen.queryByRole('button', { name: 'Return to deletion confirmation' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add bookmark' })).toBeDisabled();
      await act(async () => rejectNext(new Error('new response lost')));
      await screen.findByRole('button', { name: 'Check latest result' });
      const nextIntent = mutate.mock.calls[1][0];
      expect(nextIntent.kind).toBe(nextKind);
      expect(nextIntent.operationId).not.toBe(mutate.mock.calls[0][0].operationId);
      expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual({
        operationId: nextIntent.operationId,
        kind: nextKind,
      });
      await userEvent.click(screen.getByRole('button', { name: 'Return to draft' }));
      const resumed = screen.getByRole('dialog');
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(
        within(resumed).getByLabelText(nextKind === 'bookmark_create' ? 'Title *' : 'Group name *'),
      ).toHaveValue(nextKind === 'bookmark_create' ? 'New resource' : 'New group');
      expect(within(resumed).queryByText(/Its 1 bookmarks will move/)).not.toBeInTheDocument();
      await userEvent.click(within(resumed).getByRole('button', { name: 'Cancel' }));
      await userEvent.click(screen.getByRole('button', { name: 'Check latest result' }));
      await waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));
      expect(resolve).toHaveBeenLastCalledWith(nextIntent.operationId);
      expect(screen.getAllByRole('button', { name: 'Return to draft' })).toHaveLength(1);
    },
  );

  it('keeps group metadata recognizable during a new filter request without showing old rows', async () => {
    let finish: (value: BookmarkListResult) => void = () => {
      throw new Error('not initialized');
    };
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) =>
      filters.group === payments.id
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : snapshot,
    );
    mount();
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: /^Payments\s+1$/ }));
    await screen.findByRole('status', { name: 'Loading bookmarks…' });
    expect(screen.getByRole('button', { name: 'Actions for group Payments' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Bookmark groups' })).toHaveTextContent('Payments');
    expect(screen.queryByText(bookmark.title)).not.toBeInTheDocument();
    expect(screen.queryByText('Page 1 / 1 · 1 bookmarks')).not.toBeInTheDocument();
    await act(async () => {
      finish({ ...snapshot, list: [], total: 0 });
    });
    await screen.findByText('This group has no bookmarks');
  });

  it('keeps the current filter when a pending deletion becomes a background deletion', async () => {
    let finish: (value: MutationResult) => void = () => {
      throw new Error('not initialized');
    };
    let isDeleted = false;
    vi.mocked(bookmarksApi.list).mockImplementation(async (filters) => ({
      ...snapshot,
      groups: isDeleted ? [empty] : snapshot.groups,
      list: filters.group === empty.id ? [] : [bookmark],
      total: filters.group === empty.id ? 0 : 1,
    }));
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { onChanged } = mount({ group: payments.id, q: '', page: 1 });
    await screen.findByText(bookmark.title);
    const dialog = await openGroupAction('Payments', 'Delete group');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: /^Empty\s+0$/ }));
    await screen.findByText('This group has no bookmarks');
    await act(async () => {
      isDeleted = true;
      const intent = mutate.mock.calls[0][0];
      finish({
        operation_id: intent.operationId,
        kind: intent.kind,
        resource_id: payments.id,
        changed_count: 1,
      });
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Actions for group Payments' }),
      ).not.toBeInTheDocument(),
    );
    expect(onChanged).toHaveBeenLastCalledWith({ group: empty.id, q: '', page: 1 }, undefined);
    expect(onChanged.mock.calls.some((call) => call[0].group === 'ungrouped')).toBe(false);
  });

  it('keeps an unknown deletion target after closing and resolves it before changing the filter', async () => {
    let isDeleted = false;
    vi.mocked(bookmarksApi.list).mockImplementation(async () =>
      isDeleted
        ? {
            ...snapshot,
            list: [{ ...bookmark, group_id: null }],
            groups: [empty],
            ungrouped_count: 1,
          }
        : snapshot,
    );
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(new Error('lost response'));
    const resolve = vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => {
      isDeleted = true;
      return {
        operation_id: operationId,
        kind: 'group_delete',
        status: 'succeeded',
        resource_id: payments.id,
        changed_count: 1,
        error_code: null,
      };
    });
    const { onChanged } = mount({ group: payments.id, q: '', page: 1 });
    await screen.findByText(bookmark.title);
    const dialog = await openGroupAction('Payments', 'Delete group');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }));
    await within(dialog).findByRole('button', { name: 'Check latest result' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Return to deletion confirmation' }));
    const resumed = screen.getByRole('dialog');
    expect(within(resumed).getByText(/Its 1 bookmarks will move to Ungrouped/)).toBeInTheDocument();
    expect(within(resumed).getByRole('button', { name: 'Delete group' })).toBeDisabled();
    await userEvent.click(within(resumed).getByRole('button', { name: 'Check latest result' }));
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ group: 'ungrouped', q: '', page: 1 }, true),
    );
    expect(resolve).toHaveBeenCalledWith(mutate.mock.calls[0][0].operationId);
    expect(mutate).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
  });
});
