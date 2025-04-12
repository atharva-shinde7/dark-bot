const axios = require('axios');

/**
 * Get a random image of an anime character from reliable APIs
 * @param {string} characterName - The name of the anime character
 * @returns {Promise<string>} - URL to a random image of the character
 */
async function getAnimeCharacterImage(characterName) {
    try {
        console.log(`Searching for images of ${characterName}...`);
        
        // Try multiple image sources with fallbacks
        const imageUrl = await tryMultipleImageSources(characterName);
        
        console.log(`Found image for ${characterName}`);
        return imageUrl;
    } catch (error) {
        console.error('Error fetching anime character image:', error);
        throw new Error(`Failed to find an image of ${characterName}. Try another character name.`);
    }
}

/**
 * Try multiple image sources with fallbacks
 * @param {string} characterName 
 * @returns {Promise<string>}
 */
async function tryMultipleImageSources(characterName) {
    // Try Jikan API (MyAnimeList) first for character search
    try {
        const characterResponse = await axios.get(`https://api.jikan.moe/v4/characters`, {
            params: {
                q: characterName,
                limit: 5,
                order_by: 'favorites',
                sort: 'desc'
            }
        });
        
        if (characterResponse.data.data && characterResponse.data.data.length > 0) {
            // Get a random character from top 5 results
            const randomIndex = Math.floor(Math.random() * Math.min(characterResponse.data.data.length, 5));
            const character = characterResponse.data.data[randomIndex];
            
            if (character.images && character.images.jpg && character.images.jpg.image_url) {
                return character.images.jpg.image_url;
            }
        }
    } catch (error) {
        console.log('Jikan API error, trying next source:', error.message);
    }
    
    // Try Waifu.pics API (for popular anime characters)
    try {
        // Map some common character names to their categories in waifu.pics
        const knownCharacters = {
            'megumin': 'megumin',
            'shinobu': 'shinobu',
            'neko': 'neko',
            'cat': 'neko',
            'nekomimi': 'neko',
            'waifu': 'waifu',
            'marin': 'marin',
            'mori': 'mori',
            'raiden': 'raiden',
            'oppai': 'oppai',
            'selfies': 'selfies',
            'uniform': 'uniform'
        };
        
        const lowerCharName = characterName.toLowerCase();
        
        for (const [key, category] of Object.entries(knownCharacters)) {
            if (lowerCharName.includes(key)) {
                const waifuResponse = await axios.get(`https://api.waifu.pics/sfw/${category}`);
                if (waifuResponse.data && waifuResponse.data.url) {
                    return waifuResponse.data.url;
                }
            }
        }
    } catch (error) {
        console.log('Waifu.pics API error, trying next source:', error.message);
    }
    
    // Final fallback - use Unsplash API with anime theme
    try {
        const unsplashResponse = await axios.get(
            `https://source.unsplash.com/featured/?anime,${encodeURIComponent(characterName)},character`
        );
        
        if (unsplashResponse.request && unsplashResponse.request.res && unsplashResponse.request.res.responseUrl) {
            return unsplashResponse.request.res.responseUrl;
        }
    } catch (error) {
        console.log('Unsplash API error:', error.message);
    }
    
    // If all else fails, use a fixed reliable anime image URL
    const fallbackImages = [
        "https://i.pinimg.com/736x/4e/b7/44/4eb744172cf21dc51d18407ecb059bd3.jpg", // General anime
        "https://i.pinimg.com/564x/f4/d2/96/f4d296e08d9fccbd1a5c475d978cccd8.jpg", // Anime collage
        "https://i.pinimg.com/564x/eb/50/87/eb50875a3c3efb7d637f5433a9e2a903.jpg", // Anime art
        "https://i.pinimg.com/564x/8d/47/40/8d47401b25cb46be00d353b7d3a31a0f.jpg", // Anime style
        "https://i.pinimg.com/564x/2a/50/90/2a5090af213a1e0262036689fd700782.jpg"  // Cute anime
    ];
    
    const randomFallback = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
    return randomFallback;
}

module.exports = getAnimeCharacterImage; 