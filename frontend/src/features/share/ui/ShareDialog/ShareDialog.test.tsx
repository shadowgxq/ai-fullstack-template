import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n';
import { ShareDialog } from './ShareDialog';

const content = {
  title: 'Preview',
  slogan: 'Template',
  result: 'Example',
  fullText: 'Example',
  landingUrl: 'https://example.com/demo',
  posterFile: new File(['png'], 'poster.png', { type: 'image/png' }),
};
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
describe('ShareDialog', () => {
  it('renders the supplied poster without opening external windows and supports close', () => {
    const open = vi.spyOn(window, 'open');
    const change = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog
          open
          content={content}
          onOpenChange={change}
          poster={<p>Caller supplied poster</p>}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Share preview' })).toBeInTheDocument();
    expect(screen.getByText('Caller supplied poster')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close share preview' }));
    expect(change).toHaveBeenCalledWith(false);
  });
  it('translates the reusable shell independently of poster business content', async () => {
    await i18n.changeLanguage('zh');
    render(
      <I18nextProvider i18n={i18n}>
        <ShareDialog open content={content} onOpenChange={() => {}} poster={<p>Caller poster</p>} />
      </I18nextProvider>,
    );
    expect(screen.getByRole('dialog', { name: '分享预览' })).toBeInTheDocument();
  });
});
