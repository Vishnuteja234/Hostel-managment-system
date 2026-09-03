const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: [true, 'Name is required'], trim: true },
  email:    { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'] },
  password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
  role:     { type: String, enum: ['student', 'admin'], default: 'student' },
  roomNumber:     { type: String, trim: true },
  foodPreference: { type: String, enum: ['veg', 'nonveg', 'both'], default: 'veg' },
  // Notification preferences
  notificationPrefs: {
    emailEnabled: { type: Boolean, default: true },
    meals: {
      breakfast: { type: Boolean, default: true },
      lunch:     { type: Boolean, default: true },
      snacks:    { type: Boolean, default: true },
      dinner:    { type: Boolean, default: true },
    }
  },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
