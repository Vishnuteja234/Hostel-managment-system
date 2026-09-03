const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const XLSX     = require('xlsx');
const Menu     = require('../models/Menu');
const User     = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler }       = require('../middleware/errorHandler');
const { sendMenuNotification } = require('../utils/email');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', protect, asyncHandler(async (req, res) => {
  const { startDate, endDate, date } = req.query;
  let filter = {};
  if (date) filter.date = date;
  else if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };
  const menus = await Menu.find(filter).sort({ date: 1 });
  res.json({ success: true, count: menus.length, menus });
}));

router.get('/today', protect, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const menu  = await Menu.findOne({ date: today });
  if (!menu) return res.status(404).json({ success: false, message: 'No menu for today.' });
  res.json({ success: true, menu });
}));

router.post('/', protect, adminOnly, asyncHandler(async (req, res) => {
  const { date, breakfast, lunch, snacks, dinner, sendNotification } = req.body;
  if (await Menu.findOne({ date })) {
    return res.status(400).json({ success: false, message: 'Menu for this date already exists. Use PUT to update.' });
  }
  const menu = await Menu.create({ date, breakfast, lunch, snacks, dinner, createdBy: req.user._id, publishedAt: new Date() });
  let emailResult = null;
  if (sendNotification) {
    const students = await User.find({ role: 'student' }).select('name email notificationPrefs');
    emailResult = await sendMenuNotification(students, menu);
    menu.notificationSent = true;
    await menu.save();
  }
  res.status(201).json({ success: true, message: 'Menu created!', menu, emailResult });
}));

router.put('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const { sendNotification, ...updateData } = req.body;
  const menu = await Menu.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!menu) return res.status(404).json({ success: false, message: 'Menu not found.' });
  let emailResult = null;
  if (sendNotification) {
    const students = await User.find({ role: 'student' }).select('name email notificationPrefs');
    emailResult = await sendMenuNotification(students, menu);
    menu.notificationSent = true;
    await menu.save();
  }
  res.json({ success: true, message: 'Menu updated!', menu, emailResult });
}));

router.post('/:id/notify', protect, adminOnly, asyncHandler(async (req, res) => {
  const menu = await Menu.findById(req.params.id);
  if (!menu) return res.status(404).json({ success: false, message: 'Menu not found.' });
  const students = await User.find({ role: 'student' }).select('name email notificationPrefs');
  const result = await sendMenuNotification(students, menu);
  menu.notificationSent = true;
  await menu.save();
  res.json({ success: true, message: `Notifications sent to ${result.sent} students.`, result });
}));

router.delete('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const menu = await Menu.findByIdAndDelete(req.params.id);
  if (!menu) return res.status(404).json({ success: false, message: 'Menu not found.' });
  res.json({ success: true, message: 'Menu deleted!' });
}));

// POST /api/v1/menu/bulk-upload — upload CSV or XLSX
router.post('/bulk-upload', protect, adminOnly, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // Expected columns: date, breakfast_veg, breakfast_nonveg, breakfast_time,
  //                   lunch_veg, lunch_nonveg, lunch_time,
  //                   snacks_veg, snacks_nonveg, snacks_time,
  //                   dinner_veg, dinner_nonveg, dinner_time
  const results = { created: 0, updated: 0, errors: [] };

  for (const row of rows) {
    const date = String(row.date || '').trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      results.errors.push(`Invalid or missing date: "${date}"`);
      continue;
    }
    const menuData = {
      date,
      breakfast: { veg: row.breakfast_veg || '', nonVeg: row.breakfast_nonveg || '', time: row.breakfast_time || '7:00 AM - 9:00 AM' },
      lunch:     { veg: row.lunch_veg     || '', nonVeg: row.lunch_nonveg     || '', time: row.lunch_time     || '12:00 PM - 2:00 PM' },
      snacks:    { veg: row.snacks_veg    || '', nonVeg: row.snacks_nonveg    || '', time: row.snacks_time    || '4:00 PM - 5:00 PM' },
      dinner:    { veg: row.dinner_veg    || '', nonVeg: row.dinner_nonveg    || '', time: row.dinner_time    || '7:00 PM - 9:00 PM' },
      createdBy: req.user._id, publishedAt: new Date()
    };
    try {
      const existing = await Menu.findOne({ date });
      if (existing) { await Menu.findByIdAndUpdate(existing._id, menuData); results.updated++; }
      else           { await Menu.create(menuData); results.created++; }
    } catch (err) {
      results.errors.push(`Row ${date}: ${err.message}`);
    }
  }

  res.json({ success: true, message: `Upload complete. Created: ${results.created}, Updated: ${results.updated}, Errors: ${results.errors.length}`, results });
}));

module.exports = router;
