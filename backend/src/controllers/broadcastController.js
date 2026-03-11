const asyncHandler = require('express-async-handler');
const Broadcast = require('../models/broadcastModel');

// @desc    Get latest broadcast for mobile users
// @route   GET /broadcasts/latest
// @access  Public (or User)
const getLatestBroadcast = asyncHandler(async (req, res) => {
    // Get the most recent broadcast
    const broadcast = await Broadcast.findOne().sort({ createdAt: -1 });
    
    if (broadcast) {
        res.json(broadcast);
    } else {
        res.status(404);
        throw new Error('No broadcasts found');
    }
});

module.exports = { getLatestBroadcast };
