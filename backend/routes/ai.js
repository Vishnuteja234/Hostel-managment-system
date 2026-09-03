const express = require('express');
const router  = express.Router();
const { generateMenuSuggestion } = require('../utils/ai');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Generate menu suggestion using Gemini AI
// @route   POST /api/v1/ai/generate-menu
// @access  Admin
router.post('/generate-menu', protect, adminOnly, asyncHandler(async (req, res) => {
  const { theme } = req.body;
  
  if (!theme) {
    return res.status(400).json({ success: false, message: 'Please provide a theme for the AI.' });
  }

  const suggestion = await generateMenuSuggestion(theme);
  
  res.json({
    success: true,
    message: 'AI menu suggestion generated successfully!',
    data: suggestion
  });
}));

module.exports = router;
