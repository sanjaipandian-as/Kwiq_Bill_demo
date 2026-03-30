const asyncHandler = require('express-async-handler');

// @desc    Logout user / clear cookie
// @route   POST /auth/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
    // Since we are using stateless JWT, mostly frontend just clears token.
    // We can respond with a success message.
    res.json({ message: 'Logged out successfully' });
});

// @desc    Get user profile
// @route   GET /auth/me
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    // req.user is set by the protect middleware after verifying JWT
    // It contains { name, email, googleSub }
    const user = req.user;

    if (user) {
        res.json({
            name: user.name,
            email: user.email,
            googleSub: user.googleSub,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

module.exports = {
    logoutUser,
    getUserProfile,
};
