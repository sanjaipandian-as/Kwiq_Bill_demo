const fs = require("fs");
const path = require("path");

function exportReport({ userBaseDir, name, data }) {
  const exportDir = path.join(userBaseDir, "exports");
  fs.mkdirSync(exportDir, { recursive: true });

  const filePath = path.join(
    exportDir,
    `${name}-${new Date().toISOString().slice(0, 10)}.json`
  );

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

  return filePath;
}

module.exports = { exportReport };
