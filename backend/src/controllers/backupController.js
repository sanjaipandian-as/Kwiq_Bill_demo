const asyncHandler = require('express-async-handler');
const SyncEvent = require('../models/syncEventModel');
const User = require('../models/userModel');

// @desc    Upload a single sync event from device to cloud
// @route   POST /backup/event
// @access  Private
const uploadEvent = asyncHandler(async (req, res) => {
    const { type, payload, eventId, deviceId } = req.body;

    if (!type || !payload) {
        res.status(400);
        throw new Error('Type and payload are required');
    }

    const event = await SyncEvent.create({
        user: req.user._id,
        eventId: eventId || `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        payload,
        deviceId: deviceId || 'unknown'
    });

    res.status(201).json(event);
});

// @desc    Sync events between cloud and device
// @route   POST /backup/sync
// @access  Private
const syncEvents = asyncHandler(async (req, res) => {
    const { lastSyncedAt } = req.body;
    
    // Default to the last 30 days if no timestamp provided
    const lastTime = lastSyncedAt ? new Date(lastSyncedAt) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all events for this user created after lastSyncedAt
    const events = await SyncEvent.find({
        user: req.user._id,
        createdAt: { $gt: lastTime }
    }).sort({ createdAt: 1 });

    res.json({
        success: true,
        applied: events.length,
        events: events,
        lastSyncedAt: new Date()
    });
});

// @desc    Get backup/sync status
// @route   GET /backup/status
// @access  Private
const getBackupStatus = asyncHandler(async (req, res) => {
    const lastEvent = await SyncEvent.findOne({ user: req.user._id }).sort({ createdAt: -1 });

    res.json({
        success: true,
        lastSyncAt: lastEvent ? lastEvent.createdAt : null,
        totalEvents: await SyncEvent.countDocuments({ user: req.user._id })
    });
});

// @desc    Push all local data as snapshots (Nuclear Option)
// @route   POST /backup/push-all
// @access  Private
const pushAllData = asyncHandler(async (req, res) => {
    const { clearExisting } = req.body;

    if (clearExisting) {
        await SyncEvent.deleteMany({ user: req.user._id });
    }

    // Logic to generate snapshots could go here, but for now we'll just acknowledge
    // the request and let the client know we're ready for new events.
    
    res.json({
        success: true,
        message: 'Sync records successfully reset and ready for new data.'
    });
});

module.exports = {
    uploadEvent,
    syncEvents,
    getBackupStatus,
    pushAllData
};
