require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

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

// Image analysis function for Gemini Vision
const callGeminiVision = async (imageBufferOrPath) => {
    try {
        // Use Gemini Pro Vision model for image analysis
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-exp-03-25' });
        
        let imageBase64;
        
        // Check if input is a file path or buffer
        if (typeof imageBufferOrPath === 'string') {
            // It's a file path
            const imageBuffer = fs.readFileSync(imageBufferOrPath);
            imageBase64 = imageBuffer.toString('base64');
        } else {
            // It's already a buffer
            imageBase64 = imageBufferOrPath.toString('base64');
        }
        
        // Prepare the content with the image
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { text: 'Describe this image in detail. What do you see?' },
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: imageBase64
                        }
                    }
                ]
            }]
        });
        
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini Vision API error:', error);
        return 'I couldn\'t analyze this image. Please try again later.';
    }
};

module.exports = {
    askGemini,
    callGeminiVision
};
