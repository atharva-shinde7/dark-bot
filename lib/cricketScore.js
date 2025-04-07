const axios = require("axios");

async function getLiveCricketScore() {
    const apiKey = process.env.CRICAPI_KEY;
    const url = `https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}`;

    try {
        const { data } = await axios.get(url);

        if (!data.data || data.data.length === 0) {
            return "❌ No live matches found right now.";
        }

        let response = "🏏 *Live Cricket Scores:*\n\n";
        const matches = data.data.slice(0, 3); // Top 3 matches

        matches.forEach((match, idx) => {
            response += `*${idx + 1}. ${match.name}*\n`;
            response += `➡️ ${match.status}\n\n`;
        });

        return response.trim();
    } catch (err) {
        console.error(err);
        return "❌ Couldn't fetch live scores. Try again later.";
    }
}

module.exports = getLiveCricketScore;
