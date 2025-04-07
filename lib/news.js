const axios = require('axios');
require('dotenv').config();

async function getNews(category = 'general') {
    try {
        // Use top-headlines API with category for better results
        const url = `https://newsapi.org/v2/top-headlines?category=${encodeURIComponent(category)}&language=en&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`;

        const res = await axios.get(url);
        const articles = res.data.articles;

        if (!articles.length) return [];

        return articles.map(article => ({
            title: article.title,
            description: article.description || 'No description available',
            url: article.url,
            source: article.source.name
        }));

    } catch (err) {
        console.error('[News Error]', err.message);
        return null;
    }
}

module.exports = { getNews };
