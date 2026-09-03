const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/feedback — Submit feedback
router.post('/', protect, async (req, res) => {
  try {
    const { mealType, date, rating, comment } = req.body;

    if (!mealType || !date || !rating) {
      return res.status(400).json({ success: false, message: 'mealType, date and rating are required.' });
    }

    const existing = await Feedback.findOne({ userId: req.user._id, date, mealType });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Feedback already submitted for this meal.' });
    }

    const feedback = await Feedback.create({ userId: req.user._id, mealType, date, rating, comment });
    res.status(201).json({ success: true, message: 'Feedback submitted!', feedback });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback — Get feedbacks (admin gets all, student gets own)
router.get('/', protect, async (req, res) => {
  try {
    const { date, mealType } = req.query;
    let filter = {};

    if (req.user.role !== 'admin') filter.userId = req.user._id;
    if (date) filter.date = date;
    if (mealType) filter.mealType = mealType;

    const feedbacks = await Feedback.find(filter)
      .populate('userId', 'name roomNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: feedbacks.length, feedbacks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/summary — Average ratings per meal
router.get('/summary', protect, adminOnly, async (req, res) => {
  try {
    const summary = await Feedback.aggregate([
      { $group: {
          _id: '$mealType',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
