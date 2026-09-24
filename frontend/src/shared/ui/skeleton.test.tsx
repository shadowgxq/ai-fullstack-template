import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('提供主题化的动画占位块并默认隐藏于辅助技术', () => {
    render(<Skeleton data-testid="skeleton" className="h-4 w-3/4" />)

    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton.tagName).toBe('SPAN')
    expect(skeleton).toHaveAttribute('data-slot', 'skeleton')
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(skeleton).toHaveClass('bg-muted', 'animate-pulse', 'h-4', 'w-3/4')
  })

  it('透传原生属性并允许调用方覆盖 aria-hidden', () => {
    render(<Skeleton data-testid="skeleton" aria-hidden={false} title="Loading" />)

    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveAttribute('aria-hidden', 'false')
    expect(skeleton).toHaveAttribute('title', 'Loading')
  })
})
