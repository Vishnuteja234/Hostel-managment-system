const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:     { type: String, required: true }, // Format: YYYY-MM
  breakdown: {
    breakfast: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    lunch:     { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    snacks:    { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    dinner:    { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
  },
  totalMeals:  { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' },
  paidAt:    { type: Date },
  generatedAt: { type: Date, default: Date.now },
  notes: { type: String }
});

billSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Bill', billSchema);