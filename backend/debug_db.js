const mongoose = require('mongoose');
require('dotenv').config();
const Broadcast = require('./src/models/broadcastModel');

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const broadcasts = await Broadcast.find({});
        console.log('Total Broadcasts:', broadcasts.length);
        console.log('Latest:', JSON.stringify(broadcasts[broadcasts.length - 1], null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();
