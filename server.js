"use strict";

const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const ParseServer = require("parse-server").ParseServer;
const ParseDashboard = require("parse-dashboard");

dotenv.config();
const app = express();
const whitelist = ["http://localhost:5001"];

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
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.NODE_PORT || 1337;
const serverURL =
  process.env.PARSE_SERVER_URL || `http://localhost:${PORT}/parse`;
const databaseURI =
  process.env.PARSE_SERVER_DATABASE_URI ||
  "mongodb://localhost:27017/parseServer?retryWrites=true&w=majority";
const CLOUD_CODE_MAIN =
  process.env.PARSE_SERVER_CLOUD || path.join(__dirname, "cloud", "main.js");
// Info
const production = process.env.PARSE_SERVER_PRODUCTION || false;
const appId = process.env.PARSE_SERVER_APPLICATION_ID || "myAppId";
const javascriptKey =
  process.env.PARSE_SERVER_JAVASCRIPT_KEY || "myJavascriptKey";
const user = process.env.PARSE_SERVER_USER || "myUser";
const password = process.env.PARSE_SERVER_PASSWORD || "myPassword";
const appName = process.env.PARSE_SERVER_APP_NAME || "Sample App";
const fileKey = process.env.PARSE_SERVER_FILE_KEY || "myFileKey";
const masterKey = process.env.PARSE_SERVER_MASTER_KEY || "myMasterKey";
const clientKey = process.env.PARSE_SERVER_CLIENT_KEY || "myClientKey";

// Config
const apiParse = new ParseServer({
  databaseURI,
  cloud: CLOUD_CODE_MAIN,
  liveQuery: {
    classNames: ["Test", "Movies"],
  },
  websocketTimeout: 10 * 1000,
  appId,
  production,
  javascriptKey,
  mountPath: "/parse",
  logLevel: "info",
  port: PORT,
  user,
  password,
  appName,
  fileKey,
  masterKey,
  serverURL,
  silent: false,
  clientKey,
  allowClientClassCreation: true,
  allowExpiredAuthDataToken: false,
});

const dashboardParse = new ParseDashboard(
  {
    apps: [
      {
        serverURL: serverURL,
        appId: appId,
        masterKey: masterKey,
        appName: appName,
        production: production,
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
