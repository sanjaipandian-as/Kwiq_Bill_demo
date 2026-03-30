const asyncHandler = require('express-async-handler');
const Broadcast = require('../models/broadcastModel');

// @desc    Get latest broadcast for mobile users
// @route   GET /broadcasts/latest
// @access  Public (or User)
const getLatestBroadcast = asyncHandler(async (req, res) => {
    const now = new Date();
    // Get the most recent broadcast that is currently active
    const broadcast = await Broadcast.findOne({
        startTime: { $lte: now },
        $or: [
            { expiryTime: null },
            { expiryTime: { $gt: now } }
        ]
    }).sort({ createdAt: -1 });
    
    if (broadcast) {
        res.json(broadcast);
    } else {
        res.status(404);
        res.json({ message: 'No active broadcasts found' }); // Return JSON instead of throwing for cleaner mobile handling
    }
});

module.exports = { getLatestBroadcast };
