// Minimal structured logger — same JSON-line format as server.js
const logger = {
  _write(level, message) {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), level, message: String(message) });
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

Parse.Cloud.beforeLogin(async request => {
  const { object: user } = request;
  user.set("isOnline", true);
  await user.save(null, { useMasterKey: true });
});

Parse.Cloud.afterLogout(async request => {
  try {
    const { object: session } = request;
    const user = session.get("user");
    user.set("isOnline", false);
    await user.save(null, { useMasterKey: true });
  } catch (err) {
    logger.error(`afterLogout error: ${err.message}`);
  }
});

Parse.Cloud.define("hello", async req => {
  Parse.Push.send(
    {
      where: {
        deviceType: {
          $in: ["ios", "android"],
        },
      },
      data: {
        alert: "Test",
        badge: 1,
        sound: "default",
      },
    },
    { useMasterKey: true },
  ).then(
    function () {
      logger.info("Sent");
    },
    function (error) {
      logger.error(`Push error: ${error}`);
    },
  );
  return "Hi";
});

const sleeper = async seconds => {
  return await new Promise(resolve => setTimeout(resolve("Hi"), seconds * 1000));
};

Parse.Cloud.job("myJob", async request => {
  const { params, headers, log, message } = request;
  try {
    const text = await Parse.Cloud.httpRequest({ url: "https://example.com" });
    message(text);
  } catch (err) {
    logger.error(`myJob error: ${err.message}`);
    message(err.message);
  }
});

Parse.Cloud.job("my2Job", async request => {
  const { message } = request;
  try {
    const params = { movie: "The Matrix" };
    const data = await Parse.Cloud.run("asyncFunction", params);
    message(data);
  } catch (err) {
    logger.error(`my2Job error: ${err.message}`);
    message(err.message);
  }
});

Parse.Cloud.define("asyncFunction", async req => {
  await new Promise(resolve => setTimeout(resolve, 120 * 1000));
  return "Hi asyncFunction";
});

Parse.Cloud.beforeSave("Test", async () => {
  throw new Parse.Error(9001, "Saving test objects is not available.");
});
