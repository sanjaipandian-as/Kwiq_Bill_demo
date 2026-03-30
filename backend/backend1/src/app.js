const path = require("path");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const passport = require("passport");
const session = require("express-session");
const userContext = require(path.join(__dirname, "middleware", "userContext"));

const { notFound, errorHandler } = require(path.join(__dirname, "middleware", "errorMiddleware"));

// Google OAuth only
require(path.join(__dirname, "config", "googleStrategy"));

const authRoutes = require(path.join(__dirname, "routes", "authRoutes"));
const customerRoutes = require(path.join(__dirname, "routes", "customerRoutes"));
const productRoutes = require(path.join(__dirname, "routes", "productRoutes"));
const invoiceRoutes = require(path.join(__dirname, "routes", "invoiceRoutes"));
const expenseRoutes = require(path.join(__dirname, "routes", "expenseRoutes"));
const reportRoutes = require(path.join(__dirname, "routes", "reportRoutes"));
const settingsRoutes = require(path.join(__dirname, "routes", "settingsRoutes"));

const backupRoutes = require(path.join(__dirname, "routes", "backupRoutes"));
const companyProfileRoutes = require(path.join(__dirname, "routes", "companyProfileRoutes"));
const subscriptionRoutes = require(path.join(__dirname, "routes", "subscriptionRoutes"));
const { protect } = require(path.join(__dirname, "middleware", "authMiddleware"));
const { checkSubscription } = require(path.join(__dirname, "middleware", "subscriptionMiddleware"));

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET || "electron-local-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Electron = localhost
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
// app.use(userContext); // ❌ REMOVED: This blocks /auth routes!

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5000",
      "http://localhost:5001",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:5001",
      "http://127.0.0.1:5500",
      /^https:\/\/.*\.vercel\.app$/,
      "null" // Allow file:// protocol for admin dashboard
    ],
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve admin dashboard as static files (eliminates CORS issues)
// Serve admin dashboard as static files (eliminates CORS issues)
// Removed: app.use('/admin', express.static(path.join(__dirname, '../../admin-dashboard')));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development"
  });
});

// Also support /api/health for consistency
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development"
  });
});

app.use("/auth", authRoutes); // ✅ Public access allowed
app.use("/subscription", subscriptionRoutes); // Status checks

// Protect these routes with JWT authentication + userContext + subscription check
app.use("/customers", protect, userContext, checkSubscription, customerRoutes);
app.use("/products", protect, userContext, checkSubscription, productRoutes);
app.use("/invoices", protect, userContext, checkSubscription, invoiceRoutes);
app.use("/expenses", protect, userContext, checkSubscription, expenseRoutes);
app.use("/reports", protect, userContext, checkSubscription, reportRoutes);
app.use("/settings", protect, userContext, checkSubscription, settingsRoutes);
app.use("/backup", protect, userContext, checkSubscription, backupRoutes);
app.use("/api/company-profile", protect, checkSubscription, companyProfileRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
