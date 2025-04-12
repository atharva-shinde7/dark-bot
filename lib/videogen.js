// Using Replicate's Stable Video Diffusion model - requires billing setup
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateVideoFromPrompt(prompt) {
    console.log(`Starting video generation for prompt: "${prompt}"`);
    
    try {
        // Ensure temp directory exists
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Get API key from .env file
        const REPLICATE_API_KEY = process.env.REPLICATE_API_TOKEN;
        
        if (!REPLICATE_API_KEY) {
            throw new Error("Missing REPLICATE_API_TOKEN in .env file. Get a key from replicate.com");
        }
        
        console.log("Starting generation with Replicate API...");
        
        // First, create the prediction
        const response = await axios.post(
            'https://api.replicate.com/v1/predictions', 
            {
                // Stable Video Diffusion model
                version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
                input: {
                    prompt: prompt,
                    negative_prompt: "bad quality, blurry, low resolution",
                    motion_bucket_id: 40,
                    cond_aug: 0.02,
                    decoding_t: 14,
                    width: 576,
                    height: 320
                }
            },
            {
                headers: {
                    'Authorization': `Token ${REPLICATE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const predictionId = response.data.id;
        console.log(`Prediction started with ID: ${predictionId}`);
        
        // Poll for completion
        let completed = false;
        let videoUrl = null;
        
        for (let i = 0; i < 60; i++) { // Try for up to 5 minutes (60 * 5s = 300s)
            console.log(`Checking prediction status (attempt ${i+1})...`);
            
            const statusResponse = await axios.get(
                `https://api.replicate.com/v1/predictions/${predictionId}`,
                {
                    headers: {
                        'Authorization': `Token ${REPLICATE_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const status = statusResponse.data.status;
            
            if (status === "succeeded") {
                videoUrl = statusResponse.data.output;
                console.log("API response output:", videoUrl);
                
                // For stable-video-diffusion model, the output is an array
                if (Array.isArray(videoUrl) && videoUrl.length > 0) {
                    videoUrl = videoUrl[0]; // Use the first video from the array
                }
                
                completed = true;
                break;
            } else if (status === "failed") {
                const error = statusResponse.data.error || "Unknown error";
                if (error.includes("billing") || statusResponse.data.status_message?.includes("billing")) {
                    throw new Error("You need to set up billing to run this model. Go to https://replicate.com/account/billing to set it up.");
                } else {
                    throw new Error("Video generation failed: " + error);
                }
            }
            
            // Wait 5 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        if (!completed || !videoUrl) {
            throw new Error("Video generation timed out or failed to produce a result");
        }
        
        console.log("Video generated successfully, downloading...");
        
        // Download the video
        const videoPath = path.join(tempDir, `gen_video_${Date.now()}.mp4`);
        
        const videoResponse = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream'
        });
        
        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`Video saved to ${videoPath}`);
                resolve(videoPath);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        // Check specifically for billing errors
        if (error.response?.data?.detail?.includes("billing") || 
            error.message?.includes("billing") || 
            error.response?.data?.detail?.includes("payment") || 
            error.message?.includes("payment")) {
            console.error("Billing required:", error.message || error.response?.data?.detail);
            throw new Error("You need to set up billing on Replicate to use this feature. Go to https://replicate.com/account/billing");
        }
        console.error("Video generation error:", error);
        throw error;
    }
}

module.exports = { generateVideoFromPrompt };
