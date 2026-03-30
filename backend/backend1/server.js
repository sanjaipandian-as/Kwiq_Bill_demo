// Force Node.js to load module paths - critical for ASAR environments
require('module').Module._initPaths();

console.log("============================================");
console.log("BACKEND SERVER STARTING");
console.log("============================================");
console.log("__dirname:", __dirname);
console.log("Process CWD:", process.cwd());
console.log("ENV_FILE_PATH:", process.env.ENV_FILE_PATH);
console.log("PORT:", process.env.PORT);
console.log("USER_DATA_PATH:", process.env.USER_DATA_PATH);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("isPackaged:", !!process.resourcesPath);
console.log("============================================");

const path = require("path");
const fs = require("fs");

// Load environment from explicit path passed by Electron main process
const envPath = process.env.ENV_FILE_PATH || path.join(__dirname, ".env");

console.log(`[Server] Loading environment from: ${envPath}`);
console.log(`[Server] File exists: ${fs.existsSync(envPath)}`);

try {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    console.log("[Server] dotenv loaded successfully");
    console.log(`[Server] PORT from env: ${process.env.PORT}`);
  } else {
    // Try fallback paths
    const fallbackPath = path.join(__dirname, ".env");
    console.log(`[Server] Trying fallback path: ${fallbackPath}`);
    if (fs.existsSync(fallbackPath)) {
      require("dotenv").config({ path: fallbackPath });
      console.log("[Server] dotenv loaded from fallback path");
    } else {
      console.error("[Server] ERROR: No .env file found!");
    }
  }
} catch (e) {
  console.error("[Server] Failed to load dotenv:", e.message);
}

const mongoosePath = path.join(__dirname, "src", "config", "mongoose");
try {
  const { connectMongo } = require(mongoosePath);
  const app = require(path.join(__dirname, "src", "app"));
  
  // Initialize MongoDB and Start Server
  const startServer = () => {
    const PORT = process.env.PORT || 5000;
    console.log(`[Server] Attempting to start server on port ${PORT}...`);
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`[Server] Health endpoint available at: http://localhost:${PORT}/api/health`);
      console.log(`[Server] Backend startup COMPLETE`);
    });

    // Connect to MongoDB asynchronously without blocking the server boot
    connectMongo().catch(err => {
      console.warn("⚠️ Offline Mode: Skipping MongoDB connection. Application will run on local SQLite.", err.message);
    });
  };

  startServer();
} catch (loadErr) {
  console.error("❌ CRITICAL: Failed to load backend modules:", loadErr.message);
  console.error(loadErr.stack);
  process.exit(1);
}
