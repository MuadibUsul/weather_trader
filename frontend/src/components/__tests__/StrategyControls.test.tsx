/**
 * StrategyControls 组件测试。
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import StrategyControls from '../StrategyControls'

describe('StrategyControls', () => {
  it('点击按钮触发启停回调', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    const onToggle = vi.fn().mockResolvedValue(undefined)

    render(
      <StrategyControls
        running={false}
        orderSize={25}
        quoteDelta={0.01}
        dryRun={true}
        onChange={onChange}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Strategy' }))

    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('拖动滑杆触发参数更新', () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    const onToggle = vi.fn().mockResolvedValue(undefined)

    render(
      <StrategyControls
        running={true}
        orderSize={25}
        quoteDelta={0.01}
        dryRun={true}
        onChange={onChange}
        onToggle={onToggle}
      />,
    )

    const sliders = screen.getAllByRole('slider')
    fireEvent.change(sliders[0], { target: { value: '50' } })

    expect(onChange).toHaveBeenCalledWith(50, 0.01, true)
  })
})
