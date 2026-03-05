console.log("Server file loaded"); // Debug: Confirm file loading
require('dotenv').config();
const { cloudinary } = require('./src/config/cloudinary');

// Verify Cloudinary Connection
cloudinary.api.ping((error, result) => {
    if (error) {
        console.error("❌ Cloudinary connection failed:", error.message);
    } else {
        console.log("✅ Cloudinary connected successfully!");
    }
});

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5001;

// Robust Server Start Function
const startServer = async () => {
    try {
        // 1. Connect to Database first
        await connectDB();

        // 2. Start Listening on Port
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });

    } catch (error) {
        console.error("Error starting server:", error);
        process.exit(1);
    }
};

startServer();
