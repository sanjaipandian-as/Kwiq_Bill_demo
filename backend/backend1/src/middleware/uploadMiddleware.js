const multer = require("multer");
const path = require("path");

module.exports = function (googleSub) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(
          require("os").homedir(),
          "Documents",
          "BillingSoftware",
          `google-${googleSub}`,
          "uploads",
          "receipts"
        );
        require("fs").mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
      },
    }),
  });
};
