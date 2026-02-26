/**
 * RiskGauge 组件测试。
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import RiskGauge from '../RiskGauge'

describe('RiskGauge', () => {
  it('展示风险熔断状态与原因', () => {
    render(
      <RiskGauge
        totalExposure={123.45}
        maxDrawdown={0.2}
        halted={true}
        haltReason="drawdown_limit"
      />,
    )

    expect(screen.getByText(/Drawdown: 20.00%/)).toBeInTheDocument()
    expect(screen.getByText(/HALTED: drawdown_limit/)).toBeInTheDocument()
  })

  it('健康状态展示 Healthy', () => {
    render(
      <RiskGauge
        totalExposure={20}
        maxDrawdown={0.01}
        halted={false}
        haltReason=""
      />,
    )

    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })
})
