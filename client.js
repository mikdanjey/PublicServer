const dotenv = require("dotenv");
dotenv.config();

// const Parse = require('parse'); // browser based application
const Parse = require("parse/node");

const PORT = process.env.NODE_PORT || 1337;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}/parse`;
Parse.serverURL = SERVER_URL;

async function initialize() {
  Parse.initialize("myAppId", "myJavascriptKey");
  const myObj = new Parse.Object("MyClass");
  myObj.set("myField", "Hello World!");
  await myObj.save();
  console.log(myObj);

  const MyClass = Parse.Object.extend("MyClass");
  const query = new Parse.Query(MyClass);

  const results = await query.find();

  console.log(results);
}

initialize();
