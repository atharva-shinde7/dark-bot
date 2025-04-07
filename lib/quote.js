// lib/quote.js
const axios = require('axios')

// Fallback quotes in case the API is down
const fallbackQuotes = [
    { content: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { content: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
    { content: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { content: "In the end, we will remember not the words of our enemies, but the silence of our friends.", author: "Martin Luther King Jr." },
    { content: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
    { content: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { content: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
    { content: "If life were predictable it would cease to be life, and be without flavor.", author: "Eleanor Roosevelt" },
    { content: "Spread love everywhere you go. Let no one ever come to you without leaving happier.", author: "Mother Teresa" },
    { content: "When you reach the end of your rope, tie a knot in it and hang on.", author: "Franklin D. Roosevelt" }
]

const getQuote = async () => {
    try {
        const response = await axios.get('https://api.quotable.io/random', { timeout: 5000 })
        const { content, author } = response.data
        return `💬 *"${content}"*\n\n— _${author}_`
    } catch (error) {
        console.error('[Quote Error]', error.message || error)
        
        // Use a fallback quote when API is unreachable
        const randomIndex = Math.floor(Math.random() * fallbackQuotes.length)
        const fallback = fallbackQuotes[randomIndex]
        
        return `💬 *"${fallback.content}"*\n\n— _${fallback.author}_ (offline mode)`
    }
}

module.exports = getQuote
