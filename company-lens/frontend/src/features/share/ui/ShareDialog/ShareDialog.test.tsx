import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import { capturePoster as capturePosterAdapter } from '../../adapter/share-poster.capture';
import { setShareCompositionForTest } from '../../api/share.composition';
import type { SharePayload } from '../../model/share.types';
import { ShareDialog } from './ShareDialog';

vi.mock('../../adapter/share-poster.capture', () => ({
  capturePoster: vi.fn(),
}));

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

const payload: SharePayload = {
  subjectKind: 'company',
  targetId: 'company-1',
  title: 'Company A',
  slogan: 'Research with evidence.',
  result: 'Company conclusion',
  fullText: 'Research with evidence.\nCompany conclusion',
  fileName: 'company.png',
  landingCapability: 'none',
  productEntry: 'https://app.example.test',
  poster: { title: 'Company A', productEntry: 'https://app.example.test' },
};

const resultPayload: SharePayload = {
  subjectKind: 'research-result',
  targetId: 'project-1',
  projectId: 'project-1',
  title: 'AI Compute',
  slogan: 'Research with evidence.',
  result: 'Full research result',
  fullText: 'Research with evidence.\nFull research result',
  fileName: 'research-result.png',
  landingCapability: 'project',
  productEntry: 'https://app.example.test',
  poster: {
    variant: 'research-brief',
    eyebrow: 'AI Berkshire',
    badge: '6-Agent collaborative research',
    title: 'AI Compute: durable demand, tighter valuation margin',
    identity: 'Growth remains intact while risk moves into the pricing core.',
    metadata: ['Theme research', 'US', 'AI Compute'],
    highlights: [
      {
        label: 'Technology lead',
        title: 'GPU performance stays ahead',
        description: 'Fast cadence',
      },
      { label: 'Ecosystem moat', title: 'CUDA raises switching costs' },
      { label: 'Demand growth', title: 'AI infrastructure orders expand' },
    ],
    riskLabel: 'Primary risk to verify',
    riskStatement: 'Verify valuation risk',
    dataDate: '2026-07-21T18:37:45Z',
    productEntry: 'https://app.example.test',
    researchBrief: {
      decisionLabel: 'Decision',
      decision: 'Hold',
      confidenceLabel: 'Confidence',
      confidence: 'High',
      summary: 'Durable business, tighter price.',
      summaryDetail: 'Growth remains intact while risk moves into the pricing core.',
      metricsLabel: 'Key judgments',
      metrics: [
        { label: 'Company quality', value: 'Strong', tone: 'positive' },
        { label: 'Valuation', value: 'Full', tone: 'caution' },
        { label: 'Long-term outlook', value: 'Positive', tone: 'positive' },
      ],
      signals: [
        {
          label: 'Opportunity',
          value: 'AI infrastructure orders expand.',
          tone: 'opportunity',
        },
        { label: 'Risk', value: 'Verify valuation risk', tone: 'risk' },
      ],
    },
  },
};

describe('ShareDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:share-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(capturePosterAdapter).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    setShareCompositionForTest({
      imageUploadAdapter: {
        upload: vi.fn().mockResolvedValue({
          assetId: 'mock://share-images/0003',
          fileName: 'company.png',
          blob: new Blob(['png'], { type: 'image/png' }),
          isDevelopmentMarker: true,
        }),
      },
    });
  });

  afterEach(() => {
    cleanup();
    setShareCompositionForTest(undefined);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a company sheet with accessible close and local actions', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={onOpenChange} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Share research' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close share dialog' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Research sharing actions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy summary' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copy summary' })).toHaveAttribute(
      'data-action-variant',
      'secondary',
    );
    expect(screen.queryByRole('button', { name: 'Copy research link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate poster' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mock upload' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close share dialog' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows one locally generated poster without automatically uploading it', async () => {
    const upload = vi.fn().mockResolvedValue({
      assetId: 'mock://share-images/0004',
      fileName: 'company.png',
      blob: new Blob(['png'], { type: 'image/png' }),
      isDevelopmentMarker: true,
    });
    setShareCompositionForTest({
      imageUploadAdapter: { upload },
    });
    const view = render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled());
    expect(screen.getAllByText('Company A')).toHaveLength(1);
    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByText('Action completed.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate poster' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mock upload' })).not.toBeInTheDocument();

    view.rerender(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );
    expect(capturePosterAdapter).toHaveBeenCalledTimes(1);

    view.rerender(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open={false} payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(2));
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns the poster scroll area to the top when the content changes', async () => {
    const view = render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    const scrollArea = view.container.ownerDocument.querySelector<HTMLElement>(
      '[data-share-scroll-area]',
    );
    expect(scrollArea).not.toBeNull();
    if (!scrollArea) {
      return;
    }
    scrollArea.scrollTop = 480;

    view.rerender(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={resultPayload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(scrollArea.scrollTop).toBe(0));
  });

  it('separates project sharing channels from copy options', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: nativeShare,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={resultPayload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Share' })).toHaveAttribute(
      'data-action-variant',
      'primary',
    );
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveAttribute(
      'data-action-variant',
      'secondary',
    );
    expect(screen.queryByRole('button', { name: 'Share from device' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy research link' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('group', { name: 'Share channels' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share from device' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy research link' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'X' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reddit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Telegram' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.queryByRole('group', { name: 'Share channels' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Copy content' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy research link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy summary' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'X' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy research link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/`));
    expect(screen.getByRole('status')).toHaveTextContent('Research link copied.');
    expect(
      screen.queryByRole('link', { name: 'https://app.example.test' }),
    ).not.toBeInTheDocument();
  });

  it('opens share and copy options on hover and closes them after leaving', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={resultPayload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));

    const shareButton = screen.getByRole('button', { name: 'Share' });
    fireEvent.pointerEnter(shareButton);
    expect(screen.getByRole('group', { name: 'Share channels' })).toBeInTheDocument();

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'X' }));
    expect(screen.getByRole('group', { name: 'Share channels' })).toBeInTheDocument();

    fireEvent.pointerLeave(shareButton);
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Share channels' })).not.toBeInTheDocument(),
    );

    const copyButton = screen.getByRole('button', { name: 'Copy' });
    fireEvent.pointerEnter(copyButton);
    expect(screen.getByRole('group', { name: 'Copy content' })).toBeInTheDocument();

    fireEvent.pointerLeave(copyButton);
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Copy content' })).not.toBeInTheDocument(),
    );
  });

  it('keeps touch interaction click-controlled', () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={resultPayload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    const shareButton = screen.getByRole('button', { name: 'Share' });
    fireEvent.click(shareButton);
    expect(screen.getByRole('group', { name: 'Share channels' })).toBeInTheDocument();

    const touchLeave = new Event('pointerleave', { bubbles: true });
    Object.defineProperty(touchLeave, 'pointerType', { value: 'touch' });
    fireEvent(shareButton, touchLeave);
    expect(screen.getByRole('group', { name: 'Share channels' })).toBeInTheDocument();
  });

  it('hides system share on desktop even when Web Share is available', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: nativeShare,
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(nativeShare).not.toHaveBeenCalled();
  });

  it('keeps system share on mobile H5', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: nativeShare,
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(nativeShare).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('group', { name: 'Share channels' })).not.toBeInTheDocument();
  });

  it('shows action feedback as a toast outside the action area', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Copy summary' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Copy content' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Summary copied.'));
    expect(screen.getByRole('status')).toHaveAttribute('data-share-toast');
    expect(screen.getByRole('status').closest('[data-share-actions]')).toBeNull();
  });

  it('shows failed action feedback as an error toast', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={payload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    const copyButton = screen.getByRole('button', { name: 'Copy summary' });
    await waitFor(() => expect(copyButton).toBeEnabled());
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Action failed.'));
    expect(screen.getByRole('alert')).toHaveAttribute('data-share-toast');
    expect(screen.getByRole('alert').closest('[data-share-actions]')).toBeNull();
  });

  it('renders the editorial research brief content', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={resultPayload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    expect(screen.getByText('6-Agent collaborative research')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('share.poster.signal'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toHaveAttribute(
      'data-action-variant',
      'primary',
    );
    expect(screen.getByLabelText('Key judgments')).toHaveTextContent('Company quality');
    expect(screen.getByText('Durable business, tighter price.')).toBeInTheDocument();
    expect(screen.getByText('Opportunity')).toBeInTheDocument();
    expect(screen.getByText('Risk')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('AI infrastructure orders expand.')).toBeInTheDocument();
    expect(screen.getByText('Verify valuation risk')).toBeInTheDocument();
    expect(screen.getByText('View full research report')).toBeInTheDocument();
    expect(screen.getByText('Data as of 07/22/2026')).toBeInTheDocument();
    expect(
      screen.getByText('For research reference only. Not investment advice.'),
    ).toBeInTheDocument();
  });

  it('bounds dynamic poster content for the fixed export canvas', async () => {
    const researchBrief = resultPayload.poster.researchBrief;
    if (!researchBrief) {
      throw new Error('Expected the research brief fixture.');
    }
    const longDecision = 'Wait for a substantially wider margin of safety before buying';
    const overflowPayload: SharePayload = {
      ...resultPayload,
      poster: {
        ...resultPayload.poster,
        metadata: [...(resultPayload.poster.metadata ?? []), 'Hidden metadata'],
        highlights: [
          ...(resultPayload.poster.highlights ?? []),
          { label: 'Hidden highlight', title: 'This highlight must not render' },
        ],
        researchBrief: {
          ...researchBrief,
          decision: longDecision,
          metrics: [
            ...researchBrief.metrics,
            { label: 'Hidden metric', value: 'This metric must not render' },
          ],
          signals: [
            ...researchBrief.signals,
            { label: 'Hidden signal', value: 'This signal must not render' },
          ],
        },
      },
    };

    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open payload={overflowPayload} onOpenChange={vi.fn()} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(capturePosterAdapter).toHaveBeenCalledTimes(1));
    expect(screen.getByText(longDecision)).toHaveAttribute('data-text-size', 'small');
    expect(screen.queryByText('Hidden metadata')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden highlight')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden metric')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden signal')).not.toBeInTheDocument();
  });
});
