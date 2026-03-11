const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
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

const app = express();

// Middleware
// More permissive CORS for local development to avoid IP issues
app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins for now to debug mobile connection
        callback(null, true);
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

// app.options('*', cors()); 
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow images to be loaded
}));
app.use(express.json());


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
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (dbState === 1) {
        res.json({ status: 'connected', db: 'MongoDB' });
    } else {
        res.status(503).json({ status: 'disconnected', db: 'MongoDB', state: dbState });
    }
});

app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/expenses', expenseRoutes);
app.use('/reports', reportRoutes);
app.use('/settings', settingsRoutes);
app.use('/broadcasts', broadcastRoutes);

app.use('/admin', adminRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
