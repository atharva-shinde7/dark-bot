const axios = require('axios');

const TENOR_API_KEY = process.env.TENOR_API_KEY;

async function getGif(query) {
    try {
        const response = await axios.get('https://tenor.googleapis.com/v2/search', {
            params: {
                q: query,
                key: TENOR_API_KEY,
                limit: 1,
                media_filter: 'gif',
            },
        });

        const gif = response.data.results[0]?.media_formats?.gif?.url;
        return gif || null;
    } catch (error) {
        console.error('[GIF Error]', error.message);
        return null;
    }
}

module.exports = { getGif };
