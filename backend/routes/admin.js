const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Feedback = require('../models/Feedback');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/admin/dashboard — Summary stats
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalStudents, todayBookings, totalFeedbacks, feedbackSummary] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Booking.countDocuments({ date: today, status: 'booked' }),
      Feedback.countDocuments(),
      Feedback.aggregate([
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ])
    ]);

    const todayMeals = await Booking.aggregate([
      { $match: { date: today } },
      { $group: { _id: '$mealType', booked: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } }, consumed: { $sum: { $cond: [{ $eq: ['$status', 'consumed'] }, 1, 0] } } } }
    ]);

    const weeklyBookings = await Booking.aggregate([
      { $match: { status: { $in: ['booked', 'consumed'] } } },
      { $group: { _id: '$date', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);

    res.json({
      success: true,
      stats: {
        totalStudents,
        todayBookings,
        totalFeedbacks,
        avgRating: feedbackSummary[0]?.avgRating?.toFixed(1) || 0,
        todayMeals,
        weeklyBookings
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/students — List all students
router.get('/students', protect, adminOnly, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/students/:id
router.delete('/students/:id', protect, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Student removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
