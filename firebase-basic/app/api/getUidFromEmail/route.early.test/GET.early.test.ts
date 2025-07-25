
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { GET } from '../route';


// firebase-basic/app/api/getUidFromEmail/route.test.ts


// firebase-basic/app/api/getUidFromEmail/route.test.ts
// --- Mocks ---

// Mock for admin.app.App
interface MockApp {
  name: string;
  options: object;
}

// Mock for Auth
class MockAuth {
  public getUserByEmail = jest.fn();
}

// --- Jest Mocks for External Modules ---

// Mock admin
jest.mock("firebase-admin", () => {
  // Simulate the admin.apps array and initializeApp
  let apps: MockApp[] = [];
  return {
    __esModule: true,
    default: {
      apps,
      initializeApp: jest.fn(() => {
        const app: MockApp = { name: 'mockApp', options: {} };
        apps.push(app);
        return app;
      }),
    },
  };
});

// Mock getAuth from firebase-admin/auth
jest.mock("firebase-admin/auth", () => {
  return {
    getAuth: jest.fn(),
  };
});

const mockedGetAuth = jest.mocked(getAuth);
const mockedAdmin = admin as any;

// --- Test Suite ---

describe('GET() GET method', () => {
  // Reset mocks before each test
  beforeEach(() => {
    // Reset admin.apps and initializeApp
    mockedAdmin.apps.length = 0;
    jest.clearAllMocks();
  });

  // --- Happy Paths ---

  it('should return 200 and uid when email is provided and user exists', async () => {
    // This test ensures that GET returns the correct uid for a valid email.

    // Arrange
    const testEmail = 'test@example.com';
    const testUid = 'uid-123';
    const mockAuth = new MockAuth();
    mockAuth.getUserByEmail = jest.fn().mockResolvedValue({ uid: testUid } as any);
    mockedGetAuth.mockReturnValue(mockAuth as any);

    const url = `https://localhost/api/getUidFromEmail?email=${encodeURIComponent(testEmail)}`;
    const req = { url } as Request;

    // Act
    const res = await GET(req as any);

    // Assert
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ uid: testUid });
    expect(mockedGetAuth).toHaveBeenCalled();
    expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
  });

  it('should initialize admin app if not already initialized', async () => {
    // This test ensures that admin.initializeApp is called if admin.apps is empty.

    // Arrange
    const testEmail = 'init@example.com';
    const testUid = 'uid-init';
    const mockAuth = new MockAuth();
    mockAuth.getUserByEmail = jest.fn().mockResolvedValue({ uid: testUid } as any);
    mockedGetAuth.mockReturnValue(mockAuth as any);

    // Ensure apps is empty
    mockedAdmin.apps.length = 0;

    const req = { url: `https://localhost/api/getUidFromEmail?email=${encodeURIComponent(testEmail)}` } as Request;

    // Act
    await GET(req as any);

    // Assert
    expect(admin.initializeApp).toHaveBeenCalled();
    expect(mockedAdmin.apps.length).toBeGreaterThan(0);
  });

  it('should not re-initialize admin app if already initialized', async () => {
    // This test ensures that admin.initializeApp is not called if admin.apps is not empty.

    // Arrange
    const testEmail = 'alreadyinit@example.com';
    const testUid = 'uid-alreadyinit';
    const mockAuth = new MockAuth();
    mockAuth.getUserByEmail = jest.fn().mockResolvedValue({ uid: testUid } as any);
    mockedGetAuth.mockReturnValue(mockAuth as any);

    // Simulate already initialized
    mockedAdmin.apps.length = 1;

    const req = { url: `https://localhost/api/getUidFromEmail?email=${encodeURIComponent(testEmail)}` } as Request;

    // Act
    await GET(req as any);

    // Assert
    expect(admin.initializeApp).not.toHaveBeenCalled();
  });

  // --- Edge Cases ---

  it('should return 400 if email is missing from query params', async () => {
    // This test ensures that GET returns 400 if the email parameter is missing.

    // Arrange
    const req = { url: 'https://localhost/api/getUidFromEmail' } as Request;

    // Act
    const res = await GET(req as any);

    // Assert
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: 'Missing email' });
    expect(mockedGetAuth).not.toHaveBeenCalled();
  });

  it('should return 404 if user is not found', async () => {
    // This test ensures that GET returns 404 if getUserByEmail throws an error.

    // Arrange
    const testEmail = 'notfound@example.com';
    const mockAuth = new MockAuth();
    mockAuth.getUserByEmail = jest.fn().mockRejectedValue(new Error('User not found') as never);
    mockedGetAuth.mockReturnValue(mockAuth as any);

    const req = { url: `https://localhost/api/getUidFromEmail?email=${encodeURIComponent(testEmail)}` } as Request;

    // Act
    const res = await GET(req as any);

    // Assert
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: 'User not found' });
    expect(mockedGetAuth).toHaveBeenCalled();
    expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
  });

  it('should handle email param with special characters', async () => {
    // This test ensures that GET correctly handles emails with special characters.

    // Arrange
    const testEmail = 'user+test@domain.com';
    const testUid = 'uid-special';
    const mockAuth = new MockAuth();
    mockAuth.getUserByEmail = jest.fn().mockResolvedValue({ uid: testUid } as any);
    mockedGetAuth.mockReturnValue(mockAuth as any);

    const req = { url: `https://localhost/api/getUidFromEmail?email=${encodeURIComponent(testEmail)}` } as Request;

    // Act
    const res = await GET(req as any);

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ uid: testUid });
    expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
  });

  it('should handle multiple query params and extract correct email', async () => {
    // This test ensures that GET extracts the correct email when multiple query params are present.

    // Arrange
    const testEmail = 'multi@param.com';
    const testUid = 'uid-multi';
    const mockAuth = new MockAuth();
    mockAuth.getUserByEmail = jest.fn().mockResolvedValue({ uid: testUid } as any);
    mockedGetAuth.mockReturnValue(mockAuth as any);

    const req = {
      url: `https://localhost/api/getUidFromEmail?foo=bar&email=${encodeURIComponent(testEmail)}&baz=qux`,
    } as Request;

    // Act
    const res = await GET(req as any);

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ uid: testUid });
    expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(testEmail);
  });

  it('should handle empty string as email param', async () => {
    // This test ensures that GET returns 400 if email param is an empty string.

    // Arrange
    const req = { url: 'https://localhost/api/getUidFromEmail?email=' } as Request;

    // Act
    const res = await GET(req as any);

    // Assert
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: 'Missing email' });
    expect(mockedGetAuth).not.toHaveBeenCalled();
  });
});