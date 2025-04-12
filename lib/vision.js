const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { callGeminiVision } = require('./gemini'); // Assuming this is where your Gemini call is

const visionHandler = async (msg, sock) => {
  const from = msg.key.remoteJid;

  const imageMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
                 || msg.message?.imageMessage;

  if (!imageMsg) {
    await sock.sendMessage(from, { text: '❗ *Reply to an image with !vision*' }, { quoted: msg });
    return;
  }

  try {
    const buffer = await downloadMediaMessage(
      {
        message: { imageMessage: imageMsg },
        key: msg.key
      },
      "buffer"
    );

    const geminiResponse = await callGeminiVision(buffer); // Your Gemini logic

    await sock.sendMessage(from, { text: geminiResponse }, { quoted: msg });
  } catch (err) {
    console.error("❌ Error in visionHandler:", err);
    await sock.sendMessage(from, { text: '⚠️ *Error analyzing image.*' }, { quoted: msg });
  }
};

module.exports =  visionHandler ;
