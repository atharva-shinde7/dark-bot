const axios = require('axios');

const getAnimeInfo = async (title) => {
  try {
    const search = await axios.get(`https://api.jikan.moe/v4/anime`, {
      params: { q: title, limit: 1 }
    });

    if (!search.data.data.length) {
      return { error: 'Anime not found!' };
    }

    const anime = search.data.data[0];

    return {
      title: anime.title,
      japaneseTitle: anime.title_japanese,
      image: anime.images.jpg.image_url,
      type: anime.type,
      episodes: anime.episodes,
      status: anime.status,
      rating: anime.rating,
      score: anime.score,
      synopsis: anime.synopsis,
      aired: anime.aired.string,
      genres: anime.genres.map(g => g.name).join(', '),
      url: anime.url
    };
  } catch (error) {
    return { error: 'Failed to fetch anime details.' };
  }
};

module.exports = getAnimeInfo;
