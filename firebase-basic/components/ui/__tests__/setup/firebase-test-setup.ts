// components/ui/__tests__/setup/firebase-test-setup.js
// This file provides mocked Firebase setup for testing

// Mock Firebase configuration
const firebaseConfig = {
    apiKey: "test-api-key",
    authDomain: "test-project.firebaseapp.com",
    projectId: "test-project",
    storageBucket: "test-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
  };
  
  // Mock Firebase services
  const mockAuth = {
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  };
  
  const mockDatabase = {
    ref: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn(() => Promise.resolve({ val: () => null })),
      remove: jest.fn(),
      push: jest.fn(() => ({ key: 'mock-key' })),
      on: jest.fn(),
      off: jest.fn(),
    })),
  };
  
  const mockFunctions = {
    httpsCallableFromURL: jest.fn(() => jest.fn()),
  };
  
  export const setupFirebaseTest = () => {
    return {
      auth: mockAuth,
      database: mockDatabase,
      functions: mockFunctions,
    };
  };
  
  export const cleanupFirebaseTest = async () => {
    // Reset all mocks
    jest.clearAllMocks();
    mockAuth.currentUser = null;
  };
  
  // Export mocks for individual use
  export { mockAuth, mockDatabase, mockFunctions };