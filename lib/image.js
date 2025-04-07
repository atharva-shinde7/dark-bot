const axios = require('axios');
require('dotenv').config();

const HF_MODEL_ENDPOINT = 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2';

async function generateImage(prompt) {
    try {
        const response = await axios.post(
            HF_MODEL_ENDPOINT,
            { inputs: prompt },
            {
                headers: {
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer', // important to get image binary
            }
        );

        if (response.headers['content-type'].includes('image')) {
            return Buffer.from(response.data);
        } else {
            console.error('❌ Not an image:', response.data.toString());
            return null;
        }
    } catch (err) {
        console.error('❌ Image generation error:', err.response?.data || err.message);
        return null;
    }
}

module.exports = generateImage;
