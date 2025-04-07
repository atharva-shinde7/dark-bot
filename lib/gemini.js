require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const userConversations = new Map(); // Store chat memory by user

const askGemini = async (userId, prompt) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

    if (!userConversations.has(userId)) {
        const chat = model.startChat({ history: [] });
        userConversations.set(userId, chat);
    }

    const chat = userConversations.get(userId);
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
};

module.exports = askGemini;
