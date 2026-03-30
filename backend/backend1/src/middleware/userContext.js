const path = require("path");
const os = require("os");

module.exports = (req, res, next) => {
  if (!req.user?.googleSub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.userBaseDir = path.join(
    os.homedir(),
    "Documents",
    "BillingSoftware",
    `google-${req.user.googleSub}`
  );

  next();
};
