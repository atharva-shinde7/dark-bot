const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Generate anime-style images using Hugging Face's API
 * @param {string} prompt - The description of the anime image to generate
 * @returns {Promise<string>} - Path to the generated image file
 */
async function getAnimeImage(prompt) {
    try {
        // Get HuggingFace API key from .env
        const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
        
        if (!HUGGINGFACE_API_KEY) {
            throw new Error("Missing HUGGINGFACE_API_KEY in .env file");
        }
        
        console.log(`Generating anime image for prompt: "${prompt}"`);
        
        // Enhance prompt for better anime-style results
        const enhancedPrompt = `${prompt}, anime style, high quality, detailed, vibrant colors, Studio Ghibli, 4k, trending on artstation`;
        
        // Ensure temp directory exists
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Call Hugging Face API using Anything V5 model (anime-focused Stable Diffusion model)
        const response = await axios({
            method: 'POST',
            url: 'https://api-inference.huggingface.co/models/cagliostrolab/animagine-xl-3.1',
            headers: {
                Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                inputs: enhancedPrompt,
                parameters: {
                    negative_prompt: "lowres, bad anatomy, bad hands, text, error, missing fingers, cropped, worst quality, low quality, jpeg artifacts, blurry",
                    num_inference_steps: 30,
                    guidance_scale: 7.5,
                    width: 768,
                    height: 768
                }
            }),
            responseType: 'arraybuffer'
        });
        
        // Generate unique filename
        const timestamp = Date.now();
        const imagePath = path.join(tempDir, `anime_${timestamp}.png`);
        
        // Save image to file
        fs.writeFileSync(imagePath, Buffer.from(response.data));
        
        console.log(`Anime image generated successfully: ${imagePath}`);
        return imagePath;
    } catch (error) {
        console.error('Error generating anime image:', error);
        throw new Error(`Failed to generate anime image: ${error.message}`);
    }
}

module.exports = getAnimeImage;
