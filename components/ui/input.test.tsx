import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input Component', () => {
  it('renders input element', () => {
    render(<Input placeholder="Enter text" />)
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
  })

  it('applies default variant styles', () => {
    render(<Input placeholder="Default" />)
    const input = screen.getByPlaceholderText('Default')
    expect(input).toHaveClass('bg-gray-900/80')
    expect(input).toHaveClass('border-gray-700')
  })

  it('applies terminal variant styles', () => {
    render(<Input variant="terminal" placeholder="Terminal" />)
    const input = screen.getByPlaceholderText('Terminal')
    expect(input).toHaveClass('bg-black')
    expect(input).toHaveClass('border-gray-800')
    expect(input).toHaveClass('font-mono')
    expect(input).toHaveClass('text-cyan-400')
  })

  it('handles text input correctly', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement

    await user.type(input, 'Hello World')
    expect(input.value).toBe('Hello World')
  })

  it('handles onChange events', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(<Input placeholder="Change test" onChange={handleChange} />)
    const input = screen.getByPlaceholderText('Change test')

    await user.type(input, 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  it('respects disabled state', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(<Input placeholder="Disabled" disabled onChange={handleChange} />)
    const input = screen.getByPlaceholderText('Disabled')

    expect(input).toBeDisabled()
    await user.type(input, 'test')
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Input placeholder="Custom" className="custom-class" />)
    const input = screen.getByPlaceholderText('Custom')
    expect(input).toHaveClass('custom-class')
  })

  it('supports different input types', () => {
    const { rerender } = render(<Input type="email" placeholder="Email" />)
    let input = screen.getByPlaceholderText('Email')
    expect(input).toHaveAttribute('type', 'email')

    rerender(<Input type="password" placeholder="Password" />)
    input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')

    rerender(<Input type="number" placeholder="Number" />)
    input = screen.getByPlaceholderText('Number')
    expect(input).toHaveAttribute('type', 'number')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Input ref={ref} placeholder="Ref input" />)
    expect(ref).toHaveBeenCalled()
  })

  it('supports native input attributes', () => {
    render(
      <Input
        placeholder="Native attrs"
        name="username"
        maxLength={20}
        required
        autoComplete="username"
      />
    )
    const input = screen.getByPlaceholderText('Native attrs')
    expect(input).toHaveAttribute('name', 'username')
    expect(input).toHaveAttribute('maxLength', '20')
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('autoComplete', 'username')
  })

  it('handles value prop (controlled input)', () => {
    const { rerender } = render(<Input value="initial" onChange={() => {}} />)
    const input = screen.getByDisplayValue('initial') as HTMLInputElement
    expect(input.value).toBe('initial')

    rerender(<Input value="updated" onChange={() => {}} />)
    expect(input.value).toBe('updated')
  })

  it('handles defaultValue prop (uncontrolled input)', () => {
    render(<Input defaultValue="default text" />)
    const input = screen.getByDisplayValue('default text') as HTMLInputElement
    expect(input.value).toBe('default text')
  })

  it('supports aria attributes for accessibility', () => {
    render(
      <Input
        placeholder="Accessible"
        aria-label="Username input"
        aria-describedby="username-help"
        aria-invalid={true}
      />
    )
    const input = screen.getByLabelText('Username input')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-describedby', 'username-help')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('maintains focus classes on focus', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Focus test" />)
    const input = screen.getByPlaceholderText('Focus test')

    await user.click(input)
    expect(input).toHaveFocus()
  })

  it('clears input value', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Clear test" />)
    const input = screen.getByPlaceholderText('Clear test') as HTMLInputElement

    await user.type(input, 'text to clear')
    expect(input.value).toBe('text to clear')

    await user.clear(input)
    expect(input.value).toBe('')
  })
})
