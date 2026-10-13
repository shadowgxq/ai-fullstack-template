import { describe, expect, it } from 'vitest';

import {
  bookmarkFieldErrors,
  groupNameError,
  validateGroupName,
  isSafeBookmarkUrl,
  normalizeBookmarkDraft,
  parseBookmarkFilters,
  validateBookmark,
} from './bookmarks.validation';

describe('bookmark input and filters', () => {
  it('validates names by code point, trimmed reserved names and NUL without adding English aliases', () => {
    expect(validateGroupName(` ${'😀'.repeat(30)} `)).toBeNull();
    expect(validateGroupName('😀'.repeat(31))).toBe('bookmarks.errors.groupName');
    expect(validateGroupName(' 全部 ')).toBe('bookmarks.errors.reservedGroup');
    expect(validateGroupName('未分组')).toBe('bookmarks.errors.reservedGroup');
    expect(validateGroupName('All')).toBeNull();
    expect(validateGroupName('A\u0000B')).toBe('bookmarks.errors.characters');
    expect(
      groupNameError({
        __apiError: true,
        message: 'Duplicate',
        messageFromServer: true,
        code: 40910,
      }),
    ).toBe('bookmarks.errors.groupDuplicate');
    expect(
      groupNameError({
        __apiError: true,
        message: 'Validation failed',
        messageFromServer: true,
        code: 42200,
        details: [
          {
            loc: ['body', 'name'],
            type: 'value_error',
            msg: 'Value error, Text must not contain NUL characters',
          },
        ],
      }),
    ).toBe('bookmarks.errors.characters');
  });
  it('rejects NUL and maps the provider character error without changing the input', () => {
    const draft = {
      title: 'A\u0000B',
      url: 'https://example.com',
      group_id: null,
      note: 'X\u0000Y',
    };
    expect(validateBookmark(draft)).toEqual({
      title: 'bookmarks.errors.characters',
      note: 'bookmarks.errors.characters',
    });
    expect(
      bookmarkFieldErrors({
        __apiError: true,
        message: 'Validation failed',
        messageFromServer: true,
        code: 42200,
        details: [
          {
            loc: ['body', 'note'],
            type: 'value_error',
            msg: 'Value error, Text must not contain NUL characters',
          },
        ],
      }),
    ).toEqual({ note: 'bookmarks.errors.characters' });
    expect(draft.note).toBe('X\u0000Y');
  });
  it('counts Unicode code points, trims title and URL, and preserves note whitespace', () => {
    const draft = {
      title: ` ${'😀'.repeat(80)} `,
      url: ' https://example.com/?a=1#part ',
      group_id: null,
      note: '  note\n',
    };
    expect(validateBookmark(draft)).toEqual({});
    expect(normalizeBookmarkDraft(draft)).toEqual({
      ...draft,
      title: '😀'.repeat(80),
      url: 'https://example.com/?a=1#part',
    });
    expect(validateBookmark({ ...draft, title: '😀'.repeat(81), note: '😀'.repeat(501) })).toEqual({
      title: 'bookmarks.errors.title',
      note: 'bookmarks.errors.note',
    });
  });
  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'example.com',
    'https://',
    'https://example.com/\n',
    'https://example.com/a b',
  ])('rejects unsafe or incomplete URL %s', (url) => {
    expect(isSafeBookmarkUrl(url)).toBe(false);
  });
  it('does not normalize query or fragment and parses URL filters safely', () => {
    expect(isSafeBookmarkUrl('https://example.com/a?b=%25#c')).toBe(true);
    expect(
      parseBookmarkFilters(new URLSearchParams('group=ungrouped&q=%20Pay_%25%20&page=2')),
    ).toEqual({ group: 'ungrouped', q: 'Pay_%', page: 2 });
    expect(parseBookmarkFilters(new URLSearchParams('group=foreign&page=Infinity'))).toEqual({
      group: 'all',
      q: '',
      page: 1,
    });
  });
});
