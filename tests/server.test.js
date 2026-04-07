"use strict";

// Tests for pure helper functions extracted from server.js logic.
// We re-implement the same logic here to keep tests self-contained
// (server.js is a startup script and cannot be require()'d safely in tests).

const { test } = require("node:test");
const assert = require("node:assert/strict");

// ── parseCorsWhitelist ────────────────────────────────────────────────────────

function parseCorsWhitelist(str) {
  if (!str) return [];
  return str
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

test("parseCorsWhitelist returns empty array for empty string", () => {
  assert.deepEqual(parseCorsWhitelist(""), []);
});

test("parseCorsWhitelist returns empty array for undefined", () => {
  assert.deepEqual(parseCorsWhitelist(undefined), []);
});

test("parseCorsWhitelist parses single origin", () => {
  assert.deepEqual(parseCorsWhitelist("https://example.com"), ["https://example.com"]);
});

test("parseCorsWhitelist parses multiple origins", () => {
  assert.deepEqual(parseCorsWhitelist("https://a.com, https://b.com , https://c.com"), ["https://a.com", "https://b.com", "https://c.com"]);
});

test("parseCorsWhitelist filters empty segments from trailing comma", () => {
  assert.deepEqual(parseCorsWhitelist("https://a.com,"), ["https://a.com"]);
});

// ── validateEnv ───────────────────────────────────────────────────────────────

const REQUIRED_KEYS = [
  "NODE_PORT",
  "PARSE_SERVER_DATABASE_URI",
  "PARSE_SERVER_URL",
  "PARSE_SERVER_APPLICATION_ID",
  "PARSE_SERVER_MASTER_KEY",
  "PARSE_SERVER_CLIENT_KEY",
  "PARSE_SERVER_JAVASCRIPT_KEY",
  "PARSE_SERVER_FILE_KEY",
];

const PLACEHOLDERS = ["your-master-key-here"];

function validateEnv(env) {
  const invalid = REQUIRED_KEYS.filter(key => !env[key] || env[key].trim() === "");

  if (env.NODE_ENV === "production" && env.PARSE_SERVER_MASTER_KEY && PLACEHOLDERS.includes(env.PARSE_SERVER_MASTER_KEY)) {
    if (!invalid.includes("PARSE_SERVER_MASTER_KEY")) {
      invalid.push("PARSE_SERVER_MASTER_KEY");
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Missing or invalid environment variables: ${invalid.join(", ")}`);
  }
}

function validEnv(overrides = {}) {
  return {
    NODE_PORT: "1337",
    PARSE_SERVER_DATABASE_URI: "mongodb://localhost:27017/test",
    PARSE_SERVER_URL: "http://localhost:1337/parse",
    PARSE_SERVER_APPLICATION_ID: "appId",
    PARSE_SERVER_MASTER_KEY: "secret",
    PARSE_SERVER_CLIENT_KEY: "clientKey",
    PARSE_SERVER_JAVASCRIPT_KEY: "jsKey",
    PARSE_SERVER_FILE_KEY: "fileKey",
    ...overrides,
  };
}

test("validateEnv passes with all required vars present", () => {
  assert.doesNotThrow(() => validateEnv(validEnv()));
});

test("validateEnv throws when a required var is missing", () => {
  const env = validEnv();
  delete env.NODE_PORT;
  assert.throws(() => validateEnv(env), /NODE_PORT/);
});

test("validateEnv throws when a required var is empty string", () => {
  assert.throws(() => validateEnv(validEnv({ PARSE_SERVER_APPLICATION_ID: "" })), /PARSE_SERVER_APPLICATION_ID/);
});

test("validateEnv throws when a required var is whitespace only", () => {
  assert.throws(() => validateEnv(validEnv({ PARSE_SERVER_MASTER_KEY: "   " })), /PARSE_SERVER_MASTER_KEY/);
});

test("validateEnv throws for placeholder master key in production", () => {
  assert.throws(() => validateEnv(validEnv({ NODE_ENV: "production", PARSE_SERVER_MASTER_KEY: "your-master-key-here" })), /PARSE_SERVER_MASTER_KEY/);
});

test("validateEnv allows placeholder master key outside production", () => {
  assert.doesNotThrow(() => validateEnv(validEnv({ NODE_ENV: "development", PARSE_SERVER_MASTER_KEY: "your-master-key-here" })));
});

test("validateEnv reports all missing variables at once", () => {
  const env = validEnv();
  delete env.NODE_PORT;
  delete env.PARSE_SERVER_CLIENT_KEY;
  let msg = "";
  try {
    validateEnv(env);
  } catch (err) {
    msg = err.message;
  }
  assert.ok(msg.includes("NODE_PORT"), "should mention NODE_PORT");
  assert.ok(msg.includes("PARSE_SERVER_CLIENT_KEY"), "should mention PARSE_SERVER_CLIENT_KEY");
});
