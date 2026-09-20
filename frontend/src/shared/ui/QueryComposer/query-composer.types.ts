import type { ReactNode } from 'react';

export const QUERY_COMPOSER_MODES = ['remote_only', 'natural_language_only', 'hybrid'] as const;
export type QueryComposerMode = (typeof QUERY_COMPOSER_MODES)[number];
export type QueryComposerInputElement = HTMLInputElement | HTMLTextAreaElement;
export type QueryComposerSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
export type QueryComposerSearchContext = Readonly<{ signal: AbortSignal }>;
export type QueryComposerRemoteSearch<TItem> = Readonly<{
  search: (
    query: string,
    context: QueryComposerSearchContext,
  ) => PromiseLike<readonly TItem[]> | readonly TItem[];
  minChars?: number;
  debounceMs?: number;
  maxResults?: number;
  shouldSearch?: (query: string) => boolean;
  onError?: (error: unknown, query: string) => void;
}>;
export type QueryComposerOptionState = Readonly<{ isActive: boolean; isDisabled: boolean }>;
export type QueryComposerMessages = Readonly<{
  clearInput: string;
  suggestionsLabel: string;
  searching: string;
  empty: string;
  searchError: string;
  retry: string;
}>;
type QueryComposerBaseProps = Readonly<{
  id?: string;
  name?: string;
  value: string;
  label: ReactNode;
  description?: ReactNode;
  validationMessage?: ReactNode;
  placeholder?: string;
  messages: QueryComposerMessages;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  isMultiline?: boolean;
  maxLines?: 3 | 4 | 5;
  isSubmitOnEnter?: boolean;
  isShiftEnterNewline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  onValueChange: (value: string) => void;
  onClear?: () => void;
}>;
type QueryComposerRemoteProps<TItem> = Readonly<{
  remoteSearch: QueryComposerRemoteSearch<TItem>;
  getItemKey: (item: TItem) => string;
  renderItem: (item: TItem, state: QueryComposerOptionState) => ReactNode;
  onCommitItem: (item: TItem) => void;
  isItemDisabled?: (item: TItem) => boolean;
}>;
export type QueryComposerProps<TItem = never> = QueryComposerBaseProps &
  (
    | ({
        mode: 'remote_only';
        onCommitQuery?: never;
        renderFreeform?: never;
      } & QueryComposerRemoteProps<TItem>)
    | {
        mode: 'natural_language_only';
        remoteSearch?: never;
        getItemKey?: never;
        renderItem?: never;
        onCommitItem?: never;
        isItemDisabled?: never;
        renderFreeform?: never;
        onCommitQuery: (query: string) => void;
      }
    | ({
        mode: 'hybrid';
        onCommitQuery: (query: string) => void;
        renderFreeform: (query: string, state: QueryComposerOptionState) => ReactNode;
      } & QueryComposerRemoteProps<TItem>)
  );
