const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const { OpenAI } = require('openai');

// Initialize OpenAI with the API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Transcribe audio from a WhatsApp voice message
 * @param {string} audioPath - Path to the audio file to transcribe
 * @param {string} messageId - ID of the message (for temp file naming)
 * @returns {Promise<string>} - The transcribed text
 */
async function transcribeAudio(audioPath, messageId) {
    try {
        console.log(`Starting transcription for audio: ${audioPath}`);
        
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Define the mp3 path
        const mp3Path = path.join(tempDir, `${messageId.replace(/[^a-zA-Z0-9]/g, '')}.mp3`);
        
        // Verify file exists and has content
        if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) {
            throw new Error('Audio file is empty or does not exist');
        }
        
        console.log(`Audio file exists at ${audioPath}`);
        
        // Convert to MP3 format for better compatibility with Whisper API
        await convertAudioToMp3(audioPath, mp3Path);
        
        // Verify MP3 file was created successfully
        if (!fs.existsSync(mp3Path) || fs.statSync(mp3Path).size === 0) {
            throw new Error('MP3 conversion failed - output file is empty or does not exist');
        }
        
        console.log('Audio conversion completed. Starting transcription...');
        
        // Transcribe using preferred method
        let transcript;
        
        // Check if OpenAI API key is available
        if (process.env.OPENAI_API_KEY) {
            // Use OpenAI Whisper API
            const audioFile = fs.createReadStream(mp3Path);
            
            // Send to OpenAI for transcription using new client
            const response = await openai.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-1",
            });
            
            transcript = response.text;
        } else if (process.env.GOOGLE_API_KEY) {
            // Fallback to Google Cloud Speech-to-Text
            transcript = await transcribeWithGoogle(mp3Path);
        } else {
            throw new Error('No transcription API keys available. Please add an OpenAI or Google API key in your .env file.');
        }
        
        console.log('Transcription completed successfully');
        
        // Clean up temporary files
        try {
            fs.unlinkSync(audioPath);
            fs.unlinkSync(mp3Path);
            console.log('Temporary files cleaned up');
        } catch (cleanupError) {
            console.warn('Failed to clean up temporary files:', cleanupError);
        }
        
        return transcript;
    } catch (error) {
        console.error('Error in transcribeAudio function:', error);
        throw new Error(`Transcription failed: ${error.message}`);
    }
}

/**
 * Convert audio from OGG to MP3 format using ffmpeg
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path to save converted file
 * @returns {Promise<void>}
 */
async function convertAudioToMp3(inputPath, outputPath) {
    try {
        // Check if ffmpeg is installed
        await execAsync('ffmpeg -version');
        
        console.log(`Converting audio file from ${inputPath} to ${outputPath}`);
        
        // First attempt: Try as OGG file but with specific WhatsApp voice message handling
        try {
            await execAsync(`ffmpeg -f ogg -i "${inputPath}" -c:a libmp3lame -q:a 2 "${outputPath}" -y -err_detect ignore_err`);
            
            // Verify the output file exists and has content
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                console.log('Successfully converted audio using OGG format detection');
                return;
            } else {
                throw new Error('Output file is empty or does not exist');
            }
        } catch (error) {
            console.log('First conversion attempt failed, trying alternate method:', error.message);
        }
        
        // Second attempt: Try as OPUS file (WhatsApp often uses OPUS in an OGG container)
        try {
            await execAsync(`ffmpeg -f opus -i "${inputPath}" -c:a libmp3lame -q:a 2 "${outputPath}" -y`);
            
            // Verify the output file exists and has content
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                console.log('Successfully converted audio using OPUS format detection');
                return;
            } else {
                throw new Error('Output file is empty or does not exist');
            }
        } catch (error) {
            console.log('Second conversion attempt failed, trying generic method:', error.message);
        }
        
        // Third attempt: Try specific WhatsApp M4A format
        try {
            await execAsync(`ffmpeg -f m4a -i "${inputPath}" -c:a libmp3lame -q:a 2 "${outputPath}" -y`);
            
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                console.log('Successfully converted audio using M4A format detection');
                return;
            } else {
                throw new Error('Output file is empty or does not exist');
            }
        } catch (error) {
            console.log('Third conversion attempt failed, trying auto-detection:', error.message);
        }
        
        // Fourth attempt: Let ffmpeg auto-detect (with explicit ignoring of errors)
        try {
            await execAsync(`ffmpeg -i "${inputPath}" -c:a libmp3lame -q:a 2 "${outputPath}" -y -ignore_unknown`);
            
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                console.log('Successfully converted audio using auto-detection');
                return;
            } else {
                throw new Error('Output file is empty or does not exist');
            }
        } catch (error) {
            console.log('Auto-detection failed, trying with specific codec options:', error.message);
        }
        
        // Fifth attempt: Use more specific options for WhatsApp voice message formats
        try {
            // Use additional parameters to handle potential corruption
            await execAsync(`ffmpeg -i "${inputPath}" -c:a libmp3lame -q:a 2 "${outputPath}" -y -acodec pcm_s16le -ar 16000 -ac 1`);
            
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                console.log('Successfully converted audio using specialized options');
                return;
            } else {
                throw new Error('Output file is empty or does not exist');
            }
        } catch (error) {
            console.log('All conversion attempts failed');
            throw new Error(`Failed to convert audio after multiple attempts: ${error.message}`);
        }
    } catch (error) {
        console.error('Error converting audio:', error);
        throw error;
    }
}

/**
 * Transcribe audio using Google Cloud Speech-to-Text API
 * @param {string} audioPath - Path to the audio file
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeWithGoogle(audioPath) {
    try {
        // Read file as base64
        const audioBytes = fs.readFileSync(audioPath).toString('base64');
        
        const response = await axios.post(
            `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_API_KEY}`,
            {
                config: {
                    encoding: 'MP3',
                    sampleRateHertz: 16000,
                    languageCode: 'en-US',
                    enableAutomaticPunctuation: true,
                    model: 'phone_call' // Better for voice messages
                },
                audio: {
                    content: audioBytes
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );
        
        if (response.data && 
            response.data.results && 
            response.data.results.length > 0 && 
            response.data.results[0].alternatives && 
            response.data.results[0].alternatives.length > 0) {
            
            // Combine all transcriptions
            const transcript = response.data.results
                .map(result => result.alternatives[0].transcript)
                .join(' ');
                
            return transcript;
        } else {
            throw new Error('Invalid response from Google Speech-to-Text');
        }
    } catch (error) {
        console.error('Google transcription error:', error.message);
        throw error;
    }
}

module.exports = transcribeAudio;