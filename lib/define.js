const axios = require('axios');

async function getDefinition(word) {
    try {
        const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const data = response.data[0];
        const meaning = data.meanings[0].definitions[0].definition;
        const example = data.meanings[0].definitions[0].example || 'No example available.';
        const partOfSpeech = data.meanings[0].partOfSpeech;

        return `*${data.word}* (${partOfSpeech})\n\n📖 *Definition:* ${meaning}\n💡 *Example:* ${example}`;
    } catch (err) {
        return `[Define Error] Could not find the word "${word}".`;
    }
}

module.exports = getDefinition;
