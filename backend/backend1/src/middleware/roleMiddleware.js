// Middleware to check if user has admin role
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403);
        throw new Error('Access denied. Admin role required.');
    }
};

// Middleware to check if user has employee role
const requireEmployee = (req, res, next) => {
    if (req.user && req.user.role === 'employee') {
        next();
    } else {
        res.status(403);
        throw new Error('Access denied. Employee role required.');
    }
};

// Middleware to check if user is either admin or employee (authenticated user)
const requireAuth = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'employee')) {
        next();
    } else {
        res.status(403);
        throw new Error('Access denied. Authentication required.');
    }
};

module.exports = {
    requireAdmin,
    requireEmployee,
    requireAuth,
};
