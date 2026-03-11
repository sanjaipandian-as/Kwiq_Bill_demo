const mongoose = require('mongoose');
const User = require('./src/models/userModel');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const users = await User.find({}, 'name email plan planExpiresAt');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
});
