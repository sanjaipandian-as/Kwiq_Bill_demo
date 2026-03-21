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
        throw new Error('USER_BLOCKED: Your account has been blocked. Please contact our support team at support@kwiqbill.com.');
    }

    const now = new Date();

    // 2. Check Trial for Free users
    if (user.plan === 'free' && user.trialExpiresAt) {
        const expirationDate = new Date(user.trialExpiresAt);
        if (now > expirationDate) {
            res.status(403);
            throw new Error('TRIAL_EXPIRED: Your 30-day free trial has ended. Please contact our team at support@kwiqbill.com to extend your plan.');
        }
    }

    // 3. Check Paid Plan Expiry
    if (user.plan !== 'free' && user.planExpiresAt) {
        const expirationDate = new Date(user.planExpiresAt);
        if (now > expirationDate) {
            res.status(403);
            throw new Error('PLAN_EXPIRED: Your plan has expired. Please contact our team at support@kwiqbill.com to renew.');
        }
    }

    // Fix #11: Throttle lastActive updates to once per 5 minutes
    // Prevents a DB write on literally every API call
    const FIVE_MINUTES = 5 * 60 * 1000;
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
