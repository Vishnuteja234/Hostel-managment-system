const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const dotenv     = require('dotenv');
const path       = require('path');

dotenv.config();

// Must run before anything else
const config = require('./config');
config.validateEnv();

const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// === Security ===
app.use(helmet({ contentSecurityPolicy: false })); // CSP off for inline scripts
app.use(cors());

// Rate limiting — login endpoint
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 200,
  message: { success: false, message: 'Too many requests. Slow down.' }
});

// === Logging ===
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// === API v1 Routes ===
app.use('/api/v1/auth',      authLimiter);
app.use('/api/v1',           apiLimiter);
app.use('/api/v1/auth',      require('./routes/auth'));
app.use('/api/v1/menu',      require('./routes/menu'));
app.use('/api/v1/bookings',  require('./routes/bookings'));
app.use('/api/v1/feedback',  require('./routes/feedback'));
app.use('/api/v1/admin',     require('./routes/admin'));
app.use('/api/v1/export',    require('./routes/export'));
app.use('/api/v1/billing',   require('./routes/billing'));
app.use('/api/v1/analytics', require('./routes/analytics'));
app.use('/api/v1/ai',        require('./routes/ai'));

// Legacy alias so old frontend calls still work
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/menu',      require('./routes/menu'));
app.use('/api/bookings',  require('./routes/bookings'));
app.use('/api/feedback',  require('./routes/feedback'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/export',    require('./routes/export'));
app.use('/api/billing',   require('./routes/billing'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ai',        require('./routes/ai'));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

// === Connect & Start ===
mongoose.connect(config.mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected');
    if (config.nodeEnv !== 'test' && !process.env.VERCEL) {
      app.listen(config.port, () => {
        console.log(`🚀 Server: http://localhost:${config.port}`);
        console.log(`📧 Email:  ${config.smtp.user ? 'Configured ✓' : 'Not configured'}`);
        console.log(`🔑 Admin code: ${config.adminCode}`);
        console.log(`🌍 Environment: ${config.nodeEnv}`);
      });
    }
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

module.exports = app;
