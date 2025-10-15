// __mocks__/firebase-mocks.js

// Mock Firebase Auth
export const mockAuth = {
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  };
  
  // Mock Firebase Database  
  export const mockDatabase = {
    ref: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn(() => Promise.resolve({ val: () => null })),
      remove: jest.fn(),
      push: jest.fn(() => ({ key: 'mock-key' })),
      on: jest.fn(),
      off: jest.fn(),
    })),
  };
  
  // Mock Firebase Functions
  export const mockFunctions = {
    httpsCallableFromURL: jest.fn(() => jest.fn()),
  };
  
  // Firebase Auth mock
  jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(() => mockAuth),
    signInWithEmailAndPassword: jest.fn((...args) => mockAuth.signInWithEmailAndPassword(...args)),
    createUserWithEmailAndPassword: jest.fn((...args) => mockAuth.createUserWithEmailAndPassword(...args)),
    signOut: jest.fn((...args) => mockAuth.signOut(...args)),
    onAuthStateChanged: jest.fn((...args) => mockAuth.onAuthStateChanged(...args)),
    connectAuthEmulator: jest.fn(),
  }));
  
  // Firebase Database mock
  jest.mock('firebase/database', () => ({
    getDatabase: jest.fn(() => mockDatabase),
    ref: jest.fn((...args) => mockDatabase.ref(...args)),
    set: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
    push: jest.fn(),
    connectDatabaseEmulator: jest.fn(),
  }));
  
  // Firebase Functions mock
  jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(() => mockFunctions),
    httpsCallableFromURL: jest.fn((...args) => mockFunctions.httpsCallableFromURL(...args)),
    connectFunctionsEmulator: jest.fn(),
  }));
  
  // Firebase App mock
  jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(() => ({})),
    getApps: jest.fn(() => []),
  }));