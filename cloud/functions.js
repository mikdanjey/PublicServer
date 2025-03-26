Parse.Cloud.beforeLogin(async request => {
  const { object: user } = request;
  user.set("isOnline", true);
  await user.save(null, { useMasterKey: true });
});

Parse.Cloud.afterLogout(async request => {
  const { object: session } = request;
  const user = session.get("user");
  await user.set("isOnline", false);
  user.save(null, { useMasterKey: true });
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
      console.log("Sent");
    },
    function (error) {
      console.log("error, error");
    },
  );
  return "Hi";
});

const sleeper = async seconds => {
  return await new Promise(resolve => setTimeout(resolve("Hi"), seconds * 1000));
};

Parse.Cloud.job("myJob", async request => {
  const { params, headers, log, message } = request;
  const text = await Parse.Cloud.httpRequest({ url: "https://example.com" });
  message(text);
});

Parse.Cloud.job("my2Job", async request => {
  const { message } = request;
  const params = { movie: "The Matrix" };
  const data = await Parse.Cloud.run("asyncFunction", params);
  message(data);
});

Parse.Cloud.define("asyncFunction", async req => {
  await new Promise(resolve => setTimeout(resolve, 120 * 1000));
  return "Hi asyncFunction";
});

Parse.Cloud.beforeSave("Test", async () => {
  throw new Parse.Error(9001, "Saving test objects is not available.");
});
