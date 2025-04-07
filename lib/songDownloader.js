const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const youtubeSearch = require('youtube-search-without-api-key');

// Cache system
const songCache = {};
const CACHE_FOLDER = path.resolve(__dirname, '../temp/cache');
if (!fs.existsSync(CACHE_FOLDER)) {
    fs.mkdirSync(CACHE_FOLDER, { recursive: true });
}

// Path to the yt-dlp executable
const YT_DLP_PATH = path.resolve(__dirname, '../bin/yt-dlp.exe');

/**
 * Generate a cache key from a query
 * @param {string} query - Search query
 * @returns {string} - Cache key
 */
function generateCacheKey(query) {
    return query.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Extract possible genre from video title
 * @param {string} videoTitle 
 * @returns {string|null}
 */
function extractGenre(videoTitle) {
    if (!videoTitle) return null;
    
    // Common genre keywords in titles and descriptions
    const genreKeywords = {
        'rock': ['rock', 'metal', 'punk', 'alternative'],
        'pop': ['pop', 'synth'],
        'hip hop': ['hip hop', 'rap', 'trap'],
        'electronic': ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep'],
        'r&b': ['r&b', 'rnb', 'soul'],
        'country': ['country', 'folk'],
        'jazz': ['jazz', 'blues'],
        'classical': ['classical', 'piano', 'orchestra', 'symphony'],
        'reggae': ['reggae', 'dancehall'],
        'latin': ['latin', 'salsa', 'bachata', 'reggaeton']
    };
    
    // Check for genre in parentheses or brackets
    const bracketMatch = videoTitle.match(/[\(\[](.*?)[\)\]]/i);
    if (bracketMatch) {
        const bracketContent = bracketMatch[1].toLowerCase();
        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            if (keywords.some(keyword => bracketContent.includes(keyword))) {
                return genre.charAt(0).toUpperCase() + genre.slice(1);
            }
        }
    }
    
    // Check full title for genre keywords
    const titleLower = videoTitle.toLowerCase();
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
        if (keywords.some(keyword => titleLower.includes(keyword))) {
            return genre.charAt(0).toUpperCase() + genre.slice(1);
        }
    }
    
    return null;
}

/**
 * Extract year from video title if present
 * @param {string} videoTitle 
 * @returns {string|null}
 */
function extractYear(videoTitle) {
    if (!videoTitle) return null;
    
    // Look for 4-digit years (between 1900-2099)
    const yearMatch = videoTitle.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
        return yearMatch[1];
    }
    
    return null;
}

/**
 * Search for a song on YouTube
 * @param {string} query 
 * @returns {Promise<{id: string, title: string, url: string, thumbnail: string}>}
 */
async function searchSong(query) {
    try {
        console.log(`[Song Downloader] Searching for: "${query}"`);
        const videos = await youtubeSearch.search(query + ' song audio');
        
        if (!videos || videos.length === 0) {
            throw new Error('No results found');
        }
        
        // Filter for likely music videos (typically under 10 minutes, with music-related terms)
        const musicVideos = videos.filter(video => {
            // Convert duration format (MM:SS) to seconds
            const durationParts = (video.duration_raw || '10:00').split(':').map(Number);
            const durationSeconds = durationParts.length > 1 
                ? durationParts[0] * 60 + durationParts[1] 
                : durationParts[0];
                
            // Check if it's a likely music video (under 10 min, not a playlist, etc)
            return durationSeconds < 600 && !video.title.toLowerCase().includes('playlist');
        });
        
        // Use the first music video, or fallback to first result
        const video = musicVideos.length > 0 ? musicVideos[0] : videos[0];
        
        console.log(`[Song Downloader] Found: "${video.title}" (${video.url})`);
        
        // Extract the video ID from the URL (ensuring it's a string)
        const idMatch = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
        const videoId = idMatch ? idMatch[1] : null;
        
        if (!videoId) {
            console.error('[Song Downloader] Could not extract video ID from URL:', video.url);
        } else {
            console.log(`[Song Downloader] Extracted video ID: ${videoId}`);
        }
        
        return {
            id: videoId, 
            title: video.title,
            url: video.url,
            thumbnail: video.thumbnail?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: video.duration_raw || 'Unknown',
            channel: video.channel?.name || 'Unknown Artist',
            genre: extractGenre(video.title),
            year: extractYear(video.title),
            // Extract artist and song title from video title
            ...extractArtistAndTitle(video.title)
        };
    } catch (error) {
        console.error('[Song Search Error]', error);
        throw new Error(`Failed to search for song: ${error.message}`);
    }
}

/**
 * Download a song from YouTube using yt-dlp
 * @param {string} url - YouTube URL
 * @param {string} outputPath - Where to save the file
 * @returns {Promise<void>}
 */
async function downloadWithYtDlp(url, outputPath) {
    try {
        console.log(`[Song Downloader] Starting download with yt-dlp: ${url}`);
        
        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Format the output path correctly
        const outputTemplate = outputPath.replace(/\\/g, '/');
        console.log(`[Song Downloader] Output template: ${outputTemplate}`);
        
        // Build the command with proper escaping
        const command = `"${YT_DLP_PATH}" "${url}" --extract-audio --audio-format mp3 --audio-quality 5 --no-check-certificates --prefer-free-formats --no-warnings --add-header "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" -o "${outputTemplate}"`;
        
        console.log(`[Song Downloader] Running command: ${command}`);
        
        // Execute the command directly
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[yt-dlp Error] ${error.message}`);
                    console.error(`[yt-dlp stderr] ${stderr}`);
                    reject(error);
                    return;
                }
                
                if (stderr) {
                    console.log(`[yt-dlp stderr] ${stderr}`);
                }
                
                console.log(`[yt-dlp stdout] ${stdout}`);
                
                // Verify the file was downloaded
                if (!fs.existsSync(outputPath)) {
                    reject(new Error('Download failed to create output file'));
                    return;
                }
                
                const stats = fs.statSync(outputPath);
                if (stats.size < 1000) { // Less than 1KB
                    reject(new Error('Downloaded file is too small, likely corrupted'));
                    return;
                }
                
                console.log(`[Song Downloader] Successfully downloaded: ${outputPath} (${stats.size} bytes)`);
                resolve(true);
            });
        });
    } catch (error) {
        console.error('[yt-dlp Download Error]', error);
        
        // If there's an error related to paths, output more debug info
        if (error.message && (error.message.includes('path') || error.message.includes('output template'))) {
            console.error('[yt-dlp Debug] URL:', url);
            console.error('[yt-dlp Debug] Output path:', outputPath);
            console.error('[yt-dlp Debug] Binary path:', YT_DLP_PATH);
        }
        
        throw error;
    }
}

/**
 * Try to download directly from an MP3 search/download API
 * @param {string} query 
 * @param {string} outputPath 
 * @returns {Promise<object>}
 */
async function downloadDirectAPI(query, outputPath) {
    try {
        console.log(`[Song Downloader] Trying direct MP3 API for: "${query}"`);
        
        // Try MP3 download services
        const sources = [
            // Source 0 - Direct from YouTube ID
            async () => {
                if (!query) return null;
                
                // If we already have a YouTube URL or ID from previous search
                console.log('[Song Downloader] Trying direct MP3 conversion...');
                
                // Try to search for the video first
                const videos = await youtubeSearch.search(query + ' audio');
                if (!videos || videos.length === 0) {
                    throw new Error('No YouTube results found');
                }
                
                const video = videos[0];
                // Extract the video ID properly from the URL
                const idMatch = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
                const videoId = idMatch ? idMatch[1] : null;
                
                if (!videoId) {
                    throw new Error('Could not extract valid YouTube video ID');
                }
                
                // Use y2mate or similar service to convert
                console.log(`[Song Downloader] Trying direct conversion for video ID: ${videoId}`);
                
                // Try different MP3 conversion services
                const conversionServices = [
                    // Service 1: ytmp3.cc style API
                    async () => {
                        const response = await axios.get(`https://ytmp3.cc/api/button/mp3/${videoId}`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                                'Referer': 'https://ytmp3.cc/',
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (response.data && response.data.url) {
                            const downloadResponse = await axios.get(response.data.url, {
                                responseType: 'stream',
                                timeout: 60000
                            });
                            
                            const writer = fs.createWriteStream(outputPath);
                            downloadResponse.data.pipe(writer);
                            
                            return new Promise((resolve, reject) => {
                                writer.on('finish', () => resolve({
                                    title: video.title,
                                    artist: video.channel?.name || 'Unknown Artist',
                                    duration: video.duration_raw || 'Unknown',
                                    thumbnail: video.thumbnail?.url || null
                                }));
                                writer.on('error', reject);
                            });
                        } else {
                            throw new Error('Invalid conversion response');
                        }
                    },
                    
                    // Service 2: Use y2mate style API
                    async () => {
                        const formData = new URLSearchParams();
                        formData.append('vid', videoId);
                        formData.append('k', 'mp3');
                        
                        const response = await axios.post('https://mate-api.y2mate.com/convert', formData, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        });
                        
                        if (response.data && response.data.dlink) {
                            const downloadResponse = await axios.get(response.data.dlink, {
                                responseType: 'stream',
                                timeout: 60000
                            });
                            
                            const writer = fs.createWriteStream(outputPath);
                            downloadResponse.data.pipe(writer);
                            
                            return new Promise((resolve, reject) => {
                                writer.on('finish', () => resolve({
                                    title: video.title,
                                    artist: video.channel?.name || 'Unknown Artist',
                                    duration: video.duration_raw || 'Unknown',
                                    thumbnail: video.thumbnail?.url || null
                                }));
                                writer.on('error', reject);
                            });
                        } else {
                            throw new Error('Invalid y2mate response');
                        }
                    },
                    
                    // Service 3: Last resort - attempt to download audio directly from YouTube
                    async () => {
                        try {
                            console.log('[Song Downloader] Last resort: Using ytdl-core...');
                            // Import the package directly if we need it
                            const ytdl = require('ytdl-core');
                            
                            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                            const stream = ytdl(videoUrl, {
                                filter: 'audioonly',
                                quality: 'lowestaudio'
                            });
                            
                            const writer = fs.createWriteStream(outputPath);
                            stream.pipe(writer);
                            
                            return new Promise((resolve, reject) => {
                                writer.on('finish', () => resolve({
                                    title: video.title,
                                    artist: video.channel?.name || 'Unknown Artist',
                                    duration: video.duration_raw || 'Unknown',
                                    thumbnail: video.thumbnail?.url || null
                                }));
                                writer.on('error', reject);
                                
                                // Add timeout
                                setTimeout(() => {
                                    stream.destroy();
                                    reject(new Error('Download timed out after 60 seconds'));
                                }, 60000);
                            });
                        } catch (error) {
                            console.error('[ytdl-core fallback error]', error);
                            throw error;
                        }
                    }
                ];
                
                // Try each conversion service
                for (const service of conversionServices) {
                    try {
                        return await service();
                    } catch (error) {
                        console.log(`[Song Downloader] Conversion service failed: ${error.message}`);
                        // Continue to next service
                    }
                }
                
                throw new Error('All conversion services failed');
            },
            
            // Source 1 - MP3 Quack API
            async () => {
                console.log('[Song Downloader] Trying MP3 Quack API...');
                const searchResponse = await axios.get(`https://mp3quack.app/api/search?q=${encodeURIComponent(query)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                        'Referer': 'https://mp3quack.app/search',
                        'Accept': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                });
                
                if (!searchResponse.data || !searchResponse.data.results || searchResponse.data.results.length === 0) {
                    throw new Error('No results found on MP3 Quack');
                }
                
                const result = searchResponse.data.results[0];
                const downloadResponse = await axios.get(result.download_url, {
                    responseType: 'stream',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                        'Referer': 'https://mp3quack.app/'
                    },
                    timeout: 20000 // 20 second timeout
                });
                
                const writer = fs.createWriteStream(outputPath);
                downloadResponse.data.pipe(writer);
                
                return new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve({
                        title: result.title || query,
                        artist: result.artist || 'Unknown Artist',
                        duration: result.duration || 'Unknown',
                        thumbnail: null
                    }));
                    writer.on('error', reject);
                });
            },
            
            // Source 2 - Free MP3 Download API
            async () => {
                console.log('[Song Downloader] Trying MP3 Download API...');
                const searchResponse = await axios.get(`https://free-mp3-download.net/search?q=${encodeURIComponent(query)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    },
                    timeout: 10000 // 10 second timeout
                });
                
                // Parse response HTML to extract download links
                const match = searchResponse.data.match(/href="(\/download\.php\?id=[^"]+)"/);
                if (!match) {
                    throw new Error('No download links found');
                }
                
                const downloadUrl = 'https://free-mp3-download.net' + match[1];
                const downloadResponse = await axios.get(downloadUrl, {
                    responseType: 'stream',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                        'Referer': 'https://free-mp3-download.net'
                    },
                    timeout: 20000 // 20 second timeout
                });
                
                const writer = fs.createWriteStream(outputPath);
                downloadResponse.data.pipe(writer);
                
                return new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve({
                        title: query,
                        artist: 'Unknown Artist',
                        duration: 'Unknown',
                        thumbnail: null
                    }));
                    writer.on('error', reject);
                });
            },
            
            // Source 3 - SongsList.com API
            async () => {
                console.log('[Song Downloader] Trying SongsList API...');
                const searchResponse = await axios.get(`https://www.songslist.com/api/search?q=${encodeURIComponent(query)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    },
                    timeout: 10000 // 10 second timeout
                });
                
                if (!searchResponse.data || !searchResponse.data.results || searchResponse.data.results.length === 0) {
                    throw new Error('No results found on SongsList');
                }
                
                const result = searchResponse.data.results[0];
                const downloadResponse = await axios.get(result.download_url, {
                    responseType: 'stream',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                        'Referer': 'https://www.songslist.com/'
                    },
                    timeout: 20000 // 20 second timeout
                });
                
                const writer = fs.createWriteStream(outputPath);
                downloadResponse.data.pipe(writer);
                
                return new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve({
                        title: result.title || query,
                        artist: result.artist || 'Unknown Artist',
                        duration: result.duration || 'Unknown',
                        thumbnail: result.cover || null
                    }));
                    writer.on('error', reject);
                });
            }
        ];
        
        // Try each source until one works
        let lastError = null;
        for (const source of sources) {
            try {
                return await source();
            } catch (error) {
                lastError = error;
                console.log(`[Song Downloader] Source failed: ${error.message}`);
                // Continue to next source
            }
        }
        
        throw lastError || new Error('All direct download sources failed');
    } catch (error) {
        console.error('[Direct API Download Error]', error);
        throw error;
    }
}

/**
 * Extract artist and title from a YouTube video title
 * @param {string} videoTitle - Full YouTube video title
 * @returns {{artist: string, title: string}} Separated artist and title
 */
function extractArtistAndTitle(videoTitle) {
    if (!videoTitle) return { artist: 'Unknown Artist', title: 'Unknown Title' };
    
    // Remove common suffixes from video titles
    const cleanTitle = videoTitle
        .replace(/\(Official\s*(Music|Lyric|Audio)\s*Video\)/i, '')
        .replace(/\[Official\s*(Music|Lyric|Audio)\s*Video\]/i, '')
        .replace(/\(Official\s*(Music|Lyric|Audio)\)/i, '')
        .replace(/\[Official\s*(Music|Lyric|Audio)\]/i, '')
        .replace(/\(Lyrics\)/i, '')
        .replace(/\[Lyrics\]/i, '')
        .replace(/\(Audio\)/i, '')
        .replace(/\[Audio\]/i, '')
        .replace(/\(Visualizer\)/i, '')
        .replace(/\[Visualizer\]/i, '')
        .replace(/\(Official\)/i, '')
        .replace(/\[Official\]/i, '')
        .replace(/\(HD\)/i, '')
        .replace(/\[HD\]/i, '')
        .replace(/\(HQ\)/i, '')
        .replace(/\[HQ\]/i, '')
        .replace(/\(4K\)/i, '')
        .replace(/\[4K\]/i, '')
        .trim();
    
    // Common patterns in music video titles
    const patterns = [
        // Pattern: Artist - Title
        /^([^-]+)\s*-\s*(.+)$/,
        // Pattern: Artist "Title"
        /^([^"]+)\s*"(.+)"$/,
        // Pattern: Artist | Title
        /^([^|]+)\s*\|\s*(.+)$/,
        // Pattern: Artist : Title
        /^([^:]+)\s*:\s*(.+)$/,
        // Pattern: Artist ~ Title
        /^([^~]+)\s*~\s*(.+)$/,
        // Pattern: Title by Artist
        /^(.+)\s+by\s+(.+)$/i,
        // Pattern: Title (feat. Artist)
        /^(.+)\s*\(feat\.\s*(.+)\)$/i,
        // Pattern: Title ft. Artist
        /^(.+)\s+ft\.\s+(.+)$/i,
        // Pattern: Artist x Artist2 - Title (collab format)
        /^(.+?)\s+x\s+(.+?)\s*-\s*(.+)$/i
    ];
    
    // Try each pattern
    for (const pattern of patterns) {
        const match = cleanTitle.match(pattern);
        if (match) {
            // Handle special patterns differently
            if (pattern.toString().includes('by')) {
                // "by" pattern where artist comes after title
                return { 
                    artist: match[2].trim(), 
                    title: match[1].trim() 
                };
            } else if (pattern.toString().includes('feat')) {
                // "feat." pattern
                return { 
                    artist: match[2].trim(), 
                    title: match[1].trim() 
                };
            } else if (pattern.toString().includes('ft')) {
                // "ft." pattern
                return { 
                    artist: match[2].trim(), 
                    title: match[1].trim() 
                };
            } else if (pattern.toString().includes('x')) {
                // Artist collab pattern
                return { 
                    artist: `${match[1].trim()} & ${match[2].trim()}`, 
                    title: match[3].trim() 
                };
            } else {
                // Standard pattern (artist - title, etc)
                return { 
                    artist: match[1].trim(), 
                    title: match[2].trim() 
                };
            }
        }
    }
    
    // Clean the title from common music video indicators for better display
    const cleanedDisplayTitle = cleanTitle
        .replace(/\(\s*Letra\s*\)/gi, '')
        .replace(/\[\s*Letra\s*\]/gi, '')
        .replace(/\(\s*Lyrics\s*\)/gi, '')
        .replace(/\[\s*Lyrics\s*\]/gi, '')
        .trim();
    
    // If no pattern matched, return the clean title
    return { 
        artist: null,  // Will be replaced with channel name
        title: cleanedDisplayTitle || videoTitle.trim()
    };
}

/**
 * Main function to get song audio
 * @param {string} query - Song name or YouTube URL
 * @returns {Promise<{filePath: string, title: string, artist: string, thumbnail: string, duration: string, url: string}>}
 */
async function getSongAudio(query) {
    console.log(`[Song Downloader] Request for: "${query}"`);
    
    // Check cache first
    const cacheKey = generateCacheKey(query);
    if (songCache[cacheKey]) {
        console.log(`[Song Downloader] Cache hit for: "${query}"`);
        return {
            ...songCache[cacheKey],
            fromCache: true
        };
    }
    
    // Create temp directory if it doesn't exist
    const tempDir = path.resolve(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    try {
        // Step 1: Search for the song
        const videoInfo = await searchSong(query);
        
        if (!videoInfo || !videoInfo.id) {
            throw new Error("Could not find valid video information for: " + query);
        }
        
        // Create a safe filename and path
        const safeTitle = videoInfo.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        const outputFileName = `${safeTitle}_${Date.now()}.mp3`;
        const outputPath = path.resolve(tempDir, outputFileName);
        
        console.log(`[Song Downloader] Will save to: ${outputPath}`);
        
        try {
            // Step 2: Try YouTube download with yt-dlp
            await downloadWithYtDlp(videoInfo.url, outputPath);
            
            // Step 3: Create result object
            const { artist: extractedArtist, title: extractedTitle } = extractArtistAndTitle(videoInfo.title);
            const result = {
                filePath: outputPath,
                title: extractedTitle || videoInfo.title,
                artist: extractedArtist || videoInfo.channel || 'Unknown Artist',
                thumbnail: videoInfo.thumbnail,
                duration: videoInfo.duration || 'Unknown',
                url: videoInfo.url,
                genre: videoInfo.genre || extractGenre(videoInfo.title),
                year: videoInfo.year || extractYear(videoInfo.title),
                fromCache: false
            };
            
            // Cache the result (except filePath which will change)
            const cacheEntry = { ...result };
            songCache[cacheKey] = cacheEntry;
            
            return result;
            
        } catch (youtubeError) {
            console.error('[YouTube Download Failed]', youtubeError.message);
            
            try {
                // Step 4: Fallback to direct MP3 download APIs
                const directResult = await downloadDirectAPI(query, outputPath);
                
                // Step 5: Create result from direct download
                const { artist: extractedArtist, title: extractedTitle } = extractArtistAndTitle(directResult.title || videoInfo.title);
                const result = {
                    filePath: outputPath,
                    title: extractedTitle || directResult.title || videoInfo.title,
                    artist: extractedArtist || directResult.artist || videoInfo.channel || 'Unknown Artist',
                    thumbnail: directResult.thumbnail || videoInfo.thumbnail,
                    duration: directResult.duration || videoInfo.duration || 'Unknown',
                    url: videoInfo.url,
                    genre: directResult.genre || videoInfo.genre || extractGenre(directResult.title || videoInfo.title),
                    year: directResult.year || videoInfo.year || extractYear(directResult.title || videoInfo.title),
                    fromCache: false
                };
                
                // Cache the result
                const cacheEntry = { ...result };
                songCache[cacheKey] = cacheEntry;
                
                return result;
                
            } catch (directApiError) {
                console.error('[Direct API Download Failed]', directApiError.message);
                throw new Error(`All download methods failed. Please try another song or try again later.`);
            }
        }
    } catch (error) {
        console.error('[Song Downloader Failed]', error.message);
        throw error;
    }
}

module.exports = getSongAudio;
