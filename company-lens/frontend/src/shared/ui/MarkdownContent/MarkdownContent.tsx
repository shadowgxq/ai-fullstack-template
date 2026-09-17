import * as Tooltip from '@radix-ui/react-tooltip';
import clsx from 'clsx';
import { ChevronDown, ListTree } from 'lucide-react';
import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { useTranslation } from 'react-i18next';
import remarkGfm from 'remark-gfm';

import styles from './MarkdownContent.module.css';

export type MarkdownContentProps = {
  content: string;
  className?: string;
  anchorPrefix?: string;
  outlineLayout?: MarkdownOutlineLayout;
  outlineVariant?: MarkdownOutlineVariant;
  outlineLinks?: readonly MarkdownOutlineLink[];
};

export type MarkdownOutlineLayout = 'disclosure' | 'rail';
export type MarkdownOutlineVariant = 'default' | 'agent-report';

export type MarkdownOutlineLink = {
  id: string;
  label: string;
};

type MarkdownHeading = {
  depth: number;
  id: string;
  label: string;
  line: number;
};

type MarkdownHeadingTreeItem = MarkdownHeading & {
  children: MarkdownHeadingTreeItem[];
};

type MarkdownHeadingNode = {
  position?: {
    start?: {
      line?: number;
    };
  };
};

type MarkdownHeadingProps = ComponentProps<'h1'> & {
  node?: unknown;
};

const REMARK_PLUGINS = [remarkGfm];
const EXTERNAL_URL_PATTERN = /^(?:https?:)?\/\//i;
const EMBEDDED_MARKDOWN_OPENING = /^ {0,3}```(?:markdown|md)\s*$/i;
const FENCE_LINE = /^ {0,3}```[^`]*$/;
const MARKDOWN_HEADING = /^ {0,3}#{1,6}\s+/;
const MARKDOWN_FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?)\s*|)$/;
const SETEXT_HEADING = /^ {0,3}(=+|-+)[ \t]*$/;
const MOBILE_HEADER_MEDIA_QUERY = '(max-width: 720px)';
const DESKTOP_HEADING_OFFSET = 84;
const MOBILE_HEADING_OFFSET = 76;
const OUTLINE_LEVELS_WITH_DETAILS = 2;
const OUTLINE_SECOND_LEVEL_MAX_ROOTS = 5;

function unwrapEmbeddedMarkdown(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const isEmbeddedOpening =
      EMBEDDED_MARKDOWN_OPENING.test(lines[index] ?? '') &&
      MARKDOWN_HEADING.test(lines[index - 1] ?? '');

    if (!isEmbeddedOpening) {
      output.push(lines[index] ?? '');
      index += 1;
      continue;
    }

    const nextMarkdownOpening = lines.findIndex(
      (line, lineIndex) => lineIndex > index && EMBEDDED_MARKDOWN_OPENING.test(line),
    );
    let closingIndex = -1;
    for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
      if (!FENCE_LINE.test(lines[candidate] ?? '')) {
        continue;
      }

      if (nextMarkdownOpening === -1 || candidate < nextMarkdownOpening) {
        closingIndex = candidate;
      }
      if (nextMarkdownOpening !== -1 && candidate >= nextMarkdownOpening) {
        break;
      }
    }

    if (closingIndex === -1) {
      output.push(lines[index] ?? '');
      index += 1;
      continue;
    }

    const embeddedLines = lines.slice(index + 1, closingIndex);
    const isReport = embeddedLines.some((line) => /^ {0,3}#{2,6}\s+/.test(line));
    if (!isReport) {
      output.push(...lines.slice(index, closingIndex + 1));
      index = closingIndex + 1;
      continue;
    }

    output.push(...embeddedLines);
    index = closingIndex + 1;
  }

  return output.join('\n');
}

function hashText(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\\([\\`*_{}[\]()#+.!>~-])/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function createHeadingId(label: string, namespace: string, index: number): string {
  return `${namespace}-${slugify(label) || `section-${index + 1}`}`;
}

function collectMarkdownHeadings(markdown: string, anchorPrefix?: string): MarkdownHeading[] {
  const lines = markdown.split('\n');
  const namespace = slugify(anchorPrefix?.trim() || `markdown-${hashText(markdown)}`);
  const headings: MarkdownHeading[] = [];
  const usedIds = new Map<string, number>();
  let fenceMarker: string | undefined;

  const addHeading = (depth: number, value: string, line: number) => {
    const label = stripInlineMarkdown(value.replace(/[ \t]+#+[ \t]*$/, ''));
    if (!label) {
      return;
    }

    const baseId = createHeadingId(label, namespace, headings.length);
    const occurrence = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, occurrence);
    headings.push({
      depth,
      id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
      label,
      line,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fence = line.match(MARKDOWN_FENCE);

    if (fenceMarker) {
      if (
        fence &&
        fence[1]?.[0] === fenceMarker[0] &&
        (fence[1]?.length ?? 0) >= fenceMarker.length
      ) {
        fenceMarker = undefined;
      }
      continue;
    }

    if (fence) {
      fenceMarker = fence[1];
      continue;
    }

    const atxHeading = line.match(ATX_HEADING);
    if (atxHeading) {
      addHeading(atxHeading[1]?.length ?? 1, atxHeading[2] ?? '', index + 1);
      continue;
    }

    const setextHeading = lines[index + 1]?.match(SETEXT_HEADING);
    if (line.trim() && setextHeading) {
      addHeading(setextHeading[1]?.[0] === '=' ? 1 : 2, line, index + 1);
      index += 1;
    }
  }

  return headings;
}

function buildHeadingTree(headings: readonly MarkdownHeading[]): MarkdownHeadingTreeItem[] {
  const roots: MarkdownHeadingTreeItem[] = [];
  const stack: MarkdownHeadingTreeItem[] = [];

  for (const heading of headings) {
    const item: MarkdownHeadingTreeItem = { ...heading, children: [] };
    while (stack.at(-1) && (stack.at(-1)?.depth ?? 0) >= item.depth) {
      stack.pop();
    }

    const parent = stack.at(-1);
    if (parent) {
      parent.children.push(item);
    } else {
      roots.push(item);
    }
    stack.push(item);
  }

  return roots;
}

function limitHeadingTreeDepth(
  items: readonly MarkdownHeadingTreeItem[],
  remainingLevels: number,
): MarkdownHeadingTreeItem[] {
  if (remainingLevels <= 0) {
    return [];
  }

  return items.map((item) => ({
    ...item,
    children: limitHeadingTreeDepth(item.children, remainingLevels - 1),
  }));
}

function resolveActiveOutlineHeadingId(
  headings: readonly MarkdownHeading[],
  tree: readonly MarkdownHeadingTreeItem[],
  activeHeadingId: string | undefined,
): string | undefined {
  const visibleIds = new Set<string>();
  const collectVisibleIds = (items: readonly MarkdownHeadingTreeItem[]) => {
    items.forEach((item) => {
      visibleIds.add(item.id);
      collectVisibleIds(item.children);
    });
  };
  collectVisibleIds(tree);

  if (activeHeadingId && visibleIds.has(activeHeadingId)) {
    return activeHeadingId;
  }

  const activeIndex = headings.findIndex((heading) => heading.id === activeHeadingId);
  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    const headingId = headings[index]?.id;
    if (headingId && visibleIds.has(headingId)) {
      return headingId;
    }
  }

  return tree[0]?.id;
}

function getHeadingLine(node: unknown): number | undefined {
  if (!node || typeof node !== 'object' || !('position' in node)) {
    return undefined;
  }

  const position = (node as MarkdownHeadingNode).position;
  return position?.start?.line;
}

function createHeadingRenderer(
  tagName: `h${1 | 2 | 3 | 4 | 5 | 6}`,
  headingByLine: ReadonlyMap<number, MarkdownHeading>,
) {
  return function MarkdownHeading({ node, children, ...props }: MarkdownHeadingProps) {
    const heading = headingByLine.get(getHeadingLine(node) ?? -1);
    const Heading = tagName;

    return (
      <Heading {...props} id={heading?.id} tabIndex={-1} data-markdown-heading={heading?.id}>
        {children}
      </Heading>
    );
  };
}

function createMarkdownComponents(headings: readonly MarkdownHeading[]): Components {
  const headingByLine = new Map(headings.map((heading) => [heading.line, heading]));

  return {
    h1: createHeadingRenderer('h1', headingByLine),
    h2: createHeadingRenderer('h2', headingByLine),
    h3: createHeadingRenderer('h3', headingByLine),
    h4: createHeadingRenderer('h4', headingByLine),
    h5: createHeadingRenderer('h5', headingByLine),
    h6: createHeadingRenderer('h6', headingByLine),
    a({ node, href, ...props }) {
      void node;
      const isExternal = href ? EXTERNAL_URL_PATTERN.test(href) : false;

      return (
        <a
          {...props}
          href={href}
          {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
        />
      );
    },
    table({ node, ...props }) {
      void node;
      return (
        <div className={styles.tableViewport}>
          <table {...props} />
        </div>
      );
    },
  };
}

function findActiveBranchIds(
  items: readonly MarkdownHeadingTreeItem[],
  activeHeadingId: string | undefined,
): ReadonlySet<string> {
  const branchIds = new Set<string>();

  function visit(item: MarkdownHeadingTreeItem): boolean {
    const containsActiveHeading =
      item.id === activeHeadingId || item.children.some((child) => visit(child));
    if (containsActiveHeading) {
      branchIds.add(item.id);
    }
    return containsActiveHeading;
  }

  items.forEach(visit);
  return branchIds;
}

function getHashTarget(): string | undefined {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    return undefined;
  }

  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function scrollToHeading(target: HTMLElement) {
  target.scrollIntoView({ behavior: 'auto', block: 'start' });
  target.focus({ preventScroll: true });
}

function getHeadingObserverOffset(): number {
  return window.matchMedia(MOBILE_HEADER_MEDIA_QUERY).matches
    ? MOBILE_HEADING_OFFSET
    : DESKTOP_HEADING_OFFSET;
}

function useActiveHeading(
  rootRef: RefObject<HTMLDivElement>,
  headings: readonly MarkdownHeading[],
): string | undefined {
  const [observedHeadingId, setObservedHeadingId] = useState<string>();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || headings.length === 0) {
      return;
    }

    const focusHashTarget = () => {
      const targetId = getHashTarget();
      if (!targetId || !headings.some((heading) => heading.id === targetId)) {
        return;
      }

      const target = document.getElementById(targetId);
      if (!target || !root.contains(target)) {
        return;
      }

      setObservedHeadingId(targetId);
      window.requestAnimationFrame(() => scrollToHeading(target));
    };

    focusHashTarget();
    window.addEventListener('hashchange', focusHashTarget);

    if (!('IntersectionObserver' in window)) {
      return () => window.removeEventListener('hashchange', focusHashTarget);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeadings = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);
        const nextActiveHeading = visibleHeadings[0]?.target.getAttribute('data-markdown-heading');
        if (nextActiveHeading) {
          setObservedHeadingId(nextActiveHeading);
        }
      },
      { rootMargin: `-${getHeadingObserverOffset()}px 0px -60% 0px`, threshold: 0 },
    );

    root.querySelectorAll<HTMLElement>('[data-markdown-heading]').forEach((heading) => {
      observer.observe(heading);
    });

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', focusHashTarget);
    };
  }, [headings, rootRef]);

  return headings.some((heading) => heading.id === observedHeadingId)
    ? observedHeadingId
    : headings[0]?.id;
}

type MarkdownOutlineBranchProps = {
  activeBranchIds: ReadonlySet<string>;
  activeHeadingId: string | undefined;
  item: MarkdownHeadingTreeItem;
  level: number;
  onNavigate: (headingId: string) => void;
  showTooltip: boolean;
};

function MarkdownOutlineLink({
  activeHeadingId,
  headingId,
  label,
  level,
  onNavigate,
  showTooltip,
}: {
  activeHeadingId?: string;
  headingId: string;
  label: string;
  level: number;
  onNavigate: (headingId: string) => void;
  showTooltip: boolean;
}) {
  const isActive = activeHeadingId === headingId;
  const link = (
    <a
      className={styles.outlineLink}
      data-active={isActive}
      data-outline-level={level}
      href={`#${headingId}`}
      aria-current={isActive ? 'location' : undefined}
      title={showTooltip ? undefined : label}
      onClick={() => onNavigate(headingId)}
    >
      {label}
    </a>
  );

  return showTooltip ? (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className={styles.outlineTooltip}
          side="right"
          sideOffset={8}
          collisionPadding={12}
        >
          {label}
          <Tooltip.Arrow className={styles.outlineTooltipArrow} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  ) : (
    link
  );
}

function MarkdownOutlineBranch({
  activeBranchIds,
  activeHeadingId,
  item,
  level,
  onNavigate,
  showTooltip,
}: MarkdownOutlineBranchProps) {
  const hasChildren = item.children.length > 0;

  return (
    <li
      className={styles.outlineItem}
      data-active-branch={activeBranchIds.has(item.id)}
      data-depth={item.depth}
    >
      <MarkdownOutlineLink
        activeHeadingId={activeHeadingId}
        headingId={item.id}
        label={item.label}
        level={level}
        onNavigate={onNavigate}
        showTooltip={showTooltip}
      />
      {hasChildren ? (
        <ul className={styles.outlineChildren}>
          {item.children.map((child) => (
            <MarkdownOutlineBranch
              key={child.id}
              activeBranchIds={activeBranchIds}
              activeHeadingId={activeHeadingId}
              item={child}
              level={level + 1}
              onNavigate={onNavigate}
              showTooltip={showTooltip}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MarkdownOutline({
  activeHeadingId,
  headings,
  layout,
  links,
  outlineVariant,
  rootRef,
}: {
  activeHeadingId: string | undefined;
  headings: readonly MarkdownHeading[];
  layout: MarkdownOutlineLayout;
  links: readonly MarkdownOutlineLink[];
  outlineVariant: MarkdownOutlineVariant;
  rootRef: RefObject<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const outlineId = `markdown-outline-${useId().replace(/:/g, '')}`;
  const tree = useMemo(() => {
    const headingTree = buildHeadingTree(headings);
    const visibleLevels =
      headingTree.length > OUTLINE_SECOND_LEVEL_MAX_ROOTS ? 1 : OUTLINE_LEVELS_WITH_DETAILS;
    return limitHeadingTreeDepth(headingTree, visibleLevels);
  }, [headings]);
  const outlineActiveHeadingId = useMemo(
    () => resolveActiveOutlineHeadingId(headings, tree, activeHeadingId),
    [activeHeadingId, headings, tree],
  );
  const activeBranchIds = useMemo(
    () => findActiveBranchIds(tree, outlineActiveHeadingId),
    [outlineActiveHeadingId, tree],
  );

  function handleNavigate(headingId: string) {
    setIsOpen(false);
    window.requestAnimationFrame(() => {
      const target = document.getElementById(headingId);
      if (target && rootRef.current?.contains(target)) {
        scrollToHeading(target);
      }
    });
  }

  return (
    <nav className={styles.outline} aria-label={t('markdown.outline.label')}>
      <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
        <div className={styles.outlineCard}>
          {layout === 'rail' ? (
            <strong className={styles.outlineRailTitle}>{t('markdown.outline.title')}</strong>
          ) : null}
          <button
            type="button"
            className={styles.outlineToggle}
            aria-controls={outlineId}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            <ListTree size={16} aria-hidden="true" />
            <span>{t('markdown.outline.title')}</span>
            <ChevronDown className={styles.outlineToggleIcon} size={16} aria-hidden="true" />
          </button>
          <div id={outlineId} className={styles.outlinePanel} data-open={isOpen}>
            <ul className={styles.outlineList}>
              {tree.map((item) => (
                <MarkdownOutlineBranch
                  key={item.id}
                  activeBranchIds={activeBranchIds}
                  activeHeadingId={outlineActiveHeadingId}
                  item={item}
                  level={1}
                  onNavigate={handleNavigate}
                  showTooltip={outlineVariant === 'agent-report'}
                />
              ))}
              {links.map((link) => (
                <li className={styles.outlineItem} key={link.id}>
                  <MarkdownOutlineLink
                    headingId={link.id}
                    label={link.label}
                    level={1}
                    onNavigate={handleNavigate}
                    showTooltip={outlineVariant === 'agent-report'}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Tooltip.Provider>
    </nav>
  );
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className,
  anchorPrefix,
  outlineLayout = 'disclosure',
  outlineVariant = 'default',
  outlineLinks = [],
}: MarkdownContentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedContent = useMemo(() => unwrapEmbeddedMarkdown(content), [content]);
  const headings = useMemo(
    () => collectMarkdownHeadings(normalizedContent, anchorPrefix),
    [anchorPrefix, normalizedContent],
  );
  const components = useMemo(() => createMarkdownComponents(headings), [headings]);
  const outlineHeadings = useMemo(
    () => (headings[0]?.depth === 1 ? headings.slice(1) : headings),
    [headings],
  );
  const activeHeadingId = useActiveHeading(rootRef, headings);
  const hasOutline = outlineHeadings.length >= 2 || outlineLinks.length > 0;

  return (
    <div
      ref={rootRef}
      className={clsx(
        styles.root,
        hasOutline && styles.withOutline,
        hasOutline && outlineLayout === 'rail' && styles.railOutline,
        className,
      )}
      data-has-outline={hasOutline}
      data-outline-layout={outlineLayout}
      data-outline-variant={outlineVariant}
    >
      {hasOutline ? (
        <MarkdownOutline
          activeHeadingId={activeHeadingId}
          headings={outlineHeadings}
          layout={outlineLayout}
          links={outlineLinks}
          outlineVariant={outlineVariant}
          rootRef={rootRef}
        />
      ) : null}
      <div className={styles.document}>
        <ReactMarkdown components={components} remarkPlugins={REMARK_PLUGINS} skipHtml>
          {normalizedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
});
