const nodemailer = require('nodemailer');
const config = require('../config');

const createTransporter = () => nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

const formatMealRow = (meal, label, emoji) => `
  <tr>
    <td style="padding:12px 16px;border-bottom:1px solid #2a2a3a;">
      <strong style="color:#fff">${emoji} ${label}</strong><br/>
      ${meal?.veg    ? `<span style="color:#4ade80;font-size:12px">🥦 Veg: </span><span style="color:#aaa;font-size:12px">${meal.veg}</span><br/>` : ''}
      ${meal?.nonVeg ? `<span style="color:#f87171;font-size:12px">🍗 Non-Veg: </span><span style="color:#aaa;font-size:12px">${meal.nonVeg}</span><br/>` : ''}
      <span style="color:#666;font-size:11px">${meal?.time || ''}</span>
    </td>
  </tr>`;

const sendMenuNotification = async (students, menu) => {
  if (!config.smtp.user || !config.smtp.pass) {
    console.log('⚠️  Email not configured. Skipping notifications.');
    return { sent: 0, skipped: students.length };
  }
  const transporter = createTransporter();
  const dateLabel = new Date(menu.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let sent = 0;
  for (const student of students) {
    // Respect notification prefs
    if (student.notificationPrefs?.emailEnabled === false) continue;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #252836;">
        <div style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);padding:28px 32px;">
          <div style="font-size:32px;margin-bottom:8px">🍱</div>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">Menu Published!</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">Hi ${student.name}, the menu for ${dateLabel} is ready.</p>
        </div>
        <div style="padding:24px 32px;">
          <table style="width:100%;border-collapse:collapse;background:#252836;border-radius:8px;overflow:hidden;">
            <tbody>
              ${formatMealRow(menu.breakfast, 'Breakfast', '🌅')}
              ${formatMealRow(menu.lunch,     'Lunch',     '☀️')}
              ${formatMealRow(menu.snacks,    'Snacks',    '🍪')}
              ${formatMealRow(menu.dinner,    'Dinner',    '🌙')}
            </tbody>
          </table>
          <p style="color:#666;font-size:12px;margin-top:20px;text-align:center;">Login to book your meals before the deadline.</p>
        </div>
      </div>
    </body></html>`;

    try {
      await transporter.sendMail({ from: config.smtp.from, to: student.email, subject: `🍱 Menu for ${menu.date} is ready!`, html });
      sent++;
    } catch (err) {
      console.error(`Failed to send to ${student.email}:`, err.message);
    }
  }
  return { sent, skipped: students.length - sent };
};

module.exports = { sendMenuNotification };
