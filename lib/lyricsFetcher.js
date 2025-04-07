require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

const GENIUS_API = 'https://api.genius.com';

async function searchSong(query) {
    const url = `${GENIUS_API}/search?q=${encodeURIComponent(query)}`;
    try {
        const res = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${process.env.GENIUS_API_KEY}`
            }
        });

        const hits = res.data.response.hits;
        if (hits.length === 0) return null;

        const songData = hits[0].result;
        return {
            title: songData.full_title,
            url: songData.url,
            thumbnail: songData.song_art_image_thumbnail_url
        };
    } catch (err) {
        console.error("Genius API error:", err);
        return null;
    }
}

async function getLyrics(query) {
    const song = await searchSong(query);
    if (!song) return { error: "❌ No results found." };

    try {
        const res = await axios.get(song.url);
        const $ = cheerio.load(res.data);
        const lyrics = $('div[data-lyrics-container="true"]').text().trim();

        return {
            title: song.title,
            lyrics: lyrics || "❌ Lyrics not found.",
            thumbnail: song.thumbnail
        };
    } catch (err) {
        console.error("Lyrics scrape error:", err);
        return { error: "⚠️ Error scraping lyrics." };
    }
}

module.exports = getLyrics;
