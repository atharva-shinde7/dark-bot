const axios = require("axios");

async function googleSearch(query) {
    const apiKey = process.env.SERP_API_KEY;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;

    try {
        const { data } = await axios.get(url);
        const results = data.organic_results.slice(0, 5);

        let response = `🔍 *Top Google Results for:* _${query}_\n\n`;
        results.forEach((result, index) => {
            response += `*${index + 1}. ${result.title}*\n${result.link}\n\n`;
        });

        return response.trim();
    } catch (err) {
        return "❌ Failed to fetch Google results.";
    }
}

module.exports = googleSearch;
