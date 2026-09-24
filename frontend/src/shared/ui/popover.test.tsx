import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
} from './popover'

describe('Popover', () => {
  it('支持通过 PopoverClose 关闭浮层', async () => {
    const user = userEvent.setup()

    render(
      <Popover defaultOpen>
        <PopoverContent>
          <PopoverTitle>Settings</PopoverTitle>
          <PopoverClose aria-label="Close popover">Close</PopoverClose>
        </PopoverContent>
      </Popover>,
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close popover' }))

    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
  })
})
