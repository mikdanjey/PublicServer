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
  const isAllowed = whitelist.includes(req.header("Origin"));
  const corsOptions = isAllowed ? { origin: true, credentials: true, optionsSuccessStatus: 200 } : { origin: false, credentials: false };

  callback(null, corsOptions);
};

app.use(cors(corsOptionsDelegate));

// Local Variables
const PORT = process.env.NODE_PORT || 1337;
const serverURL = process.env.PARSE_SERVER_URL || `http://localhost:${PORT}/parse`;
const databaseURI = process.env.PARSE_SERVER_DATABASE_URI;
const CLOUD_CODE_MAIN = process.env.PARSE_SERVER_CLOUD || path.join(__dirname, "cloud", "main.js");

// Parse Config
const apiParse = new ParseServer({
  databaseURI,
  cloud: CLOUD_CODE_MAIN,
  liveQuery: { classNames: ["Test"] },
  appId: process.env.PARSE_SERVER_APPLICATION_ID,
  javascriptKey: process.env.PARSE_SERVER_JAVASCRIPT_KEY,
  masterKey: process.env.PARSE_SERVER_MASTER_KEY,
  clientKey: process.env.PARSE_SERVER_CLIENT_KEY,
  fileKey: process.env.PARSE_SERVER_FILE_KEY,
  appName: process.env.PARSE_SERVER_APP_NAME,
  serverURL,
  mountPath: "/parse",
  allowClientClassCreation: true,
  allowExpiredAuthDataToken: false,
  encodeParseObjectInCloudFunction: true, // Future-proof
  enableInsecureAuthAdapters: false, // Future-proof
  logLevel: "info",
  silent: false,
});

// Parse Dashboard Config
const dashboardParse = new ParseDashboard(
  {
    apps: [
      {
        serverURL,
        appId: process.env.PARSE_SERVER_APPLICATION_ID,
        masterKey: process.env.PARSE_SERVER_MASTER_KEY,
        appName: process.env.PARSE_SERVER_APP_NAME,
      },
    ],
    users: [
      {
        user: process.env.PARSE_SERVER_USER,
        pass: process.env.PARSE_SERVER_PASSWORD,
        apps: [{ appId: process.env.PARSE_SERVER_APPLICATION_ID }],
      },
    ],
    useEncryptedPasswords: false,
    trustProxy: 1,
  },
  { allowInsecureHTTP: false },
);

// Routes
app.get("/", (req, res) => res.status(400).send("Not Found"));

app.use("/parse", apiParse.app);
app.use("/dashboard", dashboardParse);

// Server Start
app.listen(PORT, async () => {
  await apiParse.start();
  console.log(`REST API running on http://localhost:${PORT}/parse`);
  console.log(`Dashboard available at http://localhost:${PORT}/dashboard`);
});
