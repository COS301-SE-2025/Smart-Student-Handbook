// jest.setup.js
require('@testing-library/jest-dom');

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(),
    keys: jest.fn(),
    values: jest.fn(),
    entries: jest.fn(),
    forEach: jest.fn(),
    toString: jest.fn(),
  }),
  usePathname: () => '',
  useParams: () => ({}),
}));

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
  EmailAuthProvider: {
    credential: jest.fn(),
  },
  reauthenticateWithCredential: jest.fn(),
  updatePassword: jest.fn(),
  updateProfile: jest.fn(),
}));

// Mock Firebase Database
jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  remove: jest.fn(),
  push: jest.fn(),
  getDatabase: jest.fn(),
  onValue: jest.fn(),
}));

// Mock Firebase Functions
jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
  httpsCallableFromURL: jest.fn(),
  getFunctions: jest.fn(),
}));

// Mock Firebase App
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));

// Global test utilities
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};