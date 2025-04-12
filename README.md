# 🌑 Dark Bot - Advanced WhatsApp Bot

<div align="center">
  <img src="https://i.ibb.co/FXcp1Hd/dark-bot-banner.png" alt="Dark Bot Logo" width="500"/>
  
  ![Node.js Version](https://img.shields.io/badge/Node.js-18.x-green)
  ![License](https://img.shields.io/badge/License-MIT-blue)
  ![Platform](https://img.shields.io/badge/Platform-WhatsApp-brightgreen)
  ![Made with](https://img.shields.io/badge/Made%20with-Baileys-purple)
  ![Status](https://img.shields.io/badge/Status-Active-success)
  ![Version](https://img.shields.io/badge/Version-2.1-blue)
</div>

## 🌟 Unique Features

### 🕵️‍♂️ Advanced Message Tracking
- **Deleted Message Detection**: Catch and forward deleted messages with sender info
- **Message Caching**: Smart caching system for tracking message history
- **Multi-format Support**: Track text, images, videos, audio, and stickers
- **Privacy Protection**: Forward deleted messages to admin number
- **Metadata Preservation**: Keep sender info, timestamps, and message types

### 🤖 AI & Tools
- **!ai** - Powered by Google's Gemini AI for intelligent conversations
- **!image** - Generate stunning AI images using advanced models
- **!vision** - Analyze images with Gemini Vision AI (reply to an image)
- **!analyzevideo** - Extract insights from videos using frame-by-frame analysis
- **!videogen** - Create true AI videos from text prompts (requires Replicate billing setup)
- **!summarize** - Smart summarization of articles, videos, and text
- **!translate** - Break language barriers with accurate translations
- **!docchat** - Chat with documents, ask questions about PDFs and text files

### 📱 Media & Downloads
- **!ytdl** - Download YouTube videos (MP3/MP4)
- **!ytsearch** - Search YouTube with detailed results
- **!sticker** - Create custom stickers from images
- **!toimage** - Convert stickers back to images
- **!gif** - Search and share GIFs
- **!meme** - Get trending memes

### 🎮 Fun & Entertainment
- **!joke** - Get random jokes by category
- **!riddle** - Challenge with brain teasers
  - **!riddlehint** - Get hints for riddles
  - **!riddleanswer** - Reveal riddle answers
- **!ascii** - Create ASCII art masterpieces
- **!aesthetic** - Generate aesthetic text styles

### 📚 Knowledge & Information
- **!weather** - Real-time weather updates with detailed info
- **!news** - Latest news by categories (tech, sports, etc.)
- **!wiki** - Quick Wikipedia lookups
- **!define** - Comprehensive dictionary definitions

### 🛠️ Utilities
- **!qr** - Generate QR codes for any text/link
- **!calc** - Smart calculator with advanced operations
- **!profilepic** - Profile picture management
  - View anyone's profile picture
  - Save profile pictures locally
- Message deletion tracking and forwarding

## 🔥 Advanced Features

### Message Tracking System
- **Real-time Deletion Detection**: Instantly catch deleted messages
- **Smart Caching**: Efficient storage of recent messages
- **Multi-format Support**: Track all message types:
  - Text messages
  - Images with captions
  - Videos with captions
  - Audio messages
  - Stickers
  - Extended text messages
- **Metadata Collection**:
  - Sender information
  - Timestamp
  - Message type
  - Original content

### Profile Picture Management
- **View Profile Pictures**: Get anyone's profile picture
- **Local Storage**: Save profile pictures for quick access
- **Fallback System**: Generate avatars when pictures aren't available

### Security Features
- **Admin Notifications**: Forward important events to admin
- **Error Logging**: Comprehensive error tracking
- **Rate Limiting**: Prevent spam and abuse
- **Safe Storage**: Secure credential management

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/atharva-shinde7/dark-bot.git
   cd dark-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

## 🔧 Requirements

- Node.js 18.x or higher
- Python 3.8+ (for AI features)
- Active WhatsApp account
- API Keys:
  - Google Gemini AI (for chat and vision features)
  - Replicate API (for video generation, requires payment method setup)
  - OpenWeatherMap
  - News API
  - Image Generation API

## 📚 Tech Stack

- **Backend**: Node.js, Python
- **WhatsApp Library**: @whiskeysockets/baileys
- **AI/ML**: Google Gemini (Chat & Vision), HuggingFace
- **Image Processing**: Sharp
- **Additional**: 
  - Axios for HTTP requests
  - Cheerio for web scraping
  - Figlet for ASCII art
  - yt-dlp for YouTube downloads

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Dark Coder (Atharva Shinde)**
- GitHub: [@atharva-shinde7](https://github.com/atharva-shinde7)
- WhatsApp: [+91 93244 69554](https://wa.me/919324469554)

## 💫 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Google Gemini](https://deepmind.google/technologies/gemini/) - AI capabilities
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloads
- All other open-source libraries used

---
<div align="center">
  Made with 🖤 by Dark Coder
  
  *Building the future of WhatsApp automation*
</div> 