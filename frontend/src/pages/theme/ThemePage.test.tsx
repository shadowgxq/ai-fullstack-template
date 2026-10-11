import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '@/shared/i18n';
import { useThemeStore } from '@/shared/theme';

import { ThemePage } from './ThemePage';

function renderPage() {
  const queryClient = new QueryClient();

  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/theme']}>
          <ThemePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('ThemePage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useThemeStore.setState({ mode: 'light' });
  });

  it('offers only light and dark and persists the selected mode', async () => {
    renderPage();

    const modes = screen.getByRole('region', { name: 'Choose your mode' });
    const options = within(modes).getAllByRole('button');

    expect(options).toHaveLength(2);
    expect(options.filter((button) => button.getAttribute('aria-pressed') === 'true')).toHaveLength(
      1,
    );

    const inactive = options.find((button) => button.getAttribute('aria-pressed') === 'false');
    expect(inactive).toBeDefined();

    await userEvent.click(inactive!);

    expect(inactive!.getAttribute('aria-pressed')).toBe('true');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(JSON.parse(localStorage.getItem('ui-theme')!).state).toEqual({ mode: 'dark' });
  });
});
