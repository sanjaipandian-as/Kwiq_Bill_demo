const asyncHandler = require('express-async-handler');

/**
 * Middleware to check if the user's trial has expired.
 * Must be used AFTER the `protect` middleware (which sets req.user).
 * 
 * If the trial has expired, the API responds with 403 and a structured
 * error that the mobile app can interpret.
 */
/**
 * Middleware to check if the user's subscription or trial has expired, or if they are blocked.
 * Must be used AFTER the `protect` middleware (which sets req.user).
 */
const checkSubscription = asyncHandler(async (req, res, next) => {
    const user = req.user;

    if (!user) {
        return next();
    }

    // 1. Check if user is blocked
    if (user.isBlocked) {
        res.status(403);
        throw new Error('USER_BLOCKED: Your account has been restricted. Please contact support at support@kwiqbill.com.');
    }

    // Bypass trial and pan checks as the app is now free for everyone.


    // Fix #11: Throttle lastActive updates to once per 5 minutes
    // Prevents a DB write on literally every API call
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = new Date();
    const lastActiveTime = user.lastActive ? new Date(user.lastActive).getTime() : 0;
    if (now.getTime() - lastActiveTime > FIVE_MINUTES) {
        user.lastActive = now;
        // Fire-and-forget — don't block the request for a non-critical field
        user.save().catch(err => console.warn('[Trial] lastActive save failed:', err.message));
    }

    next();
});

module.exports = { 
    checkSubscription,
    checkTrial: checkSubscription // Forward compatibility for existing routes
};
