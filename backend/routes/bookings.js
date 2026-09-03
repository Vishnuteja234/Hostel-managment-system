const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const { protect, adminOnly } = require('../middleware/auth');
const { checkBookingDeadline } = require('../utils/deadline');

// POST /api/bookings/book-meal
router.post('/book-meal', protect, async (req, res) => {
  try {
    const { date, mealType, foodPreference } = req.body;
    if (!date || !mealType) {
      return res.status(400).json({ success: false, message: 'Date and mealType are required.' });
    }

    // Deadline check
    const deadlineCheck = checkBookingDeadline(date, mealType);
    if (!deadlineCheck.allowed) {
      return res.status(400).json({ success: false, message: deadlineCheck.reason });
    }

    const existing = await Booking.findOne({ userId: req.user._id, date, mealType });
    if (existing) {
      if (existing.status === 'cancelled') {
        existing.status = 'booked';
        existing.foodPreference = foodPreference || existing.foodPreference;
        // Regenerate QR
        const token = uuidv4();
        existing.qrToken = token;
        await existing.save();
        const qrDataUrl = await QRCode.toDataURL(token);
        return res.json({ success: true, message: 'Meal re-booked!', booking: existing, qrDataUrl });
      }
      return res.status(400).json({ success: false, message: 'Meal already booked.' });
    }

    const qrToken = uuidv4();
    const booking = await Booking.create({
      userId: req.user._id, date, mealType,
      foodPreference: foodPreference || 'veg',
      status: 'booked', qrToken
    });

    const qrDataUrl = await QRCode.toDataURL(qrToken);
    res.status(201).json({ success: true, message: 'Meal booked!', booking, qrDataUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/qr/:bookingId — Get QR for a booking
router.get('/qr/:bookingId', protect, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Booking is cancelled.' });
    const qrDataUrl = await QRCode.toDataURL(booking.qrToken);
    res.json({ success: true, qrDataUrl, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bookings/scan — Admin/Scanner: validate QR and mark consumed
router.post('/scan', protect, adminOnly, async (req, res) => {
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ success: false, message: 'QR token required.' });

    const booking = await Booking.findOne({ qrToken }).populate('userId', 'name email roomNumber');
    if (!booking) return res.status(404).json({ success: false, message: '❌ Invalid QR code. Not found.' });
    if (booking.status === 'consumed') {
      return res.status(400).json({
        success: false,
        message: '⚠️ Already consumed.',
        booking,
        student: booking.userId
      });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: '❌ Booking was cancelled.', booking });
    }

    booking.status = 'consumed';
    booking.consumedAt = new Date();
    await booking.save();

    res.json({
      success: true,
      message: '✅ Meal marked as consumed!',
      booking,
      student: booking.userId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/bookings/cancel
router.put('/cancel', protect, async (req, res) => {
  try {
    const { date, mealType } = req.body;
    const deadlineCheck = checkBookingDeadline(date, mealType);
    if (!deadlineCheck.allowed) {
      return res.status(400).json({ success: false, message: 'Cancellation deadline has passed.' });
    }
    const booking = await Booking.findOne({ userId: req.user._id, date, mealType });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    booking.status = 'cancelled';
    await booking.save();
    res.json({ success: true, message: 'Booking cancelled.', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/my-meals
router.get('/my-meals', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = { userId: req.user._id };
    if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };
    const bookings = await Booking.find(filter).sort({ date: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/meal-count — Admin
router.get('/meal-count', protect, adminOnly, async (req, res) => {
  try {
    const { date } = req.query;
    let filter = { status: { $in: ['booked', 'consumed'] } };
    if (date) filter.date = date;
    const counts = await Booking.aggregate([
      { $match: filter },
      { $group: {
        _id: { date: '$date', mealType: '$mealType', foodPreference: '$foodPreference' },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.date': -1 } }
    ]);
    res.json({ success: true, counts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/attendance — Admin
router.get('/attendance', protect, adminOnly, async (req, res) => {
  try {
    const { date } = req.query;
    let filter = {};
    if (date) filter.date = date;
    const stats = await Booking.aggregate([
      { $match: filter },
      { $group: {
        _id: { date: '$date', mealType: '$mealType', status: '$status' },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.date': -1 } }
    ]);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/bookings/mark-consumed — Admin (manual)
router.put('/mark-consumed', protect, adminOnly, async (req, res) => {
  try {
    const { userId, date, mealType } = req.body;
    const booking = await Booking.findOneAndUpdate(
      { userId, date, mealType, status: 'booked' },
      { status: 'consumed', consumedAt: new Date() },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    res.json({ success: true, message: 'Marked as consumed.', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/deadline-check — Frontend can query this
router.get('/deadline-check', protect, (req, res) => {
  const { date, mealType } = req.query;
  const result = checkBookingDeadline(date, mealType);
  res.json({ success: true, ...result });
});

module.exports = router;
