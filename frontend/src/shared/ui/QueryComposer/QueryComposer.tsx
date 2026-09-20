import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
  type KeyboardEvent,
  type ReactElement,
  type RefAttributes,
} from 'react';
import { LoaderCircle, RefreshCw, Search, X } from '@/shared/icons';
import { cn } from '@/shared/utils/cn';
import type {
  QueryComposerInputElement,
  QueryComposerOptionState,
  QueryComposerProps,
} from './query-composer.types';
import { useQueryComposerSearch } from './useQueryComposerSearch';

const DEFAULT_MAX_LINES = 4;
const SUGGESTION_PANEL_MAX_HEIGHT = 448;
const SUGGESTION_PANEL_VIEWPORT_MARGIN = 12;
const SUGGESTION_PANEL_GAP = 8;
type SuggestionPanelPlacement = 'bottom' | 'top';

function getLineCount(value: string): number {
  return value.split('\n').length;
}
function limitLineCount(value: string, maxLines: number): string {
  const lines = value.split('\n');
  return lines.length > maxLines ? lines.slice(0, maxLines).join('\n') : value;
}
function wouldExceedLineLimit(input: HTMLTextAreaElement, maxLines: number): boolean {
  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? selectionStart;
  const nextValue = `${input.value.slice(0, selectionStart)}\n${input.value.slice(selectionEnd)}`;
  return getLineCount(nextValue) > maxLines;
}
function resizeTextarea(input: HTMLTextAreaElement | null, maxLines: number) {
  if (!input) return;
  const style = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(style.lineHeight) || 24;
  const verticalChrome =
    (Number.parseFloat(style.paddingTop) || 0) +
    (Number.parseFloat(style.paddingBottom) || 0) +
    (Number.parseFloat(style.borderTopWidth) || 0) +
    (Number.parseFloat(style.borderBottomWidth) || 0);
  const maxHeight = lineHeight * maxLines + verticalChrome;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
}
function setForwardedRef(
  ref: ForwardedRef<QueryComposerInputElement>,
  node: QueryComposerInputElement | null,
) {
  if (typeof ref === 'function') {
    ref(node);
    return;
  }
  if (ref) ref.current = node;
}

function QueryComposerInner<TItem>(
  props: QueryComposerProps<TItem>,
  forwardedRef: ForwardedRef<QueryComposerInputElement>,
) {
  const {
    id,
    name,
    value,
    label,
    description,
    validationMessage,
    placeholder,
    messages,
    className,
    labelClassName,
    inputClassName,
    isDisabled = false,
    isClearable = true,
    isMultiline = false,
    maxLines = DEFAULT_MAX_LINES,
    isSubmitOnEnter = true,
    isShiftEnterNewline = true,
    maxLength,
    autoFocus,
    onValueChange,
    onClear,
  } = props;
  const generatedId = useId();
  const inputId = id ?? `query-composer-${generatedId}`;
  const panelId = `${inputId}-panel`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const validationId = validationMessage ? `${inputId}-validation` : undefined;
  const describedBy = [descriptionId, validationId].filter(Boolean).join(' ') || undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<QueryComposerInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelPlacement, setPanelPlacement] = useState<SuggestionPanelPlacement>('bottom');
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);
  const [queryRevision, setQueryRevision] = useState(0);
  const normalizedQuery = value.trim();
  const remoteProps = props.mode === 'natural_language_only' ? undefined : props;
  const searchState = useQueryComposerSearch(
    value,
    remoteProps?.remoteSearch,
    isDisabled || props.mode === 'natural_language_only',
    queryRevision,
  );
  const items = searchState.items;
  const isFreeformVisible =
    props.mode === 'hybrid' &&
    Boolean(normalizedQuery) &&
    searchState.isEligible &&
    items.length === 0 &&
    searchState.status !== 'loading';
  const entryCount = items.length + (isFreeformVisible ? 1 : 0);
  const canShowRemotePanel =
    props.mode !== 'natural_language_only' &&
    Boolean(normalizedQuery) &&
    searchState.isEligible &&
    (props.mode === 'hybrid' || searchState.status !== 'idle');
  const isPanelVisible = isOpen && canShowRemotePanel;
  const activeDescendant =
    isPanelVisible && activeIndex >= 0
      ? activeIndex < items.length
        ? `${panelId}-option-${activeIndex}`
        : `${panelId}-freeform`
      : undefined;

  useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);
  useLayoutEffect(() => {
    if (!isMultiline || !(inputRef.current instanceof HTMLTextAreaElement)) return;
    resizeTextarea(inputRef.current, maxLines);
  }, [isMultiline, maxLines, value]);
  useLayoutEffect(() => {
    if (!isPanelVisible || !inputRef.current) {
      setPanelPlacement('bottom');
      setPanelMaxHeight(null);
      return undefined;
    }
    function updatePanelLayout() {
      const input = inputRef.current;
      if (!input) return;
      const inputRect = input.getBoundingClientRect();
      const spaceAbove = Math.max(
        0,
        inputRect.top - SUGGESTION_PANEL_VIEWPORT_MARGIN - SUGGESTION_PANEL_GAP,
      );
      const spaceBelow = Math.max(
        0,
        window.innerHeight -
          inputRect.bottom -
          SUGGESTION_PANEL_VIEWPORT_MARGIN -
          SUGGESTION_PANEL_GAP,
      );
      const shouldPlaceAbove = spaceBelow < SUGGESTION_PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;
      const availableHeight = shouldPlaceAbove ? spaceAbove : spaceBelow;
      setPanelPlacement(shouldPlaceAbove ? 'top' : 'bottom');
      setPanelMaxHeight(Math.max(1, Math.min(SUGGESTION_PANEL_MAX_HEIGHT, availableHeight)));
    }
    updatePanelLayout();
    window.addEventListener('resize', updatePanelLayout);
    window.addEventListener('scroll', updatePanelLayout, true);
    window.visualViewport?.addEventListener('resize', updatePanelLayout);
    window.visualViewport?.addEventListener('scroll', updatePanelLayout);
    return () => {
      window.removeEventListener('resize', updatePanelLayout);
      window.removeEventListener('scroll', updatePanelLayout, true);
      window.visualViewport?.removeEventListener('resize', updatePanelLayout);
      window.visualViewport?.removeEventListener('scroll', updatePanelLayout);
    };
  }, [isPanelVisible]);
  useEffect(() => {
    if (!isPanelVisible || activeIndex < 0) return;
    const activeOption = panelRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (typeof activeOption?.scrollIntoView === 'function')
      activeOption.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isPanelVisible]);
  useEffect(() => {
    if (!isMultiline || !(inputRef.current instanceof HTMLTextAreaElement)) return undefined;
    const input = inputRef.current;
    const handleWidthChange = () => resizeTextarea(input, maxLines);
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', handleWidthChange);
      return () => window.removeEventListener('resize', handleWidthChange);
    }
    const observer = new ResizeObserver(handleWidthChange);
    observer.observe(input);
    return () => observer.disconnect();
  }, [isMultiline, maxLines]);

  function isEntryDisabled(index: number) {
    if (index === items.length) return !isFreeformVisible;
    const item = items[index];
    return item !== undefined ? Boolean(remoteProps?.isItemDisabled?.(item)) : true;
  }
  function findNextEnabledIndex(startIndex: number, direction: 1 | -1) {
    if (entryCount === 0) return -1;
    for (let offset = 1; offset <= entryCount; offset += 1) {
      const index = (startIndex + direction * offset + entryCount) % entryCount;
      if (!isEntryDisabled(index)) return index;
    }
    return -1;
  }
  function commitItem(item: TItem) {
    remoteProps?.onCommitItem(item);
    setIsOpen(false);
    setActiveIndex(-1);
  }
  function commitQuery() {
    if (!normalizedQuery || props.mode === 'remote_only') return;
    props.onCommitQuery(normalizedQuery);
    setIsOpen(false);
    setActiveIndex(-1);
  }
  function commitActiveEntry() {
    if (activeIndex < 0 || isEntryDisabled(activeIndex)) return false;
    const item = items[activeIndex];
    if (item !== undefined) commitItem(item);
    else commitQuery();
    return true;
  }
  function handleKeyDown(event: KeyboardEvent<QueryComposerInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (props.mode === 'natural_language_only' || entryCount === 0) return;
      event.preventDefault();
      setIsOpen(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((currentIndex) =>
        findNextEnabledIndex(
          currentIndex < 0 ? (direction === 1 ? -1 : 0) : currentIndex,
          direction,
        ),
      );
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (isPanelVisible) {
        setIsOpen(false);
        setActiveIndex(-1);
      } else inputRef.current?.blur();
      return;
    }
    if (event.key !== 'Enter') return;
    if (isMultiline && (!isSubmitOnEnter || (event.shiftKey && isShiftEnterNewline))) {
      if (
        event.currentTarget instanceof HTMLTextAreaElement &&
        wouldExceedLineLimit(event.currentTarget, maxLines)
      )
        event.preventDefault();
      return;
    }
    if (!isSubmitOnEnter) return;
    event.preventDefault();
    if (!normalizedQuery || searchState.status === 'loading') return;
    if (commitActiveEntry()) return;
    if (props.mode !== 'natural_language_only' && searchState.isEligible) {
      const enabledItems = items.filter((item) => !remoteProps?.isItemDisabled?.(item));
      if (enabledItems.length === 1) {
        commitItem(enabledItems[0]);
        return;
      }
      if (enabledItems.length > 1 || props.mode === 'remote_only') {
        setIsOpen(true);
        return;
      }
    }
    commitQuery();
  }
  const commonInputProps = {
    id: inputId,
    name,
    value,
    placeholder,
    maxLength,
    autoFocus,
    disabled: isDisabled,
    autoComplete: 'off',
    'aria-invalid': Boolean(validationMessage),
    'aria-describedby': describedBy,
    onFocus: () => setIsOpen(true),
    onChange: (event: React.ChangeEvent<QueryComposerInputElement>) => {
      const nextValue =
        isMultiline && event.target instanceof HTMLTextAreaElement
          ? limitLineCount(event.target.value, maxLines)
          : event.target.value;
      setQueryRevision((currentRevision) => currentRevision + 1);
      onValueChange(nextValue);
      setIsOpen(true);
      setActiveIndex(-1);
    },
    onKeyDown: handleKeyDown,
  } as const;
  const comboboxProps = {
    role: props.mode === 'natural_language_only' ? undefined : 'combobox',
    'aria-autocomplete': props.mode === 'natural_language_only' ? undefined : 'list',
    'aria-expanded': props.mode === 'natural_language_only' ? undefined : isPanelVisible,
    'aria-controls': isPanelVisible ? panelId : undefined,
    'aria-activedescendant': activeDescendant,
  } as const;
  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <label
        htmlFor={inputId}
        className={cn('text-foreground mb-2 block text-base font-semibold', labelClassName)}
      >
        {label}
      </label>
      {description ? (
        <div id={descriptionId} className="text-muted-foreground mb-2 text-sm">
          {description}
        </div>
      ) : null}
      <div className="relative">
        <Search
          className={cn(
            'text-muted-foreground pointer-events-none absolute left-4 z-10',
            isMultiline ? 'top-[19px]' : 'top-1/2 -translate-y-1/2',
          )}
          size={20}
          aria-hidden="true"
        />
        {isMultiline ? (
          <textarea
            {...commonInputProps}
            {...comboboxProps}
            ref={(node) => {
              inputRef.current = node;
              setForwardedRef(forwardedRef, node);
            }}
            rows={1}
            wrap="soft"
            className={cn(
              'border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring min-h-14 w-full resize-none rounded-xl border py-4 pr-14 pl-12 text-base leading-6 outline-none transition-[height,border-color,box-shadow] focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
              inputClassName,
            )}
          />
        ) : (
          <input
            {...commonInputProps}
            {...comboboxProps}
            ref={(node) => {
              inputRef.current = node;
              setForwardedRef(forwardedRef, node);
            }}
            type="text"
            className={cn(
              'border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring min-h-14 w-full rounded-xl border py-3 pr-14 pl-12 text-base outline-none transition-[border-color,box-shadow] focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
              inputClassName,
            )}
          />
        )}
        {isClearable && value ? (
          <button
            type="button"
            className={cn(
              'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring absolute right-1.5 z-10 inline-grid size-11 place-items-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none',
              isMultiline ? 'top-1.5' : 'top-1/2 -translate-y-1/2',
            )}
            disabled={isDisabled}
            aria-label={messages.clearInput}
            onClick={() => {
              setQueryRevision((currentRevision) => currentRevision + 1);
              onValueChange('');
              onClear?.();
              setIsOpen(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
        {isPanelVisible ? (
          <div
            ref={panelRef}
            id={panelId}
            className={cn(
              'border-border bg-popover text-popover-foreground absolute right-0 left-0 z-50 max-h-[28rem] overflow-y-auto overscroll-contain rounded-xl border p-2 shadow-lg',
              panelPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            )}
            style={{ maxHeight: panelMaxHeight === null ? undefined : `${panelMaxHeight}px` }}
          >
            {searchState.status === 'loading' ? (
              <div
                className="text-muted-foreground flex min-h-12 items-center gap-2 px-3 py-2 text-sm"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                {messages.searching}
              </div>
            ) : null}
            {searchState.status === 'error' ? (
              <div
                className="text-muted-foreground flex min-h-12 flex-wrap items-center gap-2 px-3 py-2 text-sm"
                role="status"
                aria-live="polite"
              >
                <span className="min-w-0 flex-1">{messages.searchError}</span>
                <button
                  type="button"
                  className="text-primary hover:bg-accent focus-visible:ring-ring inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-medium focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => {
                    setActiveIndex(-1);
                    searchState.retry();
                  }}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {messages.retry}
                </button>
              </div>
            ) : null}
            {searchState.status === 'empty' ? (
              <div
                className="text-muted-foreground min-h-11 px-3 py-2 text-sm"
                role="status"
                aria-live="polite"
              >
                {messages.empty}
              </div>
            ) : null}
            {entryCount > 0 ? (
              <ul
                className="m-0 list-none p-0"
                role="listbox"
                aria-label={messages.suggestionsLabel}
              >
                {items.map((item, index) => {
                  if (!remoteProps) return null;
                  const isItemDisabled = Boolean(remoteProps.isItemDisabled?.(item));
                  const state: QueryComposerOptionState = {
                    isActive: activeIndex === index,
                    isDisabled: isItemDisabled,
                  };
                  return (
                    <li key={remoteProps.getItemKey(item)} role="presentation">
                      <button
                        id={`${panelId}-option-${index}`}
                        type="button"
                        className="hover:bg-accent focus-visible:bg-accent data-[active=true]:bg-accent focus-visible:ring-ring flex min-h-12 w-full items-center rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                        role="option"
                        aria-selected={activeIndex === index}
                        aria-disabled={isItemDisabled}
                        data-active={activeIndex === index}
                        disabled={isItemDisabled}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => commitItem(item)}
                      >
                        {remoteProps.renderItem(item, state)}
                      </button>
                    </li>
                  );
                })}
                {isFreeformVisible && props.mode === 'hybrid' ? (
                  <li
                    role="presentation"
                    className={items.length > 0 ? 'border-border mt-1 border-t pt-1' : undefined}
                  >
                    <button
                      id={`${panelId}-freeform`}
                      type="button"
                      className="hover:bg-accent focus-visible:bg-accent data-[active=true]:bg-accent focus-visible:ring-ring flex min-h-12 w-full items-center rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2"
                      role="option"
                      aria-selected={activeIndex === items.length}
                      data-active={activeIndex === items.length}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(items.length)}
                      onClick={commitQuery}
                    >
                      {props.renderFreeform(normalizedQuery, {
                        isActive: activeIndex === items.length,
                        isDisabled: false,
                      })}
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      {validationMessage ? (
        <div id={validationId} className="text-destructive mt-2 text-sm" role="alert">
          {validationMessage}
        </div>
      ) : null}
    </div>
  );
}
export const QueryComposer = forwardRef(QueryComposerInner) as <TItem = never>(
  props: QueryComposerProps<TItem> & RefAttributes<QueryComposerInputElement>,
) => ReactElement;
