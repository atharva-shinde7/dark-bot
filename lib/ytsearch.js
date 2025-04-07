const ytSearch = require('yt-search')

const searchYouTube = async (query) => {
    const result = await ytSearch(query)
    if (!result.videos.length) return []

    return result.videos.slice(0, 5).map((video) => ({
        title: video.title,
        url: video.url,
        thumbnail: video.thumbnail,
        seconds: video.seconds,
        timestamp: video.timestamp,
    }))
}

module.exports = searchYouTube
