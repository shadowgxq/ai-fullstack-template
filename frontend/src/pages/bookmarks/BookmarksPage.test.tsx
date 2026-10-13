import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore, useLoginModal, type AuthUser } from '../../features/auth';
import {
  bookmarksApi,
  type BookmarkListResult,
  type MutationResult,
} from '../../features/bookmarks';
import { i18n } from '../../shared/i18n';
import { BookmarksPage } from './BookmarksPage';

function user(id: string): AuthUser {
  return {
    userId: id,
    username: `User ${id}`,
    nickname: '',
    email: null,
    avatar: null,
    role: 'user',
    admin: false,
  };
}
function result(title: string): BookmarkListResult {
  return {
    list: [
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title,
        url: 'https://example.com',
        group_id: null,
        note: '',
        updated_at: '2026-10-13T00:00:00Z',
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
    groups: [],
    all_count: 1,
    ungrouped_count: 1,
  };
}
function mount() {
  const client = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/bookmarks']}>
          <BookmarksPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return client;
}

describe('bookmark host and account isolation', () => {
  it('keeps a late batch receipt isolated from a newer account and its private selections', async () => {
    useAuthStore.getState().setSession('first', user('1'));
    const oldGeneration = useAuthStore.getState().sessionGeneration;
    let finish: (value: MutationResult) => void = () => {
      throw new Error('not initialized');
    };
    vi.spyOn(bookmarksApi, 'list')
      .mockResolvedValueOnce(result('First private item'))
      .mockResolvedValue(result('Second private item'));
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const client = mount();
    await screen.findByText('First private item');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select First private item' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move 1 bookmarks' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    act(() => useAuthStore.getState().setSession('second', user('2')));
    await screen.findByText('Second private item');
    const intent = mutate.mock.calls[0][0];
    await act(async () =>
      finish({
        operation_id: intent.operationId,
        kind: 'batch_move',
        resource_id: null,
        changed_count: 0,
      }),
    );
    expect(screen.queryByText('First private item')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Second private item' })).not.toBeChecked();
    expect(screen.queryByRole('group', { name: 'Batch bookmark move' })).not.toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ['bookmarks', '1', oldGeneration] })).toEqual([]);
    expect(sessionStorage.getItem('bookmarks.recovery.2')).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual({
      operationId: intent.operationId,
      kind: 'batch_move',
    });
  });
  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    useAuthStore.getState().clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    await i18n.changeLanguage('en');
  });
  it('does not query private data until authenticated and exposes the bookmark home link', () => {
    const list = vi.spyOn(bookmarksApi, 'list');
    mount();
    expect(list).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Keep great resources/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Feature example' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search bookmarks' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bookmarks home' })).toHaveAttribute(
      'href',
      '/bookmarks',
    );
    expect(screen.getByText(/Sign in to save and find your private bookmarks/)).toBeInTheDocument();
  });
  it('opens the existing login modal from the welcome action without requesting private data', async () => {
    const list = vi.spyOn(bookmarksApi, 'list');
    useLoginModal.getState().closeLogin();
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Log in and start saving' }));
    expect(useLoginModal.getState()).toMatchObject({ open: true, source: 'bookmarks' });
    expect(list).not.toHaveBeenCalled();
    useLoginModal.getState().closeLogin();
  });
  it('drops old account caches and ignores its late list response', async () => {
    useAuthStore.getState().setSession('first', user('1'));
    const oldGeneration = useAuthStore.getState().sessionGeneration;
    let finish: (value: BookmarkListResult) => void = () => {
      throw new Error('not initialized');
    };
    const list = vi
      .spyOn(bookmarksApi, 'list')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(result('Second user private item'));
    const client = mount();
    await waitFor(() => expect(list).toHaveBeenCalledOnce());
    act(() => useAuthStore.getState().setSession('second', user('2')));
    await screen.findByText('Second user private item');
    await act(async () => {
      finish(result('First user private item'));
    });
    expect(screen.queryByText('First user private item')).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ['bookmarks', '1', oldGeneration] })).toEqual([]);
    act(() => useAuthStore.getState().clear());
    expect(screen.queryByText('Second user private item')).not.toBeInTheDocument();
  });
  it('keeps the draft during same-session revalidation and closes it on a real session change', async () => {
    useAuthStore.getState().setSession('first', user('1'));
    vi.spyOn(bookmarksApi, 'list').mockResolvedValue(result('Private item'));
    mount();
    await screen.findByText('Private item');
    await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }));
    await userEvent.type(
      within(screen.getByRole('dialog')).getByLabelText('Title *'),
      'Keep this draft',
    );
    const generation = useAuthStore.getState().sessionGeneration;
    act(() => useAuthStore.getState().setSession('first', { ...user('1'), nickname: 'Refreshed' }));
    expect(useAuthStore.getState().sessionGeneration).toBe(generation);
    expect(within(screen.getByRole('dialog')).getByLabelText('Title *')).toHaveValue(
      'Keep this draft',
    );
    act(() => useAuthStore.getState().setSession('second', user('1')));
    expect(useAuthStore.getState().sessionGeneration).toBe(generation + 1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('never reuses the preceding account group metadata while the new account is loading', async () => {
    useAuthStore.getState().setSession('first', user('1'));
    const groupId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const first = {
      ...result('First private item'),
      groups: [{ id: groupId, name: 'First private group', count: 1 }],
    };
    let finish: (value: BookmarkListResult) => void = () => {
      throw new Error('not initialized');
    };
    vi.spyOn(bookmarksApi, 'list')
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const client = mount();
    await screen.findByRole('button', { name: 'Actions for group First private group' });
    act(() => useAuthStore.getState().setSession('second', user('2')));
    await screen.findByRole('status', { name: 'Loading bookmarks…' });
    expect(
      screen.queryByRole('button', { name: 'Actions for group First private group' }),
    ).not.toBeInTheDocument();
    await act(async () => {
      finish({
        ...result('Second private item'),
        groups: [{ id: groupId, name: 'Second private group', count: 1 }],
      });
    });
    await screen.findByRole('button', { name: 'Actions for group Second private group' });
    const generation = useAuthStore.getState().sessionGeneration;
    act(() => useAuthStore.getState().clear());
    expect(
      screen.queryByRole('button', { name: 'Actions for group Second private group' }),
    ).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ['bookmarks', '2', generation] })).toEqual([]);
  });
});
