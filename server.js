const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const ParseServer = require("parse-server").ParseServer;
const ParseDashboard = require("parse-dashboard");

dotenv.config();

// Validates required env vars; throws with list of missing/invalid names on failure
function validateEnv(env) {
  const required = [
    "NODE_PORT",
    "PARSE_SERVER_DATABASE_URI",
    "PARSE_SERVER_URL",
    "PARSE_SERVER_APPLICATION_ID",
    "PARSE_SERVER_MASTER_KEY",
    "PARSE_SERVER_CLIENT_KEY",
    "PARSE_SERVER_JAVASCRIPT_KEY",
    "PARSE_SERVER_FILE_KEY",
  ];

  const placeholders = ["your-master-key-here"];

  const invalid = required.filter(key => !env[key] || env[key].trim() === "");

  if (env.NODE_ENV === "production" && env.PARSE_SERVER_MASTER_KEY && placeholders.includes(env.PARSE_SERVER_MASTER_KEY)) {
    if (!invalid.includes("PARSE_SERVER_MASTER_KEY")) {
      invalid.push("PARSE_SERVER_MASTER_KEY");
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Missing or invalid environment variables: ${invalid.join(", ")}`);
  }
}

validateEnv(process.env);

// Parses a comma-separated CORS whitelist string into an array of trimmed, non-empty strings
function parseCorsWhitelist(str) {
  if (!str) return [];
  return str
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

// Ensure log directory exists before server starts
const logDir = path.join(__dirname, "logs");
fs.mkdirSync(logDir, { recursive: true });

// Minimal structured logger — writes JSON lines to stdout, redacts sensitive values
const logger = {
  _redact(message) {
    let out = String(message);
    const masterKey = process.env.PARSE_SERVER_MASTER_KEY;
    const password = process.env.PARSE_SERVER_PASSWORD;
    if (masterKey) out = out.split(masterKey).join("[REDACTED]");
    if (password) out = out.split(password).join("[REDACTED]");
    return out;
  },
  _write(level, message) {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), level, message: this._redact(message) });
    process.stdout.write(line + "\n");
  },
  info(message) {
    this._write("info", message);
  },
  warn(message) {
    this._write("warn", message);
  },
  error(message) {
    this._write("error", message);
  },
};

// Builds the ParseServer config object from env
function buildParseConfig(env) {
  const isProduction = env.NODE_ENV === "production";
  const serverURL = env.PARSE_SERVER_URL || `http://localhost:${env.NODE_PORT || 1337}/parse`;
  const databaseURI = env.PARSE_SERVER_DATABASE_URI;
  const CLOUD_CODE_MAIN = env.PARSE_SERVER_CLOUD || path.join(__dirname, "cloud", "main.js");

  return {
    databaseURI,
    cloud: CLOUD_CODE_MAIN,
    liveQuery: { classNames: ["Test"] },
    appId: env.PARSE_SERVER_APPLICATION_ID,
    javascriptKey: env.PARSE_SERVER_JAVASCRIPT_KEY,
    masterKey: env.PARSE_SERVER_MASTER_KEY,
    clientKey: env.PARSE_SERVER_CLIENT_KEY,
    fileKey: env.PARSE_SERVER_FILE_KEY,
    appName: env.PARSE_SERVER_APP_NAME,
    serverURL,
    mountPath: "/parse",
    allowClientClassCreation: !isProduction,
    allowExpiredAuthDataToken: false,
    enableInsecureAuthAdapters: false,
    logLevel: isProduction ? "error" : "info",
    silent: false,
    databaseOptions: { maxPoolSize: 10 },
    // Silence deprecation warnings by setting future defaults explicitly
    fileUpload: { allowedFileUrlDomains: [] },
    pages: { encodePageParamHeaders: true },
    readOnlyMasterKeyIps: ["127.0.0.1", "::1"],
    requestComplexity: {
      includeDepth: 10,
      includeCount: 100,
      subqueryDepth: 10,
      queryDepth: 10,
      graphQLDepth: 20,
      graphQLFields: 200,
      batchRequestLimit: 100,
    },
    protectedFieldsOwnerExempt: false,
    protectedFieldsTriggerExempt: true,
    protectedFieldsSaveResponseExempt: false,
  };
}

// Builds the ParseDashboard config object from env
function buildDashboardConfig(env) {
  const isProduction = env.NODE_ENV === "production";
  const serverURL = env.PARSE_SERVER_URL || `http://localhost:${env.NODE_PORT || 1337}/parse`;

  return {
    apps: [
      {
        serverURL,
        appId: env.PARSE_SERVER_APPLICATION_ID,
        masterKey: env.PARSE_SERVER_MASTER_KEY,
        appName: env.PARSE_SERVER_APP_NAME,
        serverInfo: { serverURL },
      },
    ],
    users: [
      {
        user: env.PARSE_SERVER_USER,
        pass: env.PARSE_SERVER_PASSWORD,
        apps: [{ appId: env.PARSE_SERVER_APPLICATION_ID }],
      },
    ],
    useEncryptedPasswords: true,
    trustProxy: 1,
    allowInsecureHTTP: !isProduction,
  };
}

const app = express();
const whitelist = parseCorsWhitelist(process.env.CORS_WHITELIST);

const corsOptionsDelegate = (req, callback) => {
  const isAllowed = whitelist.includes(req.header("Origin"));
  const corsOptions = isAllowed ? { origin: true, credentials: true, optionsSuccessStatus: 200 } : { origin: false, credentials: false };

  callback(null, corsOptions);
};

app.use(cors(corsOptionsDelegate));

// Local Variables
const PORT = process.env.NODE_PORT || 1337;

// Parse Config
const apiParse = new ParseServer(buildParseConfig(process.env));

// Parse Dashboard Config
const dashboardParse = new ParseDashboard(buildDashboardConfig(process.env), { allowInsecureHTTP: process.env.NODE_ENV !== "production" });

// Routes
app.get("/", (req, res) => res.status(404).send("Not Found"));

app.get("/health", async (req, res) => {
  try {
    // Check DB connectivity via Parse Server's database controller
    await apiParse.config.databaseController.find("_User", {}, { limit: 0 });
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: "error", reason: "database unavailable" });
  }
});

app.use("/parse", apiParse.app);
app.use("/dashboard", dashboardParse);

// Server Start
const httpServer = app.listen(PORT, async () => {
  await apiParse.start();

  // MongoDB connection event listeners
  const db = apiParse.config.databaseController.adapter;
  if (db && db.client) {
    db.client.on("serverClosed", () => {
      logger.error("MongoDB disconnected");
    });
    db.client.on("topologyOpening", () => {
      logger.info("MongoDB reconnected");
    });
  }

  logger.info(`REST API running on http://localhost:${PORT}/parse`);
  logger.info(`Dashboard available at http://localhost:${PORT}/dashboard`);
});

// Graceful shutdown
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  const forceExit = setTimeout(() => {
    logger.warn("Graceful shutdown timed out after 10s, forcing exit");
    process.exit(0);
  }, 10000);
  forceExit.unref();
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Global error handlers
process.on("uncaughtException", err => {
  logger.error(`Uncaught exception: ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on("unhandledRejection", reason => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  logger.error(`Unhandled rejection: ${msg}`);
  process.exit(1);
});
