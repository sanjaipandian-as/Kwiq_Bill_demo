const { initDB } = require("./index");

async function withDB(req) {
  if (!req.user || !req.user.googleSub) {
    throw new Error("User not authenticated");
  }
  return initDB(req.user.googleSub);
  console.log(dbpath)
}

module.exports = { withDB };
    