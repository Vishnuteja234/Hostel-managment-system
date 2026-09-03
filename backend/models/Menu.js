const mongoose = require('mongoose');

const mealSlot = {
  veg:      { type: String, default: '' },
  nonVeg:   { type: String, default: '' },
  time:     { type: String },
  calories: { type: Number }
};

const menuSchema = new mongoose.Schema({
  date: { type: String, required: [true, 'Date is required'], unique: true },
  breakfast: { ...mealSlot, time: { type: String, default: '7:00 AM - 9:00 AM' } },
  lunch:     { ...mealSlot, time: { type: String, default: '12:00 PM - 2:00 PM' } },
  snacks:    { ...mealSlot, time: { type: String, default: '4:00 PM - 5:00 PM' } },
  dinner:    { ...mealSlot, time: { type: String, default: '7:00 PM - 9:00 PM' } },
  publishedAt:      { type: Date },
  notificationSent: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Menu', menuSchema);
