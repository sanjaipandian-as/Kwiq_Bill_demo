const express = require('express');
const router = express.Router();
const { getLatestBroadcast } = require('../controllers/broadcastController');

// Get latest broadcast - public access so users see it immediately on login
router.get('/latest', getLatestBroadcast);

module.exports = router;
