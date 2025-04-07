// commands/ai.js
const askGemini = require('../lib/gemini')

module.exports = {
    name: 'ai',
    description: 'Ask AI anything using Gemini!',
    execute: async (sock, msg, args) => {
        const sender = msg.key.remoteJid
        const query = args.join(' ')

        if (!query) {
            return await sock.sendMessage(sender, { text: '❗ Please provide a question after !ai' })
        }

        try {
            const reply = await askGemini(query)
            await sock.sendMessage(sender, { text: reply })
        } catch (err) {
            console.error('Gemini error:', err)
            await sock.sendMessage(sender, { text: '⚠️ Failed to fetch AI response.' })
        }
    }
}
