const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const ParseServer = require("parse-server").ParseServer;
const ParseDashboard = require("parse-dashboard");

dotenv.config();
const app = express();
const whitelist = ["http://localhost:3000"];

const corsOptionsDelegate = (req, callback) => {
  let corsOptions;
  if (whitelist.indexOf(req.header("Origin")) !== -1) {
    corsOptions = {
      origin: true,
      credentials: true,
      optionsSuccessStatus: 200,
    };
  } else {
    corsOptions = { origin: false, credentials: false };
  }
  corsOptions = { origin: true, credentials: true, optionsSuccessStatus: 200 }; // TODO: Temp
  callback(null, corsOptions);
};

app.use(cors(corsOptionsDelegate));

// local variables
const PORT = process.env.NODE_PORT || 1337;
const serverURL = process.env.PARSE_SERVER_URL || `http://localhost:${PORT}/parse`;
const databaseURI = process.env.PARSE_SERVER_DATABASE_URI;
const CLOUD_CODE_MAIN = process.env.PARSE_SERVER_CLOUD || path.join(__dirname, "cloud", "main.js");
// Info
const appId = process.env.PARSE_SERVER_APPLICATION_ID;
const masterKey = process.env.PARSE_SERVER_MASTER_KEY;
const javascriptKey = process.env.PARSE_SERVER_JAVASCRIPT_KEY;
const clientKey = process.env.PARSE_SERVER_CLIENT_KEY;
const fileKey = process.env.PARSE_SERVER_FILE_KEY;
const appName = process.env.PARSE_SERVER_APP_NAME;
const user = process.env.PARSE_SERVER_USER;
const password = process.env.PARSE_SERVER_PASSWORD;

// Config
const apiParse = new ParseServer({
  databaseURI,
  cloud: CLOUD_CODE_MAIN,
  liveQuery: {
    classNames: ["Test"],
  },
  appId,
  javascriptKey,
  mountPath: "/parse",
  logLevel: "info",
  port: PORT,
  appName,
  fileKey,
  masterKey,
  serverURL,
  silent: false,
  clientKey,
  allowClientClassCreation: true,
  allowExpiredAuthDataToken: false,
  encodeParseObjectInCloudFunction: true, // Future-proof
  enableInsecureAuthAdapters: false, // Future-proof
  pages: { enableRouter: false },
});

const dashboardParse = new ParseDashboard(
  {
    apps: [
      {
        serverURL: serverURL,
        appId: appId,
        masterKey: masterKey,
        appName: appName,
      },
    ],
    users: [
      {
        user: user,
        pass: password,
        apps: [{ appId: appId }],
      },
      {
        user: "user",
        pass: "user",
        readOnly: true,
        mfa: "lmvmOIZGMTQklhOIhveqkumss",
      },
    ],
    useEncryptedPasswords: false,
    trustProxy: 1,
  },
  { allowInsecureHTTP: true },
);

app.get("/", (req, res) => {
  res.status(400).send("Not Found");
});

app.use("/parse", apiParse.app);
app.use("/dashboard", dashboardParse);

app.listen(PORT, async () => {
  await apiParse.start();
  console.log(`REST API running on http://localhost:${PORT}/parse`);
});
