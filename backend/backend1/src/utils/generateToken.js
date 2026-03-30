const jwt = require("jsonwebtoken");

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret_key_123", {
        expiresIn: "30d",
    });
};

module.exports = generateToken;
