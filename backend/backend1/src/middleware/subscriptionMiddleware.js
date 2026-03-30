const Subscription = require('../models/Subscription');
const mongoose = require('mongoose');
const { withDB } = require('../db/db');

const checkSubscription = async (req, res, next) => {
    try {
        // req.user is populated by protect middleware
        if (!req.user || !req.user.email) {
            return next();
        }

        const email = req.user.email.toLowerCase().trim();

        // --- OFFLINE MODE CHECK ---
        if (mongoose.connection.readyState !== 1) {
            console.log(`📡 Subscription: MongoDB offline, checking local enforcement for [${email}]`);

            try {
                const db = await withDB(req);
                const row = db.prepare("SELECT data FROM settings WHERE id = 'subscription_status'").get();

                if (row) {
                    const cached = JSON.parse(row.data);
                    if (cached.isBlocked) {
                        console.warn(`⛔ OFFLINE LOCK: [${email}] is blocked via local cache.`);
                        return res.status(403).json({
                            reason: "blocked",
                            message: "Account Blocked. Please contact support."
                        });
                    }
                }
            } catch (dbErr) {
                console.error('❌ Failed to check local subscription cache:', dbErr.message);
            }

            return next();
        }

        // --- ONLINE MODE CHECK ---
        const subscription = await Subscription.findOne({
            userEmail: { $regex: new RegExp(`^${email}$`, 'i') }
        });

        console.log(`🔍 Subscription Check [${email}]: ${subscription ? (subscription.isBlocked ? 'BLOCKED' : 'ACTIVE') : 'NOT FOUND'}`);

        if (subscription && subscription.isBlocked) {
            return res.status(403).json({
                reason: "blocked",
                message: "Account Blocked. Please contact support."
            });
        }

        next();
    } catch (error) {
        console.error('Subscription middleware error:', error);
        next(); // Proceed anyway if DB hits an error
    }
};

module.exports = { checkSubscription };
