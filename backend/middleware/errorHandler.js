const config = require('../config');

// Async wrapper — no more try/catch in every route
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error handler — add as last middleware in server.js
const errorHandler = (err, req, res, next) => {
  let status  = err.statusCode || 500;
  let message = err.message    || 'Internal server error';

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    status  = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map(e => e.message).join('. ');
    status  = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  { message = 'Invalid token.';  status = 401; }
  if (err.name === 'TokenExpiredError')  { message = 'Token expired.';  status = 401; }

  // Cast error (bad ObjectId)
  if (err.name === 'CastError') { message = 'Invalid ID format.'; status = 400; }

  if (config.nodeEnv === 'development') {
    console.error('🔴 Error:', err);
  }

  res.status(status).json({ success: false, message });
};

// 404 handler
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
};

module.exports = { asyncHandler, errorHandler, notFound };
