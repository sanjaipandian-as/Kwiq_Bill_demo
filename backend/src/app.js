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

const app = express();

// Middleware
// Middleware
app.use(cors({
    origin: [/http:\/\/localhost:\d+/, 'http://localhost:5173', 'http://localhost:5000', 'https://zilling.netlify.app', 'https://billing-software-o1qb.onrender.com', 'https://kwiq-bill.onrender.com', /^https:\/\/.*\.vercel\.app$/],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Security Middleware for Google Login
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

// app.options('*', cors()); // Enable pre-flight for all routes
app.use(helmet());
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

app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/expenses', expenseRoutes);
app.use('/reports', reportRoutes);
app.use('/settings', settingsRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
