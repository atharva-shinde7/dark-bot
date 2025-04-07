const axios = require("axios");

async function generateQR(text) {
    const encodedText = encodeURIComponent(text);
    const qrURL = `https://api.qrserver.com/v1/create-qr-code/?data=${encodedText}&size=300x300`;
    return qrURL;
}

module.exports = generateQR;
