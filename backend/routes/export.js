const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const Booking = require('../models/Booking');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/export/meal-report?startDate=&endDate=
router.get('/meal-report', protect, adminOnly, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};
    if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };

    const bookings = await Booking.find(filter)
      .populate('userId', 'name email roomNumber foodPreference')
      .sort({ date: 1, mealType: 1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HostelEats';
    workbook.created = new Date();

    // === Sheet 1: All Bookings ===
    const sheet1 = workbook.addWorksheet('All Bookings');
    sheet1.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Student Name', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Room', key: 'room', width: 10 },
      { header: 'Meal', key: 'mealType', width: 12 },
      { header: 'Food Preference', key: 'foodPref', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Booked At', key: 'bookedAt', width: 20 },
      { header: 'Consumed At', key: 'consumedAt', width: 20 },
    ];

    // Header style
    sheet1.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B35' } };
      cell.alignment = { horizontal: 'center' };
    });

    bookings.forEach(b => {
      const row = sheet1.addRow({
        date: b.date,
        name: b.userId?.name || 'Unknown',
        email: b.userId?.email || '',
        room: b.userId?.roomNumber || '—',
        mealType: b.mealType,
        foodPref: b.foodPreference,
        status: b.status,
        bookedAt: b.bookedAt ? new Date(b.bookedAt).toLocaleString('en-IN') : '',
        consumedAt: b.consumedAt ? new Date(b.consumedAt).toLocaleString('en-IN') : '',
      });
      // Color status cell
      const statusCell = row.getCell('status');
      if (b.status === 'consumed') statusCell.font = { color: { argb: 'FF4ADE80' } };
      else if (b.status === 'cancelled') statusCell.font = { color: { argb: 'FFF87171' } };
      else statusCell.font = { color: { argb: 'FFFBBF24' } };
    });

    // === Sheet 2: Summary by Date & Meal ===
    const sheet2 = workbook.addWorksheet('Meal Count Summary');
    sheet2.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Meal', key: 'meal', width: 12 },
      { header: 'Veg Booked', key: 'vegBooked', width: 14 },
      { header: 'Non-Veg Booked', key: 'nvBooked', width: 16 },
      { header: 'Total Booked', key: 'totalBooked', width: 14 },
      { header: 'Consumed', key: 'consumed', width: 12 },
      { header: 'Cancelled', key: 'cancelled', width: 12 },
      { header: 'Waste %', key: 'waste', width: 10 },
    ];
    sheet2.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2EC4B6' } };
      cell.alignment = { horizontal: 'center' };
    });

    // Aggregate
    const summary = {};
    bookings.forEach(b => {
      const key = `${b.date}__${b.mealType}`;
      if (!summary[key]) summary[key] = { date: b.date, meal: b.mealType, vegBooked: 0, nvBooked: 0, totalBooked: 0, consumed: 0, cancelled: 0 };
      const s = summary[key];
      if (b.status !== 'cancelled') {
        if (b.foodPreference === 'nonveg') s.nvBooked++;
        else s.vegBooked++;
        s.totalBooked++;
      }
      if (b.status === 'consumed') s.consumed++;
      if (b.status === 'cancelled') s.cancelled++;
    });

    Object.values(summary).sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
      const waste = s.totalBooked > 0 ? (((s.totalBooked - s.consumed) / s.totalBooked) * 100).toFixed(1) : '0.0';
      sheet2.addRow({ ...s, waste: `${waste}%` });
    });

    // === Sheet 3: Feedback Summary ===
    const sheet3 = workbook.addWorksheet('Feedback');
    const feedbacks = await Feedback.find(filter).populate('userId', 'name roomNumber').sort({ createdAt: -1 });
    sheet3.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Student', key: 'name', width: 22 },
      { header: 'Room', key: 'room', width: 10 },
      { header: 'Meal', key: 'meal', width: 12 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Comment', key: 'comment', width: 40 },
    ];
    sheet3.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
      cell.alignment = { horizontal: 'center' };
    });
    feedbacks.forEach(f => {
      sheet3.addRow({
        date: f.date,
        name: f.userId?.name || 'Unknown',
        room: f.userId?.roomNumber || '—',
        meal: f.mealType,
        rating: `${f.rating}/5 ${'★'.repeat(f.rating)}`,
        comment: f.comment || '',
      });
    });

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=hostel-meal-report-${startDate || 'all'}-to-${endDate || 'all'}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
