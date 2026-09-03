const express = require('express');
const router  = express.Router();
const PDFDocument = require('pdfkit');
const Bill    = require('../models/Bill');
const Booking = require('../models/Booking');
const User    = require('../models/User');
const config  = require('../config');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const prices = config.billing;

// GET /api/v1/billing/my-bill?month=YYYY-MM
router.get('/my-bill', protect, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  let bill = await Bill.findOne({ userId: req.user._id, month });
  if (!bill) {
    // Generate on-the-fly without saving
    bill = await computeBill(req.user._id, month);
  }
  res.json({ success: true, bill });
}));

// GET /api/v1/billing/all?month=YYYY-MM  — Admin
router.get('/all', protect, adminOnly, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const bills = await Bill.find({ month }).populate('userId', 'name email roomNumber').sort({ totalAmount: -1 });
  res.json({ success: true, count: bills.length, bills });
}));

// POST /api/v1/billing/generate?month=YYYY-MM — Admin: generate bills for all students
router.post('/generate', protect, adminOnly, asyncHandler(async (req, res) => {
  const month    = req.query.month || new Date().toISOString().slice(0, 7);
  const students = await User.find({ role: 'student' });
  const results  = [];

  for (const student of students) {
    const billData = await computeBill(student._id, month);
    const bill = await Bill.findOneAndUpdate(
      { userId: student._id, month },
      billData,
      { upsert: true, new: true }
    );
    results.push({ student: student.name, total: bill.totalAmount });
  }
  res.json({ success: true, message: `Generated ${results.length} bills for ${month}.`, results });
}));

// PUT /api/v1/billing/:id/status — Admin: mark paid/waived
router.put('/:id/status', protect, adminOnly, asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const bill = await Bill.findByIdAndUpdate(req.params.id,
    { status, notes, paidAt: status === 'paid' ? new Date() : undefined },
    { new: true }
  ).populate('userId', 'name email roomNumber');
  if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
  res.json({ success: true, message: `Bill marked as ${status}.`, bill });
}));

// GET /api/v1/billing/:id/pdf — Download bill as PDF
router.get('/:id/pdf', protect, asyncHandler(async (req, res) => {
  const billId = req.params.id;
  const bill   = await Bill.findById(billId).populate('userId', 'name email roomNumber');
  if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });

  // Only the student or admin can download
  if (req.user.role !== 'admin' && String(bill.userId._id) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=bill-${bill.userId.name.replace(/\s/g, '_')}-${bill.month}.pdf`);
  doc.pipe(res);

  // Header
  doc.rect(0, 0, 612, 100).fill('#FF6B35');
  doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(28).text('🍱 HostelEats', 50, 30);
  doc.fontSize(12).font('Helvetica').text('Mess Billing Statement', 50, 65);

  // Bill info
  doc.fill('#1a1d27').rect(0, 100, 612, 842).fill();
  doc.fill('#FFFFFF');

  doc.fontSize(14).font('Helvetica-Bold').text('Student Details', 50, 130);
  doc.fontSize(11).font('Helvetica')
    .text(`Name:   ${bill.userId.name}`,      50, 155)
    .text(`Email:  ${bill.userId.email}`,      50, 172)
    .text(`Room:   ${bill.userId.roomNumber || '—'}`, 50, 189)
    .text(`Month:  ${bill.month}`,             50, 206)
    .text(`Status: ${bill.status.toUpperCase()}`, 50, 223);

  // Divider
  doc.strokeColor('#FF6B35').lineWidth(2).moveTo(50, 245).lineTo(562, 245).stroke();

  // Meal breakdown table
  doc.fill('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('Meal Breakdown', 50, 260);

  const meals = [
    { key: 'breakfast', label: 'Breakfast', price: prices.breakfastPrice },
    { key: 'lunch',     label: 'Lunch',     price: prices.lunchPrice     },
    { key: 'snacks',    label: 'Snacks',    price: prices.snacksPrice    },
    { key: 'dinner',    label: 'Dinner',    price: prices.dinnerPrice    },
  ];

  // Table header
  doc.fill('#FF6B35').rect(50, 285, 512, 24).fill();
  doc.fill('#FFFFFF').fontSize(11).font('Helvetica-Bold')
    .text('Meal Type', 60, 291)
    .text('Count', 250, 291)
    .text('Rate (₹)', 350, 291)
    .text('Amount (₹)', 460, 291);

  let y = 309;
  meals.forEach((meal, i) => {
    const d = bill.breakdown[meal.key] || { count: 0, amount: 0 };
    doc.fill(i % 2 === 0 ? '#252836' : '#1f2230').rect(50, y, 512, 22).fill();
    doc.fill('#FFFFFF').fontSize(10).font('Helvetica')
      .text(meal.label, 60, y + 6)
      .text(String(d.count), 250, y + 6)
      .text(`₹${meal.price}`, 350, y + 6)
      .text(`₹${d.amount}`, 460, y + 6);
    y += 22;
  });

  // Total row
  doc.fill('#2EC4B6').rect(50, y, 512, 28).fill();
  doc.fill('#FFFFFF').fontSize(12).font('Helvetica-Bold')
    .text('TOTAL', 60, y + 8)
    .text(String(bill.totalMeals) + ' meals', 250, y + 8)
    .text('', 350, y + 8)
    .text(`₹${bill.totalAmount}`, 460, y + 8);

  y += 50;
  doc.fill('#FFFFFF').fontSize(10).font('Helvetica')
    .text(`Generated: ${new Date(bill.generatedAt).toLocaleDateString('en-IN')}`, 50, y)
    .text('HostelEats — Smart Hostel Food Management', 50, y + 15, { align: 'center' });

  doc.end();
}));

// Helper: compute bill from bookings
async function computeBill(userId, month) {
  const [year, mon] = month.split('-');
  const startDate   = `${year}-${mon}-01`;
  const endDate     = `${year}-${mon}-31`;

  const bookings = await Booking.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
    status: { $in: ['booked', 'consumed'] }
  });

  const breakdown = {
    breakfast: { count: 0, amount: 0 },
    lunch:     { count: 0, amount: 0 },
    snacks:    { count: 0, amount: 0 },
    dinner:    { count: 0, amount: 0 },
  };

  const priceMap = {
    breakfast: prices.breakfastPrice,
    lunch:     prices.lunchPrice,
    snacks:    prices.snacksPrice,
    dinner:    prices.dinnerPrice,
  };

  bookings.forEach(b => {
    if (breakdown[b.mealType]) {
      breakdown[b.mealType].count++;
      breakdown[b.mealType].amount += priceMap[b.mealType] || 0;
    }
  });

  const totalMeals  = Object.values(breakdown).reduce((s, d) => s + d.count, 0);
  const totalAmount = Object.values(breakdown).reduce((s, d) => s + d.amount, 0);

  return { userId, month, breakdown, totalMeals, totalAmount, generatedAt: new Date() };
}

module.exports = router;
