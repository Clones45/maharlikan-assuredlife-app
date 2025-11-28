// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

/**
 * 🚫 HARD FILTER: completely silence Metro's "<anonymous>" ENOENT spam
 * This intercepts Metro’s symbolication routine that tries to read
 * nonexistent <anonymous> files during stack traces.
 */
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function (...args) {
  const filePath = args[0];
  if (
    typeof filePath === "string" &&
    (filePath.includes("<anonymous>") || filePath.includes("InternalBytecode"))
  ) {
    // Return a harmless empty string instead of throwing ENOENT
    return "";
  }
  return originalReadFileSync.apply(fs, args);
};

// ✅ Also silence console.error spam for redundancy
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("ENOENT") || args[0].includes("<anonymous>"))
  ) {
    return;
  }
  originalConsoleError(...args);
};

module.exports = config;
