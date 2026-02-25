const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: false, // Changed from true to false for Google Login
        },
        role: {
            type: String,
            required: true,
            enum: ['admin', 'employee'],
            default: 'employee',
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true, // Allows multiple null values
        },
        trialExpiresAt: {
            type: Date,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) { // Keeping next for compatibility but not calling it if async, actually let's just remove it if possible or handle it safely.
    // Mongoose 6+ with async: next is NOT passed automatically if function is async.
    // However, to be safe with older versions or habits, we can just return.

    if (!this.isModified('password')) {
        return;
    }

    // Skip hashing if password is empty (e.g. Google Login)
    if (!this.password) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
