const requiredVars = [
  'MONGO_URI',
  'JWT_SECRET',
];

function validateEnv() {
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nCopy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }
}

const config = {
  validateEnv,
  port:       parseInt(process.env.PORT) || 5000,
  nodeEnv:    process.env.NODE_ENV || 'development',
  mongoUri:   process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '7d',
  },
  adminCode:  process.env.ADMIN_CODE || 'OUR_MESS',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.FROM_EMAIL || 'HostelEats <no-reply@hosteleats.com>',
  },
  mealDeadlines: {
    breakfast: parseInt(process.env.BREAKFAST_DEADLINE_MINS) || 30,
    lunch:     parseInt(process.env.LUNCH_DEADLINE_MINS)     || 60,
    snacks:    parseInt(process.env.SNACKS_DEADLINE_MINS)    || 30,
    dinner:    parseInt(process.env.DINNER_DEADLINE_MINS)    || 60,
  },
  mealTimes: {
    breakfast: process.env.BREAKFAST_TIME || '07:00',
    lunch:     process.env.LUNCH_TIME     || '12:00',
    snacks:    process.env.SNACKS_TIME    || '16:00',
    dinner:    process.env.DINNER_TIME    || '19:00',
  },
  billing: {
    breakfastPrice: parseFloat(process.env.PRICE_BREAKFAST) || 30,
    lunchPrice:     parseFloat(process.env.PRICE_LUNCH)     || 60,
    snacksPrice:    parseFloat(process.env.PRICE_SNACKS)    || 20,
    dinnerPrice:    parseFloat(process.env.PRICE_DINNER)    || 60,
  },
};

module.exports = config;
