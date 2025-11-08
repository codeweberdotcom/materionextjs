import { render } from '@testing-library/react'
import DirectionalIcon from '../DirectionalIcon'

// Mock MUI theme at the top level
jest.mock('@mui/material/styles', () => ({
  useTheme: () => ({ direction: 'ltr' })
}))

describe('DirectionalIcon', () => {
  it('should render an icon element', () => {
    const { container } = render(
      <DirectionalIcon
        ltrIconClass="bx-chevron-right"
        rtlIconClass="bx-chevron-left"
      />
    )

    const icon = container.querySelector('i')
    expect(icon).toBeTruthy()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <DirectionalIcon
        ltrIconClass="bx-chevron-right"
        rtlIconClass="bx-chevron-left"
        className="custom-icon"
      />
    )

    const icon = container.querySelector('i')
    expect(icon?.className).toContain('custom-icon')
  })
})