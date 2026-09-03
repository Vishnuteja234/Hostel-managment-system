const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: String, required: true },
  mealType:  { type: String, enum: ['breakfast', 'lunch', 'snacks', 'dinner'], required: true },
  foodPreference: { type: String, enum: ['veg', 'nonveg', 'both'], default: 'veg' },
  status:    { type: String, enum: ['booked', 'consumed', 'cancelled'], default: 'booked' },
  qrToken:   { type: String, unique: true, sparse: true },
  consumedAt: { type: Date },
  bookedAt:  { type: Date, default: Date.now }
});

bookingSchema.index({ userId: 1, date: 1, mealType: 1 }, { unique: true });
bookingSchema.index({ date: 1 });
bookingSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
