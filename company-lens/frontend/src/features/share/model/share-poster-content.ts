import type { SharePosterHighlight } from './share.types';

export type SharePosterMarkdownSource = {
  label: string;
  markdown?: string;
};

export type SharePosterEditorialContent = {
  headline: string;
  summary?: string;
  highlights: readonly SharePosterHighlight[];
};

type MarkdownFragment = {
  heading?: string;
  text: string;
};

type HighlightCandidate = {
  highlight: SharePosterHighlight;
  hasExplicitLabel: boolean;
};

function plainText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownFragments(markdown: string): MarkdownFragment[] {
  const fragments: MarkdownFragment[] = [];
  const lines = markdown.replace(/```[\s\S]*?```/g, '').split(/\r?\n/);
  let activeHeading: string | undefined;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = plainText(paragraph.join(' '));
    if (text) {
      fragments.push({ ...(activeHeading ? { heading: activeHeading } : {}), text });
    }
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      activeHeading = plainText(heading[2]);
      continue;
    }
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      flushParagraph();
      continue;
    }
    if (/^\|?\s*:?-{3,}/.test(line) || /^[-*_]{3,}$/.test(line)) {
      continue;
    }
    const listItem = /^(?:[-+*]|\d+[.)])\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      const text = plainText(listItem[1]);
      if (text) {
        fragments.push({ ...(activeHeading ? { heading: activeHeading } : {}), text });
      }
      continue;
    }
    paragraph.push(line.replace(/^>\s?/, ''));
  }
  flushParagraph();
  return fragments;
}

function sentences(value: string): string[] {
  return (
    value
      .match(/[^。！？.!?；;]+[。！？.!?；;]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function headlineFor(subject: string, value: string): string {
  const headline = value.trim();
  if (!headline || headline === subject || headline.includes(subject)) {
    return truncate(headline || subject, 34);
  }
  const separator = /[\u3400-\u9fff]/.test(`${subject}${headline}`) ? '：' : ': ';
  return truncate(`${subject}${separator}${headline}`, 34);
}

function splitHighlightValue(
  value: string,
  allowShortCommaBreak = false,
): { title: string; description?: string } {
  const sentenceParts = sentences(value);
  const firstSentence = sentenceParts[0] ?? value;
  const preferredBreaks = [...firstSentence.matchAll(/[，,]/g)]
    .map((match) => match.index)
    .filter(
      (index): index is number =>
        index >= (allowShortCommaBreak ? 2 : 12) && index <= 30,
    );
  const breakIndex = preferredBreaks[0];

  if (breakIndex !== undefined) {
    const title = firstSentence.slice(0, breakIndex).trim();
    const description = [firstSentence.slice(breakIndex + 1).trim(), ...sentenceParts.slice(1)]
      .filter(Boolean)
      .join(' ');
    return {
      title: truncate(title, 34),
      ...(description ? { description: truncate(description, 56) } : {}),
    };
  }

  if (firstSentence.length > 34) {
    const description = sentenceParts.slice(1).join(' ');
    return {
      title: truncate(firstSentence.replace(/[。！？.!?；;]$/, ''), 34),
      ...(description ? { description: truncate(description, 56) } : {}),
    };
  }

  const description = sentenceParts.slice(1).join(' ');
  return {
    title: firstSentence.replace(/[。！？.!?；;]$/, ''),
    ...(description ? { description: truncate(description, 56) } : {}),
  };
}

function highlightFromFragment(
  fragment: MarkdownFragment,
  fallbackLabel: string,
): HighlightCandidate | undefined {
  const parts = sentences(fragment.text);
  const first = parts[0] ?? fragment.text;
  const lead = /^(.{2,24}?)(?:[：:]|——|—|\s+-\s+)(.+)$/.exec(first);
  const content = lead
    ? splitHighlightValue([lead[2], ...parts.slice(1)].join(' '))
    : splitHighlightValue([first, ...parts.slice(1)].join(' '), true);
  const title = content.title;
  if (!title) {
    return undefined;
  }
  return {
    highlight: {
      label: truncate(lead?.[1] ?? fragment.heading ?? fallbackLabel, 24),
      title,
      ...(content.description && content.description !== title
        ? { description: content.description }
        : {}),
    },
    hasExplicitLabel: Boolean(lead),
  };
}

export function extractSharePosterEditorialContent(
  subject: string,
  conclusionMarkdown: string | undefined,
  sources: readonly SharePosterMarkdownSource[],
): SharePosterEditorialContent {
  const conclusionFragments = conclusionMarkdown ? markdownFragments(conclusionMarkdown) : [];
  const firstConclusion = conclusionFragments[0];
  const conclusionParts = firstConclusion ? sentences(firstConclusion.text) : [];
  const headlineSeed = firstConclusion?.heading ?? conclusionParts[0] ?? subject;
  const summarySeed = firstConclusion?.heading
    ? firstConclusion.text
    : conclusionParts.slice(1).join(' ');
  const conclusionHighlights: HighlightCandidate[] = [];
  const sourceHighlights: HighlightCandidate[] = [];

  for (const fragment of conclusionFragments.slice(1)) {
    const highlight = highlightFromFragment(fragment, fragment.heading ?? subject);
    if (highlight) {
      conclusionHighlights.push(highlight);
    }
  }
  for (const source of sources) {
    if (!source.markdown?.trim()) {
      continue;
    }
    for (const fragment of markdownFragments(source.markdown)) {
      const highlight = highlightFromFragment(fragment, source.label);
      if (highlight) {
        sourceHighlights.push(highlight);
      }
    }
  }

  sourceHighlights.sort(
    (left, right) => Number(right.hasExplicitLabel) - Number(left.hasExplicitLabel),
  );
  const highlightCandidates = [...conclusionHighlights, ...sourceHighlights];

  const seenLabels = new Set<string>();
  const seenTitles = new Set<string>();
  const highlights = highlightCandidates.flatMap(({ highlight }) => {
    const labelKey = highlight.label.replace(/\s+/g, '').toLocaleLowerCase();
    const titleKey = highlight.title.replace(/\s+/g, '').toLocaleLowerCase();
    if (seenLabels.has(labelKey) || seenTitles.has(titleKey)) {
      return [];
    }
    seenLabels.add(labelKey);
    seenTitles.add(titleKey);
    return [highlight];
  });

  return {
    headline: headlineFor(subject, headlineSeed),
    ...(summarySeed ? { summary: truncate(summarySeed, 56) } : {}),
    highlights: highlights.slice(0, 3),
  };
}
