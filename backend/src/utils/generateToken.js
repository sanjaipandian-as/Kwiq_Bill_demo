const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot issue tokens.');
    }
    return jwt.sign({ id }, secret, {
        expiresIn: '30d', // Fix #10: Extended from 1d to 30d for mobile app persistent sessions
    });
};

module.exports = generateToken;
