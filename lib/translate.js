// lib/translate.js
const translate = require('google-translate-api-x');

async function translateText(text, toLang = 'en') {
    try {
        const res = await translate(text, { to: toLang });
        return res.text;
    } catch (err) {
        console.error('[Translate Error]', err);
        return '❌ Translation failed.';
    }
}

module.exports = translateText;
