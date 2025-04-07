require('dotenv').config()
const axios = require('axios')

const getWeather = async (location) => {
    const apiKey = process.env.WEATHER_API_KEY
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=metric&appid=${apiKey}`

    try {
        const { data } = await axios.get(url)
        const { name, main, weather, wind } = data

        return `🌤️ Weather in *${name}*:
- 🌡️ Temp: ${main.temp}°C (Feels like ${main.feels_like}°C)
- ☁️ Condition: ${weather[0].description}
- 💨 Wind: ${wind.speed} m/s
- 💧 Humidity: ${main.humidity}%`
    } catch (err) {
        console.error('Weather error:', err.message)
        return `⚠️ Could not get weather for "${location}".`
    }
}

module.exports = getWeather
