import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '@/shared/i18n';
import { ShareDialog } from '@/features/share';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ComponentDetailPage } from './ComponentDetailPage';

// jsdom does not implement the pointer/scroll APIs used by the real Radix controls.
const methods = ['hasPointerCapture', 'releasePointerCapture', 'scrollIntoView'] as const;
const originalMethods = methods.map((name) =>
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
);
beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId = 1;
    pointerType = 'mouse';
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  for (const name of methods)
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      value: name === 'hasPointerCapture' ? () => false : () => undefined,
    });
});
afterAll(() => {
  methods.forEach((name, index) => {
    const original = originalMethods[index];
    if (original) Object.defineProperty(HTMLElement.prototype, name, original);
    else Reflect.deleteProperty(HTMLElement.prototype, name);
  });
  vi.unstubAllGlobals();
});
afterEach(() => vi.useRealTimers());
beforeEach(async () => {
  await i18n.changeLanguage('en');
});

function renderPage(slug: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[`/components/${slug}`]}>
          <Routes>
            <Route path="/components/:componentName" element={<ComponentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
const copy = (key: string) => i18n.t(`components.detail.preview.${key}`);

describe('current component interactions', () => {
  it('blocks pending asChild links and restores their normal action and name afterwards', () => {
    const onAction = vi.fn();
    const { rerender } = render(
      <Button asChild loading loadingLabel="Saving">
        <a href="#saved" onClick={onAction}>
          Save
        </a>
      </Button>,
    );
    const pending = screen.getByRole('link', { name: 'Saving' });
    expect(pending).toHaveAttribute('aria-disabled', 'true');
    expect(pending).toHaveAttribute('tabindex', '-1');
    expect(fireEvent.click(pending)).toBe(false);
    fireEvent.keyDown(pending, { key: 'Enter' });
    expect(onAction).not.toHaveBeenCalled();
    rerender(
      <Button asChild loadingLabel="Saving">
        <a href="#saved" onClick={onAction}>
          Save
        </a>
      </Button>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Save' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('keeps rich Select descriptions out of the selected label and skips disabled options', async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="account">
        <SelectTrigger aria-label="Setting">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="account" description="Account details">
            Account
          </SelectItem>
          <SelectItem value="notifications" description="Delivery preferences">
            Notifications
          </SelectItem>
          <SelectItem value="locked" disabled>
            Locked
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Setting' });
    await user.click(trigger);
    const notifications = screen.getByRole('option', { name: 'Notifications' });
    expect(notifications).toHaveAccessibleDescription('Delivery preferences');
    expect(screen.getByRole('option', { name: 'Locked' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{End}{Enter}');
    expect(trigger).toHaveTextContent('Notifications');
    expect(trigger).not.toHaveTextContent('Delivery preferences');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('inherits underline Tabs presentation and keyboard navigation skips disabled tabs', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <TabsList variant="underline" aria-label="Sections">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="locked" disabled>
            Locked
          </TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
      </Tabs>,
    );
    const first = screen.getByRole('tab', { name: 'One' });
    expect(first).toHaveAttribute('data-variant', 'underline');
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Second panel');
  });
});

it('keeps the Share platform popup keyboard-accessible and closes it without closing its parent', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <ShareDialog
        open
        onOpenChange={onOpenChange}
        content={{
          title: 'Design guide',
          fullText: 'Design guide example',
          slogan: 'Example',
          result: 'Ready',
          landingUrl: 'https://example.org/design',
          posterFile: new File(['fixture'], 'poster.png', { type: 'image/png' }),
        }}
        poster={<div>Poster</div>}
        posterStatus="ready"
      />
    </I18nextProvider>,
  );
  const trigger = screen.getByRole('button', { name: i18n.t('share.open') });
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await user.click(trigger);
  expect(
    screen.getByRole('dialog', { name: i18n.t('share.shareOptionsLabel') }),
  ).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(
    screen.queryByRole('dialog', { name: i18n.t('share.shareOptionsLabel') }),
  ).not.toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
  await waitFor(() => expect(trigger).toHaveFocus());
  await user.click(screen.getByRole('button', { name: i18n.t('share.close') }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

describe('component gallery interactions', () => {
  it('runs a pending button example and restores the action when it finishes', async () => {
    vi.useFakeTimers();
    renderPage('button');
    fireEvent.click(screen.getByRole('button', { name: copy('button.run') }));
    expect(screen.getByRole('button', { name: copy('button.loading') })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole('button', { name: copy('button.run') })).toBeEnabled();
  });

  it('focuses the actual Input and preserves read-only content', async () => {
    const user = userEvent.setup();
    renderPage('input');
    await user.click(screen.getByText(copy('input.focus'), { selector: 'label' }));
    expect(screen.getByLabelText(copy('input.focus'))).toHaveFocus();
    const readonly = screen.getByLabelText(copy('input.readonly'));
    await user.type(readonly, 'changed');
    expect(readonly).toHaveValue(copy('input.readonlyValue'));
  });

  it('keeps Textarea line breaks and its external character count in sync', async () => {
    const user = userEvent.setup();
    renderPage('textarea');
    const field = screen.getByLabelText(copy('textarea.counterLabel'));
    await user.clear(field);
    await user.type(field, 'First{Enter}Second');
    expect(field).toHaveValue('First\nSecond');
    expect(screen.getByText('12 / 1000')).toBeInTheDocument();
    await user.click(screen.getByText(copy('textarea.focus'), { selector: 'label' }));
    expect(screen.getByLabelText(copy('textarea.focus'))).toHaveFocus();
    expect(screen.getByLabelText(copy('textarea.disabled'))).toBeDisabled();
  });

  it('clears the Select validation message after a real selection', async () => {
    const user = userEvent.setup();
    renderPage('select');
    const field = screen.getByLabelText(copy('select.states.invalid'));
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await user.click(field);
    await user.click(screen.getByRole('option', { name: copy('select.options.two') }));
    expect(field).toHaveTextContent(copy('select.options.two'));
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('returns dialog focus to the exact opening button after Escape', async () => {
    const user = userEvent.setup();
    renderPage('dialog');
    const trigger = screen.getByRole('button', { name: copy('dialog.types.warning.open') });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('opens Tooltip on focus instead of forcing it to stay open', async () => {
    const user = userEvent.setup();
    renderPage('tooltip');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: copy('tooltip.top') });
    act(() => trigger.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(copy('tooltip.content'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('persists the chosen menu radio item when reopened', async () => {
    const user = userEvent.setup();
    renderPage('dropdown-menu');
    const trigger = screen.getByRole('button', { name: copy('dropdown.sort') });
    await user.click(trigger);
    await user.click(
      screen.getByRole('menuitemradio', { name: copy('dropdown.sortOptions.oldest') }),
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(trigger);
    expect(
      screen.getByRole('menuitemradio', { name: copy('dropdown.sortOptions.oldest') }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('closes the compact Popover through its content and restores focus', async () => {
    const user = userEvent.setup();
    renderPage('popover');
    const trigger = screen.getByRole('button', { name: copy('popover.compact') });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: copy('popover.close') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
