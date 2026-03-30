const express = require("express");
const router = express.Router();

const {
  getSettings,
  saveSettings,
} = require("../controllers/settingsController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getSettings);
router.put("/", protect, saveSettings);

module.exports = router;
