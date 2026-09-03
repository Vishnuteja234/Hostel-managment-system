const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generates a menu suggestion using Gemini AI
 * @param {string} theme - The theme or requirements for the menu
 * @returns {Promise<Object>} - The generated menu in JSON format
 */
exports.generateMenuSuggestion = async (theme) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    As a professional hostel mess manager, generate a balanced and healthy daily menu based on the theme: "${theme}".
    The menu must include Breakfast, Lunch, Snacks, and Dinner.
    Each meal should have a 'veg' option and a 'nonVeg' option.
    Keep the descriptions concise (max 10 words).
    
    Return ONLY a valid JSON object with the following structure:
    {
      "breakfast": { "veg": "...", "nonVeg": "...", "calories": 400 },
      "lunch":     { "veg": "...", "nonVeg": "...", "calories": 700 },
      "snacks":    { "veg": "...", "nonVeg": "...", "calories": 200 },
      "dinner":    { "veg": "...", "nonVeg": "...", "calories": 600 }
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON if AI wrapped it in markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI failed to return a valid JSON structure');
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Gemini API Error:', err.message);
    throw new Error('Failed to generate menu with AI');
  }
};
