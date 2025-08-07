// __tests__/userSettings.test.ts
import { updateUserSettings } from "../lib/userSettings";

jest.mock("../lib/firebase", () => ({
  db: {
    ref: jest.fn((path) => ({ key: path.split("/").pop(), toString: () => path })), // Simulate a Firebase reference
  },
}));

jest.mock("firebase/database", () => ({
  ref: jest.fn((db, path) => ({ key: path.split("/").pop(), toString: () => path })), // Mock ref for direct imports
  set: jest.fn().mockResolvedValue(true), // Mock set to resolve with true
}));

describe("updateUserSettings", () => {
  it("should update settings and return true", async () => {
    const result = await updateUserSettings("ndhlovutanaka02@gmail.com", { theme: "dark" });
    expect(result).toBe(true);
    expect(require("firebase/database").set).toHaveBeenCalledWith(
      expect.objectContaining({ toString: expect.any(Function), key: "UserSettings" }),
      { theme: "dark" }
    );
  });
});