module.exports = {
    testEnvironment: "jsdom",
    moduleNameMapper: {
      "^@/(.*)$": "<rootDir>/$1",
    },
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  };
  