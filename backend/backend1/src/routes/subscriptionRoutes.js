const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/authMiddleware');
const { withDB } = require('../db/db');

router.get('/status', protect, async (req, res) => {
    try {
        const email = req.user.email.toLowerCase().trim();
        const { deviceId, appVersion } = req.query;
        const db = await withDB(req);

        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            console.log(`📡 Subscription: MongoDB offline, checking local cache for [${email}]`);

            // Try to read from local cache
            const row = db.prepare("SELECT data FROM settings WHERE id = 'subscription_status'").get();
            if (row) {
                const cached = JSON.parse(row.data);
                return res.status(200).json({
                    ...cached,
                    status: 'offline',
                    statusHint: 'Working from local cache'
                });
            }

            return res.status(200).json({ status: 'offline', statusHint: 'No local cache found' });
        }

        let subscription = await Subscription.findOne({
            userEmail: { $regex: new RegExp(`^${email}$`, 'i') }
        });

        if (!subscription) {
            // Create default subscription if none exists
            subscription = new Subscription({
                userEmail: email,
                plan: 'BASIC',
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
                isBlocked: false,
                status: 'active'
            });
        }

        // Update tracking info
        subscription.lastOnlineCheck = new Date();
        if (deviceId) subscription.deviceId = deviceId;
        if (appVersion) subscription.appVersion = appVersion;

        await subscription.save();

        const statusResponse = {
            isBlocked: subscription.isBlocked,
            endDate: subscription.endDate,
            plan: subscription.plan,
            status: subscription.status
        };

        // 💾 Cache status locally in SQLite
        try {
            db.prepare(`
                INSERT INTO settings (id, data, updated_at) 
                VALUES ('subscription_status', ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                data = excluded.data, 
                updated_at = excluded.updated_at
            `).run(JSON.stringify(statusResponse), new Date().toISOString());
        } catch (cacheErr) {
            console.error('❌ Failed to cache subscription status:', cacheErr);
        }

        res.json(statusResponse);
    } catch (error) {
        console.error('Subscription status error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
