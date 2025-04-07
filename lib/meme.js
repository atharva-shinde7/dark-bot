const axios = require('axios');

// Fallback memes in case APIs are down
const fallbackMemes = [
    {
        title: "When the code finally works and you don't know why",
        image: "https://i.imgur.com/QAjylb2.jpg",
        postLink: "https://imgur.com/QAjylb2",
        subreddit: "ProgrammerHumor"
    },
    {
        title: "Debugging be like",
        image: "https://i.imgur.com/oRVKbsv.jpg",
        postLink: "https://imgur.com/oRVKbsv",
        subreddit: "ProgrammerHumor"
    },
    {
        title: "When you're trying to explain your code to someone",
        image: "https://i.imgur.com/YT7wm4c.jpg",
        postLink: "https://imgur.com/YT7wm4c",
        subreddit: "memes"
    },
    {
        title: "When you find a solution on Stack Overflow",
        image: "https://i.imgur.com/kbfUlIR.jpg",
        postLink: "https://imgur.com/kbfUlIR",
        subreddit: "ProgrammerHumor"
    },
    {
        title: "Me waiting for my code to compile",
        image: "https://i.imgur.com/8lU25q9.jpg",
        postLink: "https://imgur.com/8lU25q9",
        subreddit: "memes"
    }
];

// List of meme API sources to try
const memeAPIs = [
    // Original API (currently giving 530 errors)
    {
        url: 'https://meme-api.com/gimme',
        mapper: (data) => ({
            title: data.title,
            image: data.url,
            postLink: data.postLink,
            subreddit: data.subreddit
        })
    },
    // Alternative API
    {
        url: 'https://api.imgflip.com/get_memes',
        mapper: (data) => {
            const memes = data.data.memes;
            const randomMeme = memes[Math.floor(Math.random() * memes.length)];
            return {
                title: randomMeme.name,
                image: randomMeme.url,
                postLink: `https://imgflip.com/meme/${randomMeme.id}`,
                subreddit: "imgflip"
            };
        }
    }
];

async function getMeme() {
    // Try each API in order
    for (const api of memeAPIs) {
        try {
            const response = await axios.get(api.url, { 
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            return api.mapper(response.data);
        } catch (err) {
            console.error(`[Meme API Error: ${api.url}]`, err.message);
            // Continue to next API if this one fails
        }
    }

    // If all APIs fail, use a fallback meme
    console.log('[Meme] Using fallback meme');
    const randomIndex = Math.floor(Math.random() * fallbackMemes.length);
    return fallbackMemes[randomIndex];
}

module.exports = { getMeme };
