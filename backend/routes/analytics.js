const express  = require('express');
const router   = express.Router();
const Booking  = require('../models/Booking');
const Feedback = require('../models/Feedback');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/v1/analytics/my-history?months=3
router.get('/my-history', protect, asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 3;
  const since  = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceStr = since.toISOString().split('T')[0];

  const [bookings, feedbacks] = await Promise.all([
    Booking.find({ userId: req.user._id, date: { $gte: sinceStr } }),
    Feedback.find({ userId: req.user._id, date: { $gte: sinceStr } }),
  ]);

  // Monthly spending breakdown
  const monthlyMap = {};
  bookings.forEach(b => {
    const month = b.date.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { month, breakfast: 0, lunch: 0, snacks: 0, dinner: 0, total: 0, consumed: 0, cancelled: 0 };
    if (b.status !== 'cancelled') {
      monthlyMap[month][b.mealType]++;
      monthlyMap[month].total++;
    }
    if (b.status === 'consumed')  monthlyMap[month].consumed++;
    if (b.status === 'cancelled') monthlyMap[month].cancelled++;
  });

  // Most booked meal
  const mealCount = { breakfast: 0, lunch: 0, snacks: 0, dinner: 0 };
  bookings.forEach(b => { if (b.status !== 'cancelled') mealCount[b.mealType]++; });
  const mostBookedMeal = Object.entries(mealCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'lunch';

  // Average rating given
  const avgRating = feedbacks.length
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
    : null;

  // Streak: consecutive days with at least one booking
  const activeDays = [...new Set(bookings.filter(b => b.status !== 'cancelled').map(b => b.date))].sort();
  let streak = 0, maxStreak = 0, cur = 0;
  for (let i = 0; i < activeDays.length; i++) {
    if (i === 0) { cur = 1; }
    else {
      const prev = new Date(activeDays[i - 1] + 'T00:00:00');
      const curr = new Date(activeDays[i]     + 'T00:00:00');
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);
      cur = diff === 1 ? cur + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, cur);
  }

  res.json({
    success: true,
    analytics: {
      totalBookings: bookings.filter(b => b.status !== 'cancelled').length,
      totalConsumed: bookings.filter(b => b.status === 'consumed').length,
      totalCancelled: bookings.filter(b => b.status === 'cancelled').length,
      mostBookedMeal,
      avgRatingGiven: avgRating,
      maxStreak,
      mealCount,
      monthly: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)),
    }
  });
}));

// GET /api/v1/analytics/wastage?weeks=4 — Admin: weekly wastage trend
router.get('/wastage', protect, adminOnly, asyncHandler(async (req, res) => {
  const weeks = parseInt(req.query.weeks) || 4;
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceStr = since.toISOString().split('T')[0];

  const bookings = await Booking.find({ date: { $gte: sinceStr } });

  // Group by week + meal
  const weekMap = {};
  bookings.forEach(b => {
    const d    = new Date(b.date + 'T00:00:00');
    const day  = d.getDay();
    const mon  = new Date(d); mon.setDate(d.getDate() - day + 1);
    const week = mon.toISOString().split('T')[0]; // Monday of the week

    if (!weekMap[week]) weekMap[week] = {};
    if (!weekMap[week][b.mealType]) weekMap[week][b.mealType] = { booked: 0, consumed: 0 };

    if (b.status !== 'cancelled') weekMap[week][b.mealType].booked++;
    if (b.status === 'consumed')  weekMap[week][b.mealType].consumed++;
  });

  const trend = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([week, meals]) => {
    let totalBooked = 0, totalConsumed = 0;
    Object.values(meals).forEach(m => { totalBooked += m.booked; totalConsumed += m.consumed; });
    const waste = totalBooked > 0 ? ((totalBooked - totalConsumed) / totalBooked * 100).toFixed(1) : '0.0';
    return { week, totalBooked, totalConsumed, wasted: totalBooked - totalConsumed, wastePct: parseFloat(waste), meals };
  });

  // By meal type overall
  const byMeal = { breakfast: { booked: 0, consumed: 0 }, lunch: { booked: 0, consumed: 0 }, snacks: { booked: 0, consumed: 0 }, dinner: { booked: 0, consumed: 0 } };
  bookings.forEach(b => {
    if (!byMeal[b.mealType]) return;
    if (b.status !== 'cancelled') byMeal[b.mealType].booked++;
    if (b.status === 'consumed')  byMeal[b.mealType].consumed++;
  });
  Object.keys(byMeal).forEach(k => {
    byMeal[k].wastePct = byMeal[k].booked > 0
      ? ((byMeal[k].booked - byMeal[k].consumed) / byMeal[k].booked * 100).toFixed(1)
      : '0.0';
  });

  res.json({ success: true, trend, byMeal });
}));

module.exports = router;
