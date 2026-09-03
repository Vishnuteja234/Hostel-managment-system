const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const config  = require('../config');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const generateToken = id => jwt.sign({ id }, config.jwt.secret, { expiresIn: config.jwt.expire });

// POST /api/v1/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, role, roomNumber, foodPreference, adminCode } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }
  if (role === 'admin' && adminCode !== config.adminCode) {
    return res.status(403).json({ success: false, message: 'Invalid admin code.' });
  }
  const user  = await User.create({ name, email, password, role: role || 'student', roomNumber, foodPreference });
  const token = generateToken(user._id);
  res.status(201).json({
    success: true, message: 'Registration successful!', token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, roomNumber: user.roomNumber, foodPreference: user.foodPreference }
  });
}));

// POST /api/v1/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  const token = generateToken(user._id);
  res.json({
    success: true, message: 'Login successful!', token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, roomNumber: user.roomNumber, foodPreference: user.foodPreference, notificationPrefs: user.notificationPrefs }
  });
}));

// GET /api/v1/auth/me
router.get('/me', protect, asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
}));

// PUT /api/v1/auth/notification-prefs
router.put('/notification-prefs', protect, asyncHandler(async (req, res) => {
  const { emailEnabled, meals } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { 'notificationPrefs.emailEnabled': emailEnabled, 'notificationPrefs.meals': meals },
    { new: true }
  );
  res.json({ success: true, message: 'Notification preferences updated.', notificationPrefs: user.notificationPrefs });
}));

// PUT /api/v1/auth/profile
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const { foodPreference, roomNumber } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, { foodPreference, roomNumber }, { new: true });
  res.json({ success: true, message: 'Profile updated.', user });
}));

module.exports = router;
