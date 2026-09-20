import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Skeleton } from './skeleton';
import { Switch } from './switch';

describe('template primitives', () => {
  it('forwards button refs and blocks native button actions while loading', () => {
    const ref = createRef<HTMLButtonElement>();
    const click = vi.fn();
    render(
      <Button ref={ref} loading onClick={click}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(ref.current).toBe(screen.getByRole('button'));
    expect(ref.current).toBeDisabled();
    expect(ref.current).toHaveAttribute('aria-busy', 'true');
    expect(click).not.toHaveBeenCalled();
  });
  it('renders links through asChild without nesting buttons', () => {
    render(
      <Button asChild>
        <a href="/components">Browse</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/components');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('blocks slotted links while disabled or pending', () => {
    const click = vi.fn();
    render(
      <Button asChild loading>
        <a href="/components" onClick={click}>
          Browse
        </a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Browse' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(fireEvent.click(link)).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });
  it('opens an accessible dialog through a slotted trigger', () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent closeLabel="Close">
          <DialogTitle>Details</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Details' })).toHaveAccessibleDescription(
      'Description',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('uses compact popover geometry without feature-specific styles', () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Options</Button>
        </PopoverTrigger>
        <PopoverContent variant="compact" aria-label="Actions">
          Content
        </PopoverContent>
      </Popover>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('dialog', { name: 'Actions' })).toHaveAttribute(
      'data-variant',
      'compact',
    );
  });
  it('keeps decorative skeletons out of the accessibility tree', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Skeleton ref={ref} className="h-4" />);
    expect(ref.current?.tagName).toBe('SPAN');
    expect(ref.current).toHaveAttribute('aria-hidden', 'true');
    expect(ref.current).toHaveClass('motion-reduce:animate-none');
  });
  it('provides controlled switch semantics', () => {
    const change = vi.fn();
    render(<Switch checked={false} onCheckedChange={change} aria-label="Enable" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Enable' }));
    expect(change).toHaveBeenCalledWith(true);
  });
});
