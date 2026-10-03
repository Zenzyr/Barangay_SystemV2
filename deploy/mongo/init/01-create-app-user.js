const dbName = process.env.MONGO_APP_DATABASE;
const user = process.env.MONGO_APP_USERNAME;
const pwd = process.env.MONGO_APP_PASSWORD;

if (!dbName || !user || !pwd) {
  throw new Error("MONGO_APP_DATABASE, MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be set");
}

const appDb = db.getSiblingDB(dbName);
if (!appDb.getUser(user)) {
  appDb.createUser({ user, pwd, roles: [{ role: "readWrite", db: dbName }] });
  print(`Created application user for database ${dbName}`);
}
