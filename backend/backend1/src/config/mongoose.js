const mongoose = require('mongoose');

let isConnected = false;

const connectMongo = async () => {
    if (isConnected) {
        return mongoose.connection;
    }

    try {
        mongoose.set('bufferCommands', false); // Do not buffer queries if disconnected
        
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 3000,
            connectTimeoutMS: 3000,
            socketTimeoutMS: 5000,
            family: 4 // Force IPv4 to prevent ERR_INTERNAL_ASSERTION in Node 18
        });

        isConnected = true;
        console.log('✅ MongoDB connected for company analytics:', conn.connection.host);
        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        // Do not rethrow in this context unless the app absolutely requires it. 
        // By swallowing the connect error or just returning null, we allow the app to keep working on SQLite offline fast.
        return null;
    }
};

// Graceful disconnect
const disconnectMongo = async () => {
    if (!isConnected) return;

    try {
        await mongoose.disconnect();
        isConnected = false;
        console.log('MongoDB disconnected');
    } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
    }
};

module.exports = { connectMongo, disconnectMongo };
