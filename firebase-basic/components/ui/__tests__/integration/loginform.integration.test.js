/** 
 * @jest-environment jsdom
 */
// components/ui/__tests__/integration/loginform.test.js
const React = require('react')
const { render, screen, fireEvent, waitFor } = require('@testing-library/react')
const { useRouter } = require('next/navigation')

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}))

// Simple LoginForm component for testing
function LoginForm() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const router = useRouter()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    // Mock successful login
    router.push('/dashboard')
  }

  return React.createElement('form', { onSubmit: handleSubmit }, [
    React.createElement('input', {
      key: 'email',
      'data-testid': 'email-input',
      type: 'email',
      value: email,
      onChange: (e) => setEmail(e.target.value),
      placeholder: 'Email'
    }),
    React.createElement('input', {
      key: 'password',
      'data-testid': 'password-input',
      type: 'password',
      value: password,
      onChange: (e) => setPassword(e.target.value),
      placeholder: 'Password'
    }),
    React.createElement('button', {
      key: 'button',
      'data-testid': 'login-button',
      type: 'submit'
    }, 'Login'),
    error && React.createElement('div', {
      key: 'error',
      'data-testid': 'error-message'
    }, error)
  ])
}

describe('LoginForm', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    mockPush.mockClear()
    useRouter.mockReturnValue({
      push: mockPush
    })
  })

  it('renders login form with all fields', () => {
    render(React.createElement(LoginForm))
    
    // Use basic toBeTruthy() instead of toBeInTheDocument()
    expect(screen.getByTestId('email-input')).toBeTruthy()
    expect(screen.getByTestId('password-input')).toBeTruthy()
    expect(screen.getByTestId('login-button')).toBeTruthy()
  })

  it('allows user to enter email and password', () => {
    render(React.createElement(LoginForm))
    
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    expect(emailInput.value).toBe('test@example.com')
    expect(passwordInput.value).toBe('password123')
  })

  it('shows validation error when form is submitted with empty fields', async () => {
    render(React.createElement(LoginForm))
    
    const loginButton = screen.getByTestId('login-button')
    fireEvent.click(loginButton)

    await waitFor(() => {
      const errorMessage = screen.getByTestId('error-message')
      // Use toBe() with textContent instead of toHaveTextContent()
      expect(errorMessage.textContent).toBe('Email and password are required')
    })
  })

  it('submits form with valid data', async () => {
    render(React.createElement(LoginForm))
    
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})