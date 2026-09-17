import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { MarkdownContent } from './MarkdownContent';

function renderMarkdown(ui: ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('shared MarkdownContent', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  });

  it('renders GFM and configures external links safely', () => {
    renderMarkdown(
      <MarkdownContent
        content={[
          '# Industry outlook',
          '',
          '**Demand** continues to improve.',
          '',
          '| Metric | Value |',
          '| --- | ---: |',
          '| Growth | 24% |',
          '',
          '- [x] Evidence verified',
          '',
          '[Primary source](https://example.com/report)',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Industry outlook' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Industry outlook' })).toHaveAttribute(
      'id',
    );
    expect(screen.getByText('Demand')).toHaveProperty('tagName', 'STRONG');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('link', { name: 'Primary source' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getByRole('link', { name: 'Primary source' })).toHaveAttribute(
      'rel',
      'noreferrer noopener',
    );
  });

  it('drops raw HTML and blocks unsafe link protocols', () => {
    renderMarkdown(
      <MarkdownContent
        content={'<script>window.alert("raw html")</script>\n\n[Unsafe](javascript:alert(1))'}
      />,
    );

    expect(screen.queryByText('raw html')).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe').closest('a')).toHaveAttribute('href', '');
  });

  it('renders a nested outline with stable, deduplicated heading anchors', () => {
    renderMarkdown(
      <MarkdownContent
        anchorPrefix="research-report"
        content={[
          '# Research report',
          '',
          '## Core **view**',
          '',
          '### Detail',
          '',
          '#### Supporting evidence',
          '',
          '## Risks',
          '',
          '## Risks',
        ].join('\n')}
      />,
    );

    const headings = screen.getAllByRole('heading');
    expect(headings[0]).toHaveAttribute('id', 'research-report-research-report');
    expect(screen.getByRole('heading', { name: 'Core view' })).toHaveAttribute(
      'id',
      'research-report-core-view',
    );
    expect(screen.getAllByRole('heading', { name: 'Risks' })[0]).toHaveAttribute(
      'id',
      'research-report-risks',
    );
    expect(screen.getAllByRole('heading', { name: 'Risks' })[1]).toHaveAttribute(
      'id',
      'research-report-risks-2',
    );

    const navigation = screen.getByRole('navigation');
    expect(navigation.querySelector('a[href="#research-report-core-view"]')).toHaveAttribute(
      'title',
      'Core view',
    );
    expect(navigation.querySelector('a[href="#research-report-detail"]')).toBeInTheDocument();
    expect(
      navigation.querySelector('a[href="#research-report-supporting-evidence"]'),
    ).not.toBeInTheDocument();
    expect(navigation.querySelector('a[href="#research-report-risks-2"]')).toBeInTheDocument();
  });

  it('marks agent report outline levels and exposes full labels in focusable tooltips', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
    renderMarkdown(
      <MarkdownContent
        outlineLayout="rail"
        outlineVariant="agent-report"
        content={
          '# Report\n\n## A very long primary section title\n\n### A long secondary title\n\n## Risks'
        }
      />,
    );

    const primaryLink = screen.getByRole('link', { name: 'A very long primary section title' });
    const secondaryLink = screen.getByRole('link', { name: 'A long secondary title' });
    expect(primaryLink).toHaveAttribute('data-outline-level', '1');
    expect(secondaryLink).toHaveAttribute('data-outline-level', '2');

    primaryLink.focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'A very long primary section title',
    );
  });

  it('hides second-level outline items when there are more than five first-level items', () => {
    renderMarkdown(
      <MarkdownContent
        content={[
          '# Research report',
          '',
          ...Array.from({ length: 6 }, (_, index) => [
            `## Section ${index + 1}`,
            '',
            `### Detail ${index + 1}`,
            '',
          ]).flat(),
        ].join('\n')}
      />,
    );

    const navigation = screen.getByRole('navigation');
    expect(within(navigation).getAllByRole('link')).toHaveLength(6);
    expect(screen.getByRole('heading', { name: 'Detail 1' })).toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'Detail 1' })).not.toBeInTheDocument();
  });

  it('repositions and focuses an initial hash target after markdown renders', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    window.history.replaceState(null, '', '#research-report-core-view');

    try {
      renderMarkdown(
        <MarkdownContent
          anchorPrefix="research-report"
          content={'# Research report\n\n## Core view\n\nDetails'}
        />,
      );

      const target = screen.getByRole('heading', { name: 'Core view' });
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
        expect(target).toHaveFocus();
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it('does not add an outline for a single rendered heading or code-only headings', () => {
    const { rerender } = renderMarkdown(
      <MarkdownContent content={'# Short note\n\nContent without a second section.'} />,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        <MarkdownContent content={'```markdown\n# Code heading\n```'} />
      </I18nextProvider>,
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps fixed section links in the outline when markdown has no headings', () => {
    renderMarkdown(
      <div id="result-agents-title">
        <MarkdownContent
          content="Research conclusion"
          outlineLinks={[{ id: 'result-agents-title', label: 'Agent reports' }]}
        />
      </div>,
    );

    expect(
      screen.getByRole('navigation').querySelector('a[href="#result-agents-title"]'),
    ).toHaveTextContent('Agent reports');
  });

  it('unwraps markdown reports embedded below a heading', () => {
    renderMarkdown(
      <MarkdownContent
        content={[
          '# 综合研究报告',
          '',
          '### 行业全景 Agent',
          '```markdown',
          '# 英伟达产业链投资研究报告',
          '',
          '## 行业结论',
          '',
          '结论内容。',
          '',
          '```',
          '',
          '### 质量筛选 Agent',
          '```markdown',
          '# 去劣筛选结果',
          '',
          '## 汇总表',
          '```',
        ].join('\n')}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: '英伟达产业链投资研究报告' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '行业结论' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '去劣筛选结果' })).toBeInTheDocument();
    expect(screen.queryByText('# 英伟达产业链投资研究报告')).not.toBeInTheDocument();
  });

  it('keeps regular fenced code blocks unchanged', () => {
    renderMarkdown(<MarkdownContent content={'### 示例\n\n```markdown\n# 这仍是代码\n```'} />);

    expect(screen.getByText('# 这仍是代码')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: '这仍是代码' })).not.toBeInTheDocument();
  });
});
