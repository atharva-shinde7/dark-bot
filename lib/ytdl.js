const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')

const downloadYTDL = async (url, format) => {
    const ext = format === 'mp3' ? 'mp3' : 'mp4'
    const fileName = `yt-${Date.now()}.${ext}`
    const outputPath = path.join(__dirname, '../temp', fileName)

    const command = format === 'mp3'
        ? `yt-dlp -x --audio-format mp3 -o "${outputPath}" "${url}"`
        : `yt-dlp -f mp4 -o "${outputPath}" "${url}"`

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(stderr)
                return reject('❌ Error downloading from YouTube.')
            }

            if (!fs.existsSync(outputPath)) return reject('❌ File not created.')

            resolve({ filepath: outputPath, title: fileName })
        })
    })
}

module.exports = downloadYTDL
