// jest.d.ts
import '@testing-library/jest-dom'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R
      toHaveValue(value: any): R
    }
  }
}