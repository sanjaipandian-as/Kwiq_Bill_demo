const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { triggerBackup, getBackupStatus, syncEvent, triggerSync } = require("../controllers/backupController");

router.post("/trigger", protect, triggerBackup);
router.get("/status", protect, getBackupStatus);
router.post("/event", protect, syncEvent);
router.post("/sync", protect, triggerSync);
router.post("/push-all", protect, require("../controllers/backupController").pushAllData);

module.exports = router;
