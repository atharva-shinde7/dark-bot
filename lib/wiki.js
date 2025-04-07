// lib/wiki.js
const wiki = require('wikijs').default;

const getWikiSummary = async (query) => {
    try {
        const page = await wiki().page(query);
        const summary = await page.summary();
        return summary.length > 2000
            ? summary.slice(0, 1997) + '...'
            : summary;
    } catch (err) {
        return '❌ No information found for that topic.';
    }
};

module.exports = getWikiSummary;
