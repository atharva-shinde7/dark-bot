const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { callGeminiVision } = require('./gemini');

const extractFrames = async (videoPath, outputDir) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    exec(`ffmpeg -i "${videoPath}" -vf fps=1 "${outputDir}/frame_%03d.jpg"`, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

const analyzeVideo = async (videoPath) => {
  const framesDir = path.join(__dirname, '../temp/frames');
  await extractFrames(videoPath, framesDir);

  const frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
  const captions = [];

  for (const frame of frames) {
    const imagePath = path.join(framesDir, frame);
    const result = await callGeminiVision(imagePath);
    captions.push(`🖼 *${frame}*: ${result}`);
  }

  fs.rmSync(framesDir, { recursive: true, force: true });
  return captions.join('\n\n');
};

module.exports = { analyzeVideo };
