const config = require('../config');

function checkBookingDeadline(date, mealType) {
  const deadlines = config.mealDeadlines;
  const mealTimes = config.mealTimes;

  if (!deadlines[mealType] || !mealTimes[mealType]) {
    return { allowed: false, reason: `Unknown meal type: ${mealType}` };
  }

  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (date > todayStr) return { allowed: true };
  if (date < todayStr) return { allowed: false, reason: 'Cannot book meals for past dates.' };

  const [mealHour, mealMin] = mealTimes[mealType].split(':').map(Number);
  const mealDateTime = new Date();
  mealDateTime.setHours(mealHour, mealMin, 0, 0);

  const cutoff = new Date(mealDateTime.getTime() - deadlines[mealType] * 60 * 1000);

  if (now > cutoff) {
    const cutoffStr = cutoff.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      allowed: false,
      reason: `Deadline passed. ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} bookings closed at ${cutoffStr}.`
    };
  }

  return { allowed: true };
}

module.exports = { checkBookingDeadline };
