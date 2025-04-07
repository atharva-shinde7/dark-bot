require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const jokePrompt = (category) => `
Tell me a short, funny ${category} joke. 
Make sure it's appropriate, witty, and not too long.
If asked again give a different joke.
`;

const getJoke = async (category = "general") => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    const result = await model.generateContent(jokePrompt(category));
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("❌ Joke Error:", error.message);
    return "Oops! Couldn't fetch a joke right now.";
  }
};

module.exports = getJoke;
