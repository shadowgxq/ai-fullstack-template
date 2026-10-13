import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import { bookmarksApi } from '../../model/bookmarks.api';
import type { Bookmark, BookmarkFilters, BookmarkListResult } from '../../model/bookmarks.types';
import { BookmarksWorkspace } from './BookmarksWorkspace';

const bookmark: Bookmark = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  title: 'Payment guide',
  url: 'https://example.com/payments?a=1#section',
  note: '<script>private note</script>',
  group_id: null,
  updated_at: '2026-10-13T00:00:00Z',
};
const snapshot: BookmarkListResult = {
  list: [bookmark],
  total: 1,
  page: 1,
  page_size: 10,
  groups: [],
  all_count: 1,
  ungrouped_count: 1,
};
const scope = { userId: '1', generation: 1 };

function mount(filters: BookmarkFilters = { group: 'all', q: '', page: 1 }) {
  const onFiltersChange = vi.fn();
  const client = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <BookmarksWorkspace
          scope={scope}
          filters={filters}
          isCurrentSession={() => true}
          onFiltersChange={onFiltersChange}
        />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { onFiltersChange, client };
}

async function fillDraft(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Title *'), 'My saved resource');
  await userEvent.type(within(dialog).getByLabelText('Link *'), 'https://example.com/new');
  return dialog;
}

describe('bookmarks workspace user paths', () => {
  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    sessionStorage.clear();
    await i18n.changeLanguage('en');
    vi.restoreAllMocks();
    vi.spyOn(bookmarksApi, 'list').mockResolvedValue(snapshot);
  });
  it('opens safe links, displays note as text and submits trimmed search at page one', async () => {
    const { onFiltersChange } = mount({ group: 'ungrouped', q: '', page: 2 });
    const link = await screen.findByRole('link', { name: 'Open Payment guide in a new tab' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search bookmarks' }),
      '  pay_%  {Enter}',
    );
    expect(onFiltersChange).toHaveBeenLastCalledWith({ group: 'ungrouped', q: 'pay_%', page: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'View note for Payment guide' }));
    expect(within(screen.getByRole('dialog')).getByText(bookmark.note)).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('script')).toBeNull();
  });
  it('preserves fields and focuses invalid input without sending a write', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate');
    mount();
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save bookmark' }));
    expect(within(dialog).getByLabelText('Title *')).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByLabelText('Title *')).toHaveFocus();
    expect(mutate).not.toHaveBeenCalled();
  });
  it('guards repeated submit events and keeps a trusted server field rejection in the dialog', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue({
      __apiError: true,
      message: 'Invalid URL',
      messageFromServer: true,
      status: 422,
      code: 42200,
      details: [{ loc: ['body', 'url'], type: 'value_error', msg: 'URL' }],
    });
    mount();
    await screen.findByText(bookmark.title);
    const dialog = await fillDraft();
    const form = within(dialog).getByRole('button', { name: 'Save bookmark' }).closest('form');
    if (!form) throw new Error('Expected form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Link *')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(mutate).toHaveBeenCalledOnce();
    expect(within(dialog).getByLabelText('Title *')).toHaveValue('My saved resource');
    expect(within(dialog).getByLabelText('Link *')).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Save bookmark' })).toBeEnabled();
  });
  it('offers recovery inside the unknown dialog and preserves draft after not-executed', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(new Error('connection lost'));
    const resolve = vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => ({
      operation_id: operationId,
      kind: null,
      status: 'not_executed',
      resource_id: null,
      changed_count: 0,
      error_code: null,
    }));
    mount();
    await screen.findByText(bookmark.title);
    const dialog = await fillDraft();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save bookmark' }));
    await within(dialog).findByRole('button', { name: 'Check latest result' });
    expect(within(dialog).getByRole('button', { name: 'Save bookmark' })).toBeDisabled();
    expect(within(dialog).getByLabelText('Title *')).toHaveValue('My saved resource');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Check latest result' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Save bookmark' })).toBeEnabled(),
    );
    expect(resolve).toHaveBeenCalledWith(mutate.mock.calls[0][0].operationId);
    expect(within(dialog).getByLabelText('Title *')).toHaveValue('My saved resource');
  });
  it('reports saved-but-stale after a successful receipt and refresh failure', async () => {
    vi.mocked(bookmarksApi.list)
      .mockResolvedValueOnce(snapshot)
      .mockRejectedValue(new Error('refresh failed'));
    vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => ({
      operation_id: intent.operationId,
      kind: intent.kind,
      resource_id: bookmark.id,
      changed_count: 1,
    }));
    mount();
    await screen.findByText(bookmark.title);
    const dialog = await fillDraft();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save bookmark' }));
    expect(
      await screen.findByText(
        'Operation completed, but the list has not updated. Reload to see the latest result.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check latest result' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
    expect(screen.getByText(bookmark.title)).toBeInTheDocument();
  });
  it('does not enable editing when current-value loading fails, and cancels deletion without mutation', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate');
    vi.spyOn(bookmarksApi, 'get').mockRejectedValue(new Error('offline'));
    mount();
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Payment guide' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit bookmark' }));
    await within(screen.getByRole('dialog')).findByRole('alert');
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: 'Save changes' }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Payment guide' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete bookmark' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(bookmark.url)).toBeInTheDocument();
    expect(within(dialog).getByText('Deletion cannot be undone.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mutate).not.toHaveBeenCalled();
  });
  it('falls back from an unavailable group and keeps the keyword', async () => {
    vi.mocked(bookmarksApi.list).mockRejectedValue({
      __apiError: true,
      message: 'Unavailable',
      messageFromServer: true,
      status: 404,
      code: 40410,
    });
    const { onFiltersChange } = mount({ group: bookmark.id, q: 'keep', page: 3 });
    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenCalledWith(
        { group: 'ungrouped', q: 'keep', page: 1 },
        true,
      ),
    );
  });
  it('loads current edit values and submits only the selected bookmark draft', async () => {
    vi.spyOn(bookmarksApi, 'get').mockResolvedValue({
      ...bookmark,
      title: 'Current server title',
      note: 'Original note',
    });
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => ({
      operation_id: intent.operationId,
      kind: intent.kind,
      resource_id: bookmark.id,
      changed_count: 1,
    }));
    mount();
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Payment guide' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit bookmark' }));
    const title = await screen.findByLabelText('Title *');
    expect(title).toHaveValue('Current server title');
    await userEvent.type(screen.getByLabelText('Note'), ' and edited');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mutate.mock.calls[0][0]).toEqual({
      operationId: expect.any(String),
      kind: 'bookmark_update',
      resourceId: bookmark.id,
      draft: {
        title: 'Current server title',
        url: bookmark.url,
        note: 'Original note and edited',
        group_id: null,
      },
    });
  });
  it('confirms deletion of the shown target and adopts the server last-page fallback', async () => {
    vi.mocked(bookmarksApi.list)
      .mockResolvedValueOnce({
        ...snapshot,
        total: 21,
        all_count: 21,
        ungrouped_count: 21,
        page: 3,
      })
      .mockResolvedValue({ ...snapshot, total: 20, all_count: 20, ungrouped_count: 20, page: 2 });
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(async (intent) => ({
      operation_id: intent.operationId,
      kind: intent.kind,
      resource_id: bookmark.id,
      changed_count: 1,
    }));
    const { onFiltersChange } = mount({ group: 'ungrouped', q: '', page: 3 });
    await screen.findByText(bookmark.title);
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Payment guide' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete bookmark' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(bookmark.title)).toBeInTheDocument();
    expect(within(dialog).getByText(bookmark.url)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete bookmark' }));
    await screen.findByText('Page 2 / 2 · 20 bookmarks');
    expect(mutate.mock.calls[0][0]).toEqual({
      operationId: expect.any(String),
      kind: 'bookmark_delete',
      resourceId: bookmark.id,
    });
    expect(onFiltersChange).toHaveBeenCalledWith({ group: 'ungrouped', q: '', page: 2 }, true);
  });
});
