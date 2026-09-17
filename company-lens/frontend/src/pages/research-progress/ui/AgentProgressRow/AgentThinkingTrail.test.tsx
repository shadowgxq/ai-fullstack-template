import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResearchThinkingStep } from '../../../../entities/research';
import { i18n } from '../../../../shared/i18n';
import { AgentThinkingDetails } from './AgentThinkingTrail';

function createSteps(count: number): ResearchThinkingStep[] {
  return Array.from({ length: count }, (_, index) => ({
    stepId: `step-${index + 1}`,
    agentId: 'agent-1',
    agentType: 'industry_research',
    title: `Step ${index + 1}`,
    summary: `Summary ${index + 1}`,
  }));
}

function renderTrail(steps: readonly ResearchThinkingStep[], isExpanded = true) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AgentThinkingDetails
        id="thinking-details"
        triggerId="thinking-trigger"
        agentName="Industry Research"
        steps={steps}
        isExpanded={isExpanded}
        onExpandedChange={vi.fn()}
      />
    </I18nextProvider>,
  );
}

describe('AgentThinkingDetails', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('becomes a keyboard-scrollable region only after more than five steps', () => {
    const rendered = renderTrail(createSteps(5));
    const region = screen.getByRole('region', {
      name: 'Full research process for Industry Research',
    });

    expect(region).toHaveAttribute('data-scrollable', 'false');
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(region.querySelectorAll('[data-thinking-step]')).toHaveLength(5);

    rendered.rerender(
      <I18nextProvider i18n={i18n}>
        <AgentThinkingDetails
          id="thinking-details"
          triggerId="thinking-trigger"
          agentName="Industry Research"
          steps={createSteps(6)}
          isExpanded
          onExpandedChange={vi.fn()}
        />
      </I18nextProvider>,
    );

    expect(region).toHaveAttribute('data-scrollable', 'true');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.querySelectorAll('[data-thinking-step]')).toHaveLength(6);
  });

  it('keeps collapsed timeline content out of the keyboard focus order', () => {
    renderTrail(createSteps(6), false);

    expect(
      screen.getByRole('region', {
        hidden: true,
        name: 'Full research process for Industry Research',
      }),
    ).toHaveAttribute('tabindex', '-1');
  });

  it('links a step summary when its first source ref is a valid web URL', () => {
    const steps: ResearchThinkingStep[] = [
      {
        ...createSteps(1)[0],
        stepId: 'web-source',
        summary: 'Source with URL',
        sourceRefs: ['https://example.com/research?id=1', 'https://example.com/secondary'],
      },
      {
        ...createSteps(1)[0],
        stepId: 'source-id',
        summary: 'Source with ID only',
        sourceRefs: ['src_001'],
      },
      {
        ...createSteps(1)[0],
        stepId: 'unsafe-source',
        summary: 'Unsafe source',
        sourceRefs: ['javascript:alert(1)', 'https://example.com/safe-but-not-first'],
      },
    ];
    renderTrail(steps);

    expect(screen.getByRole('link', { name: 'Source with URL' })).toHaveAttribute(
      'href',
      'https://example.com/research?id=1',
    );
    expect(screen.getByRole('link', { name: 'Source with URL' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getByText('Source with ID only').closest('a')).toBeNull();
    expect(screen.getByText('Unsafe source').closest('a')).toBeNull();
  });

  it('follows new steps at the bottom without interrupting history review', () => {
    const scrollTo = vi.fn();
    const rendered = renderTrail(createSteps(6));
    const region = screen.getByRole('region', {
      name: 'Full research process for Industry Research',
    });
    Object.defineProperties(region, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 600 },
      scrollTop: { configurable: true, writable: true, value: 0 },
      scrollTo: { configurable: true, value: scrollTo },
    });
    scrollTo.mockClear();

    fireEvent.scroll(region);
    rendered.rerender(
      <I18nextProvider i18n={i18n}>
        <AgentThinkingDetails
          id="thinking-details"
          triggerId="thinking-trigger"
          agentName="Industry Research"
          steps={createSteps(7)}
          isExpanded
          onExpandedChange={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(scrollTo).not.toHaveBeenCalled();

    region.scrollTop = 500;
    fireEvent.scroll(region);
    rendered.rerender(
      <I18nextProvider i18n={i18n}>
        <AgentThinkingDetails
          id="thinking-details"
          triggerId="thinking-trigger"
          agentName="Industry Research"
          steps={createSteps(8)}
          isExpanded
          onExpandedChange={vi.fn()}
        />
      </I18nextProvider>,
    );

    expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: 'smooth' });
    expect(region.querySelectorAll('[data-thinking-step]')).toHaveLength(8);
  });
});
