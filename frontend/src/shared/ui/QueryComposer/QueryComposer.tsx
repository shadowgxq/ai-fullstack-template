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

import { LoaderCircle, RefreshCw, Search, SearchX, X } from '@/shared/icons';
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
  const borderHeight =
    (Number.parseFloat(style.borderTopWidth) || 0) +
    (Number.parseFloat(style.borderBottomWidth) || 0);
  const verticalChrome =
    (Number.parseFloat(style.paddingTop) || 0) +
    (Number.parseFloat(style.paddingBottom) || 0) +
    borderHeight;
  const maxHeight = lineHeight * maxLines + verticalChrome;

  input.style.height = 'auto';
  // scrollHeight includes padding, but the border-box height also needs both borders.
  const contentHeight = input.scrollHeight + borderHeight;
  input.style.height = `${Math.min(contentHeight, maxHeight)}px`;
  input.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
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
      const style = window.getComputedStyle(input);
      // Read the design-derived runtime values; defaults keep placement usable before styles load.
      const maxPanelHeight =
        Number.parseFloat(style.getPropertyValue('--query-composer-panel-max-height')) ||
        SUGGESTION_PANEL_MAX_HEIGHT;
      const viewportMargin =
        Number.parseFloat(style.getPropertyValue('--space-3')) || SUGGESTION_PANEL_VIEWPORT_MARGIN;
      const panelGap =
        Number.parseFloat(style.getPropertyValue('--space-2')) || SUGGESTION_PANEL_GAP;
      const spaceAbove = Math.max(0, inputRect.top - viewportMargin - panelGap);
      const spaceBelow = Math.max(
        0,
        window.innerHeight - inputRect.bottom - viewportMargin - panelGap,
      );
      const shouldPlaceAbove = spaceBelow < maxPanelHeight && spaceAbove > spaceBelow;
      const availableHeight = shouldPlaceAbove ? spaceAbove : spaceBelow;

      setPanelPlacement(shouldPlaceAbove ? 'top' : 'bottom');
      setPanelMaxHeight(Math.max(1, Math.min(maxPanelHeight, availableHeight)));
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
    if (typeof activeOption?.scrollIntoView === 'function') {
      activeOption.scrollIntoView({ block: 'nearest' });
    }
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
    return item ? Boolean(remoteProps?.isItemDisabled?.(item)) : true;
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
    if (item) commitItem(item);
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
      } else {
        inputRef.current?.blur();
      }
      return;
    }

    if (event.key !== 'Enter') return;
    if (isMultiline && (!isSubmitOnEnter || (event.shiftKey && isShiftEnterNewline))) {
      if (
        event.currentTarget instanceof HTMLTextAreaElement &&
        wouldExceedLineLimit(event.currentTarget, maxLines)
      ) {
        event.preventDefault();
      }
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

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <label
        htmlFor={inputId}
        className={cn(
          'text-foreground mb-[var(--space-2)] block text-[length:var(--font-size-md)] leading-[var(--label-leading)] font-medium',
          labelClassName,
        )}
      >
        {label}
      </label>
      {description ? (
        <div
          id={descriptionId}
          className="text-muted-foreground mb-[var(--space-2)] text-[length:var(--font-size-md)] leading-[var(--body-leading)]"
        >
          {description}
        </div>
      ) : null}

      <div className="relative">
        <Search
          className={cn(
            'text-muted-foreground pointer-events-none absolute left-[var(--space-4)] z-10 size-[var(--icon-size-lg)]',
            isMultiline ? 'top-[var(--space-3)]' : 'top-1/2 -translate-y-1/2',
          )}
          aria-hidden="true"
        />
        {isMultiline ? (
          <textarea
            {...commonInputProps}
            ref={(node) => {
              inputRef.current = node;
              setForwardedRef(forwardedRef, node);
            }}
            rows={1}
            wrap="soft"
            role={props.mode === 'natural_language_only' ? undefined : 'combobox'}
            aria-autocomplete={props.mode === 'natural_language_only' ? undefined : 'list'}
            aria-expanded={props.mode === 'natural_language_only' ? undefined : isPanelVisible}
            aria-controls={isPanelVisible ? panelId : undefined}
            aria-activedescendant={activeDescendant}
            className={cn(
              'border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[length:var(--focus-ring-width)] aria-invalid:border-[var(--control-invalid-border)] aria-invalid:focus-visible:ring-[var(--control-invalid-border)] block min-h-[var(--query-composer-min-height)] w-full rounded-[var(--radius-surface)] border-[length:var(--control-border-width)] pl-[calc(var(--space-4)+var(--icon-size-lg)+var(--space-3)-var(--control-border-width))] text-[length:var(--font-size-lg)] leading-[var(--large-text-leading)] outline-none duration-[var(--duration-fast)] ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] motion-reduce:transition-none resize-none py-[calc(var(--space-3)-var(--control-border-width))] transition-[height,border-color,box-shadow]',
              isClearable
                ? 'pr-[calc(var(--control-hit-size)+var(--space-3)/2+var(--space-3)-var(--control-border-width))]'
                : 'pr-[calc(var(--space-3)/2-var(--control-border-width))]',
              inputClassName,
            )}
          />
        ) : (
          <input
            {...commonInputProps}
            ref={(node) => {
              inputRef.current = node;
              setForwardedRef(forwardedRef, node);
            }}
            type="text"
            role={props.mode === 'natural_language_only' ? undefined : 'combobox'}
            aria-autocomplete={props.mode === 'natural_language_only' ? undefined : 'list'}
            aria-expanded={props.mode === 'natural_language_only' ? undefined : isPanelVisible}
            aria-controls={isPanelVisible ? panelId : undefined}
            aria-activedescendant={activeDescendant}
            className={cn(
              'border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[length:var(--focus-ring-width)] aria-invalid:border-[var(--control-invalid-border)] aria-invalid:focus-visible:ring-[var(--control-invalid-border)] block min-h-[var(--query-composer-min-height)] w-full rounded-[var(--radius-surface)] border-[length:var(--control-border-width)] pl-[calc(var(--space-4)+var(--icon-size-lg)+var(--space-3)-var(--control-border-width))] text-[length:var(--font-size-lg)] leading-[var(--large-text-leading)] outline-none duration-[var(--duration-fast)] ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] motion-reduce:transition-none py-[calc(var(--space-3)-var(--control-border-width))] transition-[border-color,box-shadow]',
              isClearable
                ? 'pr-[calc(var(--control-hit-size)+var(--space-3)/2+var(--space-3)-var(--control-border-width))]'
                : 'pr-[calc(var(--space-3)/2-var(--control-border-width))]',
              inputClassName,
            )}
          />
        )}
        {isClearable && value ? (
          <button
            type="button"
            className={cn(
              'text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:ring-ring absolute right-[calc(var(--space-3)/2)] z-10 inline-grid size-[var(--control-hit-size)] place-items-center rounded-[var(--radius-control)] transition-colors duration-[var(--duration-fast)] focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] motion-reduce:transition-none',
              isMultiline
                ? 'top-[min(var(--space-3),calc((100%-var(--control-hit-size))/2))]'
                : 'top-1/2 -translate-y-1/2',
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
            <X className="size-[var(--icon-size-md)]" aria-hidden="true" />
          </button>
        ) : null}

        {isPanelVisible ? (
          <div
            ref={panelRef}
            id={panelId}
            className={cn(
              'border-border bg-popover text-popover-foreground absolute right-0 left-0 z-50 max-h-[var(--query-composer-panel-max-height)] overflow-y-auto overscroll-contain rounded-[var(--radius-surface)] border-[length:var(--control-border-width)] p-[calc(var(--space-1)-var(--control-border-width))] text-[length:var(--font-size-md)] leading-[var(--control-leading)] shadow-[var(--query-composer-shadow)]',
              panelPlacement === 'top'
                ? 'bottom-full mb-[var(--space-2)]'
                : 'top-full mt-[var(--space-2)]',
            )}
            style={{
              maxHeight: panelMaxHeight === null ? undefined : `${panelMaxHeight}px`,
            }}
          >
            {searchState.status === 'loading' ? (
              <div
                className="text-muted-foreground flex min-h-[var(--query-composer-min-height)] items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)]"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle
                  className="size-[var(--icon-size-md)] animate-spin"
                  aria-hidden="true"
                />
                {messages.searching}
              </div>
            ) : null}

            {searchState.status === 'error' ? (
              <div
                className="text-destructive flex min-h-[var(--query-composer-min-height)] flex-wrap items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)]"
                role="status"
                aria-live="polite"
              >
                <span className="min-w-0 flex-1">{messages.searchError}</span>
                <button
                  type="button"
                  className="text-primary hover:bg-surface-hover focus-visible:ring-ring inline-flex min-h-[var(--control-height-md)] items-center gap-[var(--space-1)] rounded-[var(--radius-control)] px-[var(--space-2)] font-medium focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:outline-none"
                  onClick={() => {
                    setActiveIndex(-1);
                    searchState.retry();
                  }}
                >
                  <RefreshCw className="size-[var(--icon-size-sm)]" aria-hidden="true" />
                  {messages.retry}
                </button>
              </div>
            ) : null}

            {searchState.status === 'empty' ? (
              <div
                className={cn(
                  'text-muted-foreground px-[var(--space-3)] py-[var(--space-2)]',
                  isFreeformVisible
                    ? 'text-[length:var(--font-size-xs)] leading-[var(--caption-leading)]'
                    : 'flex min-h-[var(--query-composer-min-height)] items-center gap-[var(--space-2)]',
                )}
                role="status"
                aria-live="polite"
              >
                {!isFreeformVisible ? (
                  <SearchX className="size-[var(--icon-size-md)] shrink-0" aria-hidden="true" />
                ) : null}
                {messages.empty}
              </div>
            ) : null}

            {entryCount > 0 ? (
              <ul
                className={cn(
                  'm-0 grid list-none gap-[var(--space-1)] p-0',
                  searchState.status === 'empty' && isFreeformVisible && 'mt-[var(--space-2)]',
                )}
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
                        className="hover:bg-surface-hover focus-visible:bg-surface-hover data-[active=true]:bg-surface-selected focus-visible:ring-ring flex min-h-[var(--control-height-2xl)] w-full items-center gap-[var(--space-3)] rounded-[var(--radius-control)] p-[var(--space-3)] text-left [overflow-wrap:anywhere] outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-[length:var(--focus-ring-width)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-[calc(var(--disabled-opacity-percent)/100)]"
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
                    className={
                      items.length > 0
                        ? 'border-border mt-[var(--space-1)] border-t-[length:var(--control-border-width)] pt-[var(--space-1)]'
                        : undefined
                    }
                  >
                    <button
                      id={`${panelId}-freeform`}
                      type="button"
                      className="hover:bg-surface-hover focus-visible:bg-surface-hover data-[active=true]:bg-surface-selected focus-visible:ring-ring flex min-h-[var(--control-height-2xl)] w-full items-center rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] text-left [overflow-wrap:anywhere] outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-[length:var(--focus-ring-width)] motion-reduce:transition-none"
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
        <div
          id={validationId}
          className="text-destructive mt-[var(--space-2)] text-[length:var(--font-size-md)] leading-[var(--body-leading)]"
          role="alert"
        >
          {validationMessage}
        </div>
      ) : null}
    </div>
  );
}

export const QueryComposer = forwardRef(QueryComposerInner) as <TItem = never>(
  props: QueryComposerProps<TItem> & RefAttributes<QueryComposerInputElement>,
) => ReactElement;
