const { TextEncoder, TextDecoder } = require('util');

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

require('@testing-library/jest-dom');

// Mock Next.js router
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
    get: jest.fn(() => null),
    has: jest.fn(() => false),
  }),
  useParams: () => ({
    id: 'test-id'
  }),
  usePathname: () => '/test-path',
}));

// Create proper mock snapshot
const createMockSnapshot = (data = {}, exists = true) => ({
  exists: jest.fn(() => exists),
  val: jest.fn(() => data),
  key: 'mock-key',
  ref: { key: 'mock-ref' }
});

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: { uid: 'user123', email: 'test@example.com' }
  },
  db: {},
  fns: {},
  app: {},
  getDatabase: jest.fn(() => ({})),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ 
    currentUser: { uid: 'user123', email: 'test@example.com' }
  })),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  browserLocalPersistence: {},
  setPersistence: jest.fn(() => Promise.resolve()),
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn(() => ({ key: 'mockRef' })),
  get: jest.fn(() => Promise.resolve(createMockSnapshot({}))),
  onValue: jest.fn((ref, callback) => {
    // Simulate calling the callback with mock data
    setTimeout(() => {
      callback(createMockSnapshot({}));
    }, 0);
    return jest.fn(); // unsubscribe function
  }),
  remove: jest.fn(() => Promise.resolve()),
  set: jest.fn(() => Promise.resolve()),
  off: jest.fn(),
  push: jest.fn(() => Promise.resolve({ key: 'new-key' })),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ 
    data: { data: [] } // Mock proper response structure
  }))),
}));

// Mock hooks
jest.mock('@/hooks/useUserId', () => ({
  useUserId: jest.fn(() => ({ userId: 'user123', loading: false })),
}));

// Mock Sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock components that cause issues - Use proper React import
jest.mock('@/components/quilleditor', () => {
  const mockReact = require('react');
  return function MockQuillEditor({ value, onChange }) {
    return mockReact.createElement('div', {
      'data-testid': 'quill-editor',
      'data-value': value,
      onClick: () => onChange && onChange('<p>Test content</p>')
    });
  };
});

jest.mock('@/components/ui/page-header', () => {
  const mockReact = require('react');
  return {
    PageHeader: ({ title, description }) => mockReact.createElement('div', null,
      mockReact.createElement('h1', null, title),
      mockReact.createElement('p', null, description)
    ),
  };
});

jest.mock('@/components/ui/create-organization-modal', () => {
  const mockReact = require('react');
  return {
    CreateOrganizationModal: () => mockReact.createElement('div', {
      'data-testid': 'create-org-modal'
    }, 'Create Organization Modal'),
  };
});

jest.mock('@/components/ui/addfriendmodal', () => {
  const mockReact = require('react');
  return function MockAddFriendModal() {
    return mockReact.createElement('div', {
      'data-testid': 'add-friend-modal'
    }, 'Add Friend Modal');
  };
});

// Mock other problematic components
jest.mock('@/components/ui/student-calendar', () => {
  const mockReact = require('react');
  return function MockStudentCalendar() {
    return mockReact.createElement('div', {
      'data-testid': 'student-calendar'
    }, 'Student Calendar');
  };
});

jest.mock('@/components/editor', () => {
  const mockReact = require('react');
  return function MockEditor({ content, onContentChange }) {
    return mockReact.createElement('div', {
      'data-testid': 'tiptap-editor',
      onClick: () => onContentChange && onContentChange('<p>Test content</p>')
    });
  };
});

// Mock Radix UI components that might cause issues
jest.mock('@radix-ui/react-dialog', () => ({
  Dialog: ({ children, open, onOpenChange }) => {
    const mockReact = require('react');
    return open ? mockReact.createElement('div', { 'data-testid': 'dialog' }, children) : null;
  },
  DialogContent: ({ children }) => {
    const mockReact = require('react');
    return mockReact.createElement('div', { 'data-testid': 'dialog-content' }, children);
  },
  DialogHeader: ({ children }) => {
    const mockReact = require('react');
    return mockReact.createElement('div', { 'data-testid': 'dialog-header' }, children);
  },
  DialogTitle: ({ children }) => {
    const mockReact = require('react');
    return mockReact.createElement('h2', { 'data-testid': 'dialog-title' }, children);
  },
  DialogFooter: ({ children }) => {
    const mockReact = require('react');
    return mockReact.createElement('div', { 'data-testid': 'dialog-footer' }, children);
  },
  DialogTrigger: ({ children }) => {
    const mockReact = require('react');
    return mockReact.createElement('div', { 'data-testid': 'dialog-trigger' }, children);
  },
}));

// Mock window APIs
global.confirm = jest.fn(() => true);

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock additional browser APIs
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => []),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
}));

// Mock HTMLElement scrollIntoView
global.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock document methods
Object.defineProperty(document, 'elementFromPoint', {
  writable: true,
  value: jest.fn(() => null),
});

// Suppress console warnings during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (
      args[0].includes('React does not recognize') ||
      args[0].includes('Warning: Each child in a list') ||
      args[0].includes('Warning: Function components cannot be given refs')
    )
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};