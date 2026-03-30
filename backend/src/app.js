const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit'); // Fix #8: API Rate Limiting
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const securityRoutes = require('./routes/securityRoutes');
const customizeRequestRoutes = require('./routes/customizeRequestRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const backupRoutes = require('./routes/backupRoutes');

const app = express();

// ═══════════════════════════════════════════════════════════════
// Fix #4: CORS — Restricted in production, open in development
// ═══════════════════════════════════════════════════════════════
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
    'https://kwiqbill.com',
    'https://www.kwiqbill.com',
    'https://admin.kwiqbill.com',
    'capacitor://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
];

app.use(cors({
    origin: (origin, callback) => {
        // In development, allow all origins for mobile debugging
        if (!isProduction) {
            return callback(null, true);
        }
        // In production, enforce whitelist
        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS: Origin not allowed'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Security Middleware for Google Login
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

app.use(helmet({
    crossOriginResourcePolicy: false, // Allow images to be loaded
}));

// ═══════════════════════════════════════════════════════════════
// Fix #5: Body size limit — Prevent DoS via oversized payloads
// ═══════════════════════════════════════════════════════════════
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ═══════════════════════════════════════════════════════════════
// Fix #8: Global API Rate Limiting — Prevent abuse
// ═══════════════════════════════════════════════════════════════
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
    skip: (req) => !isProduction, // Only enforce in production
});
app.use(globalLimiter);

// Stricter rate limits for sensitive endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 500 : 20, // 500 in dev, 20 in prod
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Fix #9: Very strict rate limit for public recovery endpoint
const recoveryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Only 5 recovery attempts per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many recovery attempts. Please try again in 1 hour.' },
});


// NEW: Strict rate limit for Payment orders to prevent carding attacks
const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'development' ? 100 : 5, // 100 in dev for testing, 5 in prod
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Payment attempt limit reached. Please try again in 1 hour.' },
});

// NEW: Rate limit for Customization requests (max 5 per hour)
const customizeOrderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'development' ? 100 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Customize request limit reached. Please try again in 1 hour.' },
});

// Serve static files from uploads directory with CORS
app.use('/uploads', cors(), express.static(path.join(__dirname, '../uploads')));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Routes
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Health check endpoint - returns DB connection status
app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
        res.json({ status: 'connected', db: 'MongoDB' });
    } else {
        res.status(503).json({ status: 'disconnected', db: 'MongoDB', state: dbState });
    }
});

// Apply stricter rate limits to auth and security routes
app.use('/auth', authLimiter, authRoutes);
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/expenses', expenseRoutes);
app.use('/reports', reportRoutes);
app.use('/settings', settingsRoutes);
app.use('/broadcasts', broadcastRoutes);
app.use('/security/recover', recoveryLimiter); // Fix #9: Recovery endpoint rate limited
app.use('/security', securityRoutes);
app.use('/customize-requests', customizeOrderLimiter, customizeRequestRoutes);
app.use('/payment', paymentLimiter, paymentRoutes);
app.use('/backup', backupRoutes);

app.use('/admin', adminRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
