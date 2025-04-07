const axios = require('axios');
require('dotenv').config();

const getMovieInfo = async (title) => {
  try {
    const response = await axios.get(`https://www.omdbapi.com/`, {
      params: {
        t: title,
        apikey: process.env.OMDB_API_KEY
      }
    });

    const movie = response.data;
    if (movie.Response === 'False') return { error: movie.Error };

    return {
      title: movie.Title,
      year: movie.Year,
      rated: movie.Rated,
      released: movie.Released,
      runtime: movie.Runtime,
      genre: movie.Genre,
      director: movie.Director,
      writer: movie.Writer,
      actors: movie.Actors,
      plot: movie.Plot,
      language: movie.Language,
      country: movie.Country,
      awards: movie.Awards,
      imdbRating: movie.imdbRating,
      poster: movie.Poster
    };
  } catch (err) {
    return { error: 'Failed to fetch movie details.' };
  }
};

module.exports = getMovieInfo;
