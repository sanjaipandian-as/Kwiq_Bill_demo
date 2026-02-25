const asyncHandler = require('express-async-handler');

/**
 * Middleware to check if the user's trial has expired.
 * Must be used AFTER the `protect` middleware (which sets req.user).
 * 
 * If the trial has expired, the API responds with 403 and a structured
 * error that the mobile app can interpret.
 */
const checkTrial = asyncHandler(async (req, res, next) => {
    const user = req.user;

    if (!user) {
        // If there's no user, let the protect middleware handle it
        return next();
    }

    if (user.trialExpiresAt) {
        const now = new Date();
        const expirationDate = new Date(user.trialExpiresAt);

        if (now > expirationDate) {
            res.status(403);
            throw new Error('TRIAL_EXPIRED: Your 30-day free trial has ended. Please upgrade to continue using Kwiq Bill.');
        }
    }

    // Trial is still active or no trial date set (shouldn't happen for new users)
    next();
});

module.exports = { checkTrial };
