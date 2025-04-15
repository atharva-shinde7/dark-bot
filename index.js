const fs = require('fs')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const getJoke = require('./lib/joke')
const getDefinition = require('./lib/define');
const generateQR = require("./lib/qr");
const { calculate } = require('./lib/calc')
const { getGif } = require('./lib/gif');
const { getMeme } = require('./lib/meme');
const { getNews } = require('./lib/news');
const path = require('path')
const axios = require('axios')
const figlet = require('figlet');
const summarizeInput = require("./lib/summarize");
const getMovieInfo = require('./lib/movie');
const getAnimeInfo = require('./lib/anime');
const googleSearch = require("./lib/googleSearch");
const getLiveCricketScore = require("./lib/cricketScore");
const getSongAudio = require('./lib/songDownloader');
const handleDocChat = require('./lib/docchat');
const getLyrics = require('./lib/lyricsFetcher');
const { askGemini } = require('./lib/gemini');
const visionHandler = require('./lib/vision');
const { analyzeVideo } = require('./lib/video_analyzer');
const { generateVideoFromPrompt } = require('./lib/videogen');
const getAnimeImage = require('./lib/animeImage');
const getAnimeCharacterImage = require('./lib/animeCharacter');
const lookupPhoneNumber = require('./lib/whois');
const findSocialProfiles = require('./lib/socialFinder');
require('dotenv').config();



// Message cache to store recent messages
const messageCache = new Map();
// Cache size limit (adjust as needed)
const MAX_CACHE_SIZE = 100;

// Auth
const AUTH_FOLDER = './auth'
const PROFILES_FOLDER = './profiles'
// Create profile directory if it doesn't exist
if (!fs.existsSync(PROFILES_FOLDER)) {
    fs.mkdirSync(PROFILES_FOLDER, { recursive: true });
}

// Helper function to extract message content
const getMessageContent = (msg) => {
    if (!msg.message) return "Empty message";
    
    // Text message
    if (msg.message.conversation) 
        return msg.message.conversation;
    
    // Extended text message
    if (msg.message.extendedTextMessage?.text) 
        return msg.message.extendedTextMessage.text;
    
    // Image with caption
    if (msg.message.imageMessage?.caption) 
        return `[Image] ${msg.message.imageMessage.caption}`;
    
    // Video with caption
    if (msg.message.videoMessage?.caption) 
        return `[Video] ${msg.message.videoMessage.caption}`;
    
    // Audio
    if (msg.message.audioMessage) 
        return `[Audio Message]`;
    
    // Sticker
    if (msg.message.stickerMessage) 
        return `[Sticker]`;
    
    // Other message types
    const msgType = Object.keys(msg.message)[0];
    return `[${msgType.replace('Message', '')}]`;
};

// Start bot
const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)

    const sock = makeWASocket({
        logger: pino({ level: 'info' }),
        printQRInTerminal: true,
        auth: state,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect)
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('Connection opened, bot is ready!')
        }

        if (qr) {
            console.log('Please scan QR code to connect')
            qrcode.generate(qr, { small: true })
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message) return

            const from = msg.key.remoteJid
            const body = msg?.message?.conversation
                        || msg?.message?.extendedTextMessage?.text
                        || msg?.message?.imageMessage?.caption
                        || msg?.message?.videoMessage?.caption
                        || ''

            const msgKey = `${from}_${msg.key.id}`

            // Cache normal messages
            if (!msg.message?.protocolMessage) {
                const content = getMessageContent(msg)
                messageCache.set(msgKey, {
                    content: content,
                    sender: msg.key.participant || from,
                    timestamp: new Date().toLocaleString(),
                    messageType: Object.keys(msg.message)[0]
                })

                if (messageCache.size > MAX_CACHE_SIZE) {
                    const firstKey = messageCache.keys().next().value
                    messageCache.delete(firstKey)
                }

                console.log(`[Message Cached] ${msgKey}: ${content.substring(0, 50)}`)
            }


            // Deleted message forwarder
            if (msg.message?.protocolMessage?.type === 0) {
                const deletedMsgKey = msg.message.protocolMessage.key;
                const deletedFrom = deletedMsgKey.remoteJid;
                const deletedBy = msg.key.participant || msg.key.remoteJid;
                const deletedTime = new Date().toLocaleString();
                const deletedId = deletedMsgKey.id;
                
                console.log(`[Deletion] Message ID: ${deletedId} deleted by ${deletedBy}`);
                
                // Look through all cached messages for this ID
                let deletedContent = "Unknown content (not cached)";
                let found = false;
                
                // Search all cache entries for the message ID
                for (const [key, value] of messageCache.entries()) {
                    if (key.includes(deletedId)) {
                        deletedContent = value.content;
                        console.log(`[Deletion] Found cached message with key: ${key}`);
                        messageCache.delete(key);
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    console.log(`[Deletion] No cached message found with ID: ${deletedId}`);
                }

                const forwardText = `🕵️‍♂️ *Deleted Message Alert!*
👤 *Deleted By:* ${deletedBy}
🕰️ *Time:* ${deletedTime}
📍 *Chat:* ${deletedFrom}
📝 *Content:* ${deletedContent}`;

                // Forward to personal number (Atharva)
                await sock.sendMessage('919324469554@s.whatsapp.net', { text: forwardText });
            }
    
            // Command handlers
            if (body.startsWith('!ai')) {
                try {
                    const prompt = body.slice(3).trim();
                    const response = await askGemini(msg.key.remoteJid, prompt);
                    await sock.sendMessage(msg.key.remoteJid, { text: response });
                } catch (error) {
                    console.error('[AI Error]', error.message || error);
                    await sock.sendMessage(from, { text: '❌ Error processing AI request. Try again later.' });
                }
            }
            
            if (body.startsWith('!weather')) {
                const args = body.slice(8).trim().split(' ')
                const getWeather = require('./lib/weather')
                const response = await getWeather(args.join(' '))
                await sock.sendMessage(from, { text: response })
            }

            if (body.startsWith('!ytdl')) {
                const [_, url, format] = body.split(' ')
                if (!url || !format) {
                    await sock.sendMessage(from, { text: '⚠️ Usage: !ytdl <url> <mp3/mp4>' })
                    return
                }

                const ytdl = require('./lib/ytdl')
                try {
                    const { filepath, title } = await ytdl(url, format.toLowerCase())
                    const mediaType = format === 'mp3' ? 'audio' : 'video'
                    const mimetype = format === 'mp3' ? 'audio/mp4' : 'video/mp4'

                    await sock.sendMessage(from, {
                        [mediaType]: { url: filepath },
                        mimetype,
                        ptt: false,
                        linkPreview: false
                    })

                    fs.unlinkSync(filepath)
                } catch (err) {
                    console.error(err)
                    await sock.sendMessage(from, { text: err || '❌ Something went wrong.' })
                }
            }

            if (body.startsWith('!ytsearch')) {
                const query = body.slice(9).trim()
                if (!query) {
                    await sock.sendMessage(from, { text: '⚠️ Usage: !ytsearch <search terms>' })
                    return
                }

                const searchYouTube = require('./lib/ytsearch')
                const results = await searchYouTube(query)

                if (!results.length) {
                    await sock.sendMessage(from, { text: '❌ No results found.' })
                    return
                }

                const replyText = results.map((video, index) =>
                    `*${index + 1}.* ${video.title}\n🔗 ${video.url}\n⏱️ ${video.timestamp}`
                ).join('\n\n')

                await sock.sendMessage(from, { text: replyText })
            }

            if (body.startsWith('!image')) {
                const prompt = body.slice(6).trim()
                const generateImage = require('./lib/image')
                const imageBuffer = await generateImage(prompt)

                if (imageBuffer) {
                    await sock.sendMessage(from, {
                        image: imageBuffer,
                        caption: `🧠 Image generated for: "${prompt}"`
                    })
                } else {
                    await sock.sendMessage(from, { text: '❌ Failed to generate image. Try again later.' })
                }
            }

            if (body.startsWith('!joke')) {
                const parts = body.split(' ')
                const category = parts[1] || 'general'

                const joke = await getJoke(category)
                await sock.sendMessage(from, { text: joke }, { quoted: msg })
            }

            if (body.startsWith('!wiki')) {
                const query = body.slice(5).trim();
                if (!query) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '⚠️ Usage: !wiki <search term>'
                    });
                    return;
                }
            
                const getWikiSummary = require('./lib/wiki');
                const result = await getWikiSummary(query);
                await sock.sendMessage(msg.key.remoteJid, { text: `📚 *Wikipedia Summary:*\n\n${result}` });
            }

            if (body.startsWith('!translate')) {
                const [_, toLang, ...textArr] = body.split(' ');
                const text = textArr.join(' ');
                const translateText = require('./lib/translate');
                const translated = await translateText(text, toLang);
                await sock.sendMessage(msg.key.remoteJid, { text: `🌐 ${translated}` });
            }
            
            if (body.startsWith('!quote')) {
                try {
                    const getQuote = require('./lib/quote')
                    const quote = await getQuote()
                    await sock.sendMessage(msg.key.remoteJid, { text: quote })
                } catch (error) {
                    console.error('[Quote Handler Error]', error.message || error);
                    await sock.sendMessage(from, { text: '❌ Error fetching quote. Try again later.' });
                }
            }

            if (body.startsWith('!define ')) {
                const word = body.split(' ')[1];
                const def = await getDefinition(word);
                await sock.sendMessage(from, { text: def }, { quoted: msg });
            }

            if (body.startsWith("!qr")) {
                const query = body.slice(4).trim();
                if (!query) return sock.sendMessage(from, { text: "⚠️ Please provide text or link.\nExample: !qr Hello Atharva" });
            
                try {
                    const qrLink = await generateQR(query);
                    await sock.sendMessage(from, {
                        image: { url: qrLink },
                        caption: `📎 QR Code for:\n${query}`
                    });
                } catch (err) {
                    console.error("[QR Error]", err);
                    await sock.sendMessage(from, { text: "❌ Failed to generate QR. Please try again." });
                }
            }

            if (body.startsWith('!calc')) {
                const expression = body.slice(5).trim();
                if (!expression) return sock.sendMessage(from, { text: '❌ Please provide an expression.\nExample: `!calc 2 * (5 + 3)`' }, { quoted: msg })
            
                try {
                    const result = await calculate(expression)
                    await sock.sendMessage(from, { text: `🧮 Result: *${result}*` }, { quoted: msg })
                } catch (err) {
                    await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: msg })
                }
            }

            if (body.startsWith('!gif')) {
                const query = body.slice(4).trim();
                if (!query) return sock.sendMessage(from, { text: '❌ Provide a search term.\nExample: `!gif hello`' }, { quoted: msg });
            
                const gifUrl = await getGif(query);
                if (!gifUrl) {
                    await sock.sendMessage(from, { text: '😕 No GIF found for that.' }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, {
                        video: { url: gifUrl },
                        gifPlayback: true,
                        caption: `🎬 GIF for *${query}*`
                    }, { quoted: msg });
                }
            }

            if (body.startsWith('!meme')) {
                const meme = await getMeme();
            
                if (!meme) {
                    await sock.sendMessage(from, { text: '❌ Failed to fetch meme, try again later.' }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, {
                        image: { url: meme.image },
                        caption: `🤣 *${meme.title}*\n🔗 ${meme.postLink}\n📍 Subreddit: r/${meme.subreddit}`
                    }, { quoted: msg });
                }
            }
            
            if (body.startsWith('!news')) {
                const category = body.slice(5).trim() || 'general';
                const news = await getNews(category);
                
                if (!news || news.length === 0) {
                    await sock.sendMessage(from, { text: '❌ Failed to fetch news. Try again later.' }, { quoted: msg });
                } else {
                    let newsText = `📰 *Latest ${category.toUpperCase()} News*\n\n`;
                    
                    news.slice(0, 5).forEach((item, index) => {
                        newsText += `*${index + 1}. ${item.title || 'Untitled'}*\n`;
                        if (item.description) {
                            newsText += `${item.description.substring(0, 150)}${item.description.length > 150 ? '...' : ''}\n`;
                        }
                        if (item.url) {
                            newsText += `🔗 Read more: ${item.url}\n`;
                        }
                        if (item.source) {
                            newsText += `📰 Source: ${item.source}\n`;
                        }
                        newsText += '\n';
                    });
                    
                    await sock.sendMessage(from, { text: newsText }, { quoted: msg });
                }
            }

            if (body === '!help' || body === '!commands') {
                const helpText = `
            ╭━━━[ 🌑 𝗗𝗔𝗥𝗞 𝗕𝗢𝗧 𝟮.𝟬 - 𝗕𝗬 𝗔𝗧𝗛𝗔𝗥𝗩𝗔 ]━━━╮
            
            👨‍💻 *Creator:* Dark Coder (Atharva Shinde)  
            ⚙️ *Version:* 2.0 | 💻 Node.js + Python  
            🌐 *GitHub:* github.com/atharva-shinde7  
            
            ╰━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━╯
            
            📌 *MAIN CATEGORIES*:
            
            🧠 𝗔𝗜 & 𝗧𝗢𝗢𝗟𝗦:
            • !ai <query> — Ask anything to Gemini AI  
            • !image <prompt> — Generate image with AI  
            • !vision — Analyze images with AI (reply to an image)  
            • !analyzevideo — Extract insights from videos
            • !videogen <prompt> — Generate AI videos
            • !summarize <text/url> — Summarize articles or YouTube  
            • !translate <lang> <text> — Translate text  
            
            📱 𝗠𝗘𝗗𝗜𝗔 & 𝗙𝗨𝗡:
            • !ytdl <url> mp3/mp4 — Download YouTube  
            • !ytsearch <query> — Search YouTube  
            • !song <name> — Download songs  
            • !sticker — Make sticker from image  
            • !toimage — Convert sticker to image  
            • !gif <query> — Find GIFs  
            • !meme — Random meme  
            
            🎮 𝗙𝗨𝗡 & 𝗘𝗡𝗧𝗘𝗥𝗧𝗔𝗜𝗡𝗠𝗘𝗡𝗧:
            • !joke [category] — Random jokes  
            • !quote — Inspirational quote  
            • !riddle — Get a tricky riddle  
            • !ascii <text> — Text as ASCII art  
            • !aesthetic <text> — Fancy aesthetic font  
            
            📚 𝗞𝗡𝗢𝗪𝗟𝗘𝗗𝗚𝗘 & 𝗙𝗔𝗖𝗧𝗦:
            • !weather <place> — Weather forecast  
            • !news [topic] — Latest news headlines  
            • !wiki <query> — Wikipedia summary  
            • !define <word> — Dictionary meaning  
            
            🛠️ 𝗧𝗢𝗢𝗟𝗞𝗜𝗧:
            • !qr <text/link> — Generate QR Code  
            • !calc <expression> — Calculate math  
            • !profilepic [@user] — View profile picture  
            • !savepic [@user] — Save someone's profile pic  
            
            💡 *Tips:*
            • Reply to any image with *!sticker* to auto-convert  
            • Use *!ai* for writing, homework, or life advice  
            • Try *!news tech* for today's tech trends  
            
            ╭───╯
            🔌 Powered by *Dark Coder* | Gemini | HuggingFace | Baileys  
            🌐 Join the movement: github.com/atharva-shinde7  
            ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
                `;
                await sock.sendMessage(from, { text: helpText }, { quoted: msg });
            }
            

            if (body.startsWith('!profilepic')) {
                try {
                    let targetJid;

                    // If user mentions someone
                    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                    } else {
                        // Default: Get the sender's profile picture
                        targetJid = msg.key.participant || msg.key.remoteJid;
                    }

                    // Send a processing message
                    await sock.sendMessage(from, { text: '⌛ Fetching profile picture...' }, { quoted: msg });

                    // Check if we have a saved profile picture first
                    const phoneNumber = targetJid.split('@')[0];
                    const localProfilePath = path.join(PROFILES_FOLDER, `${phoneNumber}.jpg`);
                    
                    if (fs.existsSync(localProfilePath)) {
                        // Use the locally saved profile picture
                        await sock.sendMessage(from, {
                            image: { url: localProfilePath },
                            caption: `🖼️ Profile picture of ${phoneNumber} (from saved pictures)`
                        }, { quoted: msg });
                        return;
                    }

                    try {
                        // Try to get profile picture with a timeout
                        const profilePicPromise = sock.profilePictureUrl(targetJid, 'image');
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timed out')), 5000) // Reduced timeout to 5 seconds
                        );
                        
                        const url = await Promise.race([profilePicPromise, timeoutPromise]);
                        
                        if (url) {
                            await sock.sendMessage(from, {
                                image: { url },
                                caption: `🖼️ Profile picture of ${targetJid.split('@')[0]}`
                            }, { quoted: msg });
                            return;
                        }
                    } catch (picError) {
                        console.error('[ProfilePic Fetch Error]', picError.message);
                        
                        // Generate a placeholder avatar
                        const placeholderUrl = `https://ui-avatars.com/api/?name=${targetJid.split('@')[0]}&background=random&size=256`;
                        
                        await sock.sendMessage(from, {
                            image: { url: placeholderUrl },
                            caption: `🖼️ Could not fetch the actual profile picture of ${targetJid.split('@')[0]}, using a generated avatar instead.\n\nTip: Reply to an image with "!savepic @mention" to save a custom profile picture for this contact.`
                        }, { quoted: msg });
                        return;
                    }

                } catch (err) {
                    console.error('[ProfilePic Error]', err.message || err);
                    await sock.sendMessage(from, { 
                        text: '❌ Failed to fetch profile picture. The user may not have a profile picture set or it may be private.' 
                    }, { quoted: msg });
                }
            }

            if (body.startsWith('!savepic')) {
                try {
                    // Check if a picture is attached
                    const isQuoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
                    
                    if (!isQuoted) {
                        await sock.sendMessage(from, { text: '❌ Please reply to an image with !savepic @mention' }, { quoted: msg });
                        return;
                    }
                    
                    // Get target JID from message
                    let targetJid;
                    let nickname;
                    
                    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                        nickname = body.split('@')[1]?.trim() || targetJid.split('@')[0];
                    } else {
                        // If no mention, save as the sender
                        targetJid = msg.key.participant || msg.key.remoteJid;
                        nickname = body.slice(9).trim() || targetJid.split('@')[0];
                    }
                    
                    // Download the quoted image
                    const stream = await downloadContentFromMessage(
                        msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage, 
                        'image'
                    );
                    
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    
                    // Save to profiles folder
                    const filePath = path.join(PROFILES_FOLDER, `${targetJid.split('@')[0]}.jpg`);
                    fs.writeFileSync(filePath, buffer);
                    
                    // Save nickname if provided (for future use)
                    const metaFilePath = path.join(PROFILES_FOLDER, `${targetJid.split('@')[0]}.json`);
                    fs.writeFileSync(metaFilePath, JSON.stringify({ 
                        nickname, 
                        savedBy: msg.key.remoteJid,
                        savedAt: new Date().toISOString() 
                    }));
                    
                    await sock.sendMessage(from, { 
                        text: `✅ Profile picture saved for ${nickname} (${targetJid.split('@')[0]})`
                    }, { quoted: msg });
                    
                } catch (err) {
                    console.error('[SavePic Error]', err.message || err);
                    await sock.sendMessage(from, { 
                        text: '❌ Failed to save profile picture. Make sure you replied to an image.'
                    }, { quoted: msg });
                }
            }

            if (body === '!riddle') {
                try {
                    const response = await axios.get('https://riddles-api.vercel.app/random');
                    const riddle = response.data;

                    const message = `🧠 *Riddle Time!*\n\n❓ ${riddle.riddle}\n\n💡 Reply to this message with your answer!`;
                    await sock.sendMessage(from, { text: message }, { quoted: msg });
                    
                    // Store the answer in a temporary cache for checking later
                    const riddleKey = `${from}_riddle`;
                    messageCache.set(riddleKey, {
                        answer: riddle.answer,
                        timestamp: new Date().getTime(),
                        solved: false
                    });
                    
                } catch (error) {
                    console.error('[Riddle Error]', error.message || error);
                    await sock.sendMessage(from, { text: "❌ Couldn't fetch a riddle right now. Try again later!" }, { quoted: msg });
                }
            }

            // Check if this message is a reply to a riddle
            if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
                
                // Check if the quoted message is a riddle
                if (quotedText.includes('🧠 *Riddle Time!*')) {
                    const riddleKey = `${from}_riddle`;
                    const riddleData = messageCache.get(riddleKey);
                    
                    if (riddleData && !riddleData.solved) {
                        const userAnswer = body.trim().toLowerCase();
                        const correctAnswer = riddleData.answer.toLowerCase();
                        
                        // Basic answer checking - could be improved with similarity matching
                        if (userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
                            await sock.sendMessage(from, { 
                                text: `✅ *Correct!*\n\nThe answer is indeed: "${riddleData.answer}"\n\nWell done! 🎉` 
                            }, { quoted: msg });
                            
                            // Mark as solved
                            riddleData.solved = true;
                            messageCache.set(riddleKey, riddleData);
                        } else {
                            await sock.sendMessage(from, { 
                                text: `❌ That's not correct. Try again or send "!riddlehint" for a hint.` 
                            }, { quoted: msg });
                        }
                    }
                }
            }
            
            // Add a hint command
            if (body === '!riddlehint') {
                const riddleKey = `${from}_riddle`;
                const riddleData = messageCache.get(riddleKey);
                
                if (riddleData && !riddleData.solved) {
                    const answer = riddleData.answer;
                    // Create a hint by revealing some characters
                    let hint = '';
                    for (let i = 0; i < answer.length; i++) {
                        if (answer[i] === ' ') {
                            hint += ' ';
                        } else if (i % 3 === 0) { // Show every third character
                            hint += answer[i];
                        } else {
                            hint += '_';
                        }
                    }
                    
                    await sock.sendMessage(from, { 
                        text: `🔍 *Hint*: ${hint}` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { 
                        text: `❓ There's no active riddle to hint for. Try sending "!riddle" first!` 
                    }, { quoted: msg });
                }
            }
            
            // Add a reveal answer command
            if (body === '!riddleanswer') {
                const riddleKey = `${from}_riddle`;
                const riddleData = messageCache.get(riddleKey);
                
                if (riddleData) {
                    await sock.sendMessage(from, { 
                        text: `🔓 The answer to the riddle is: "${riddleData.answer}"` 
                    }, { quoted: msg });
                    
                    // Mark as solved
                    riddleData.solved = true;
                    messageCache.set(riddleKey, riddleData);
                } else {
                    await sock.sendMessage(from, { 
                        text: `❓ There's no active riddle. Try sending "!riddle" first!` 
                    }, { quoted: msg });
                }
            }

            if (body === '!sticker') {
                try {
                    // Check if image is available
                    const isDirectImage = !!msg.message?.imageMessage;
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const isQuotedImage = !!quotedMsg?.imageMessage;
                    
                    // Validate image exists
                    if (!isDirectImage && !isQuotedImage) {
                        await sock.sendMessage(from, { 
                            text: "❌ Please send an image with caption !sticker or reply to an image with !sticker"
                        }, { quoted: msg });
                        return;
                    }
                    
                    // Send processing message
                    await sock.sendMessage(from, { text: "⌛ Processing sticker..." }, { quoted: msg });
                    
                    // Get media content
                    let stream;
                    if (isDirectImage) {
                        stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                    } else {
                        stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
                    }
                    
                    // Convert to buffer
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    
                    // Use sharp to convert and resize for sticker
                    const sharp = require('sharp');
                    
                    // Process the image - resize to 512x512 and convert to WebP
                    const processedImage = await sharp(buffer)
                        .resize({
                            width: 512,
                            height: 512,
                            fit: 'contain',
                            background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent background
                        })
                        .toFormat('webp')
                        .toBuffer();
                    
                    // Send as sticker
                    await sock.sendMessage(from, {
                        sticker: processedImage
                    }, { quoted: msg });
                    
                } catch (err) {
                    console.error("❌ Error making sticker:", err);
                    await sock.sendMessage(from, { text: "⚠️ Failed to convert to sticker. Try again!" }, { quoted: msg });
                }
            }

            if (body === '!toimage' || body === '!stickertoimg') {
                try {
                    // Check if reply to a sticker
                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const isQuotedSticker = !!quotedMsg?.stickerMessage;
                    
                    if (!isQuotedSticker) {
                        await sock.sendMessage(from, { 
                            text: "❌ Please reply to a sticker with !toimage"
                        }, { quoted: msg });
                        return;
                    }
                    
                    // Send processing message
                    await sock.sendMessage(from, { text: "⌛ Converting sticker to image..." }, { quoted: msg });
                    
                    // Download sticker
                    const stream = await downloadContentFromMessage(quotedMsg.stickerMessage, 'image');
                    
                    // Convert to buffer
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    
                    // Use sharp to convert WebP to PNG
                    const sharp = require('sharp');
                    
                    // Process the sticker - convert to PNG
                    const processedImage = await sharp(buffer)
                        .toFormat('png')
                        .toBuffer();
                    
                    // Send as image
                    await sock.sendMessage(from, {
                        image: processedImage,
                        caption: "🖼️ Converted from sticker to image"
                    }, { quoted: msg });
                    
                } catch (err) {
                    console.error("❌ Error converting sticker:", err);
                    await sock.sendMessage(from, { text: "⚠️ Failed to convert sticker to image. Try again!" }, { quoted: msg });
                }
            }

            if (body.startsWith('!ascii ')) {
                const inputText = body.slice(7).trim();
                if (!inputText) {
                    await sock.sendMessage(from, { text: "❗ Please provide some text.\nUsage: !ascii Hello" }, { quoted: msg });
                    return;
                }

                figlet(inputText, function (err, data) {
                    if (err) {
                        console.error('❌ Figlet error:', err);
                        sock.sendMessage(from, { text: '⚠️ Could not generate ASCII art.' }, { quoted: msg });
                        return;
                    }

                    sock.sendMessage(from, { text: '```' + data + '```' }, { quoted: msg });  // send in code block
                });
            }

            if (body.startsWith('!aesthetic ')) {
                const inputText = body.slice(11).trim();
                if (!inputText) {
                    await sock.sendMessage(from, { text: "❗ Please provide some text.\nUsage: !aesthetic Hello" }, { quoted: msg });
                    return;
                }

                // Convert to aesthetic (full-width) characters
                const aestheticText = inputText.split('').map(char => {
                    if (char === ' ') return ' ';
                    const code = char.charCodeAt(0);
                    return (code >= 33 && code <= 126) ? String.fromCharCode(0xFF00 + code - 0x20) : char;
                }).join('');

                await sock.sendMessage(from, { text: aestheticText }, { quoted: msg });
            }

            if (body.startsWith("!summarize ")) {
                const input = body.slice(10).trim();
                
                if (!input) {
                    await sock.sendMessage(from, { 
                        text: "❌ Please provide text or a URL to summarize.\n\nExamples:\n!summarize https://en.wikipedia.org/wiki/Artificial_intelligence\n!summarize [your text here]" 
                    }, { quoted: msg });
                    return;
                }
                
                // Send a processing message
                await sock.sendMessage(from, { text: "⌛ Processing summary request..." }, { quoted: msg });
                
                try {
                    const summary = await summarizeInput(input);
                    
                    // Format the summary response
                    let responseText = "";
                    
                    if (input.includes("youtube.com") || input.includes("youtu.be")) {
                        responseText = `🎥 *YouTube Video Summary*\n\n${summary}`;
                    } else if (input.startsWith("http")) {
                        responseText = `🌐 *Web Page Summary*\n\n${summary}`;
                    } else {
                        responseText = `📝 *Text Summary*\n\n${summary}`;
                    }
                    
                    await sock.sendMessage(from, { text: responseText }, { quoted: msg });
                } catch (error) {
                    console.error("Summarize error:", error);
                    await sock.sendMessage(from, { 
                        text: "❌ Error generating summary. Please try again later or provide a different input." 
                    }, { quoted: msg });
                }
            }

            if (body.startsWith('!movie ')) {
                const title = body.slice(7).trim();
                const movie = await getMovieInfo(title);
              
                if (movie.error) {
                  await sock.sendMessage(from, { text: `❌ ${movie.error}` }, { quoted: msg });
                } else {
                  const caption = `🎬 *${movie.title}* (${movie.year})
              ⭐ IMDB: ${movie.imdbRating}
              📅 Released: ${movie.released}
              🕒 Runtime: ${movie.runtime}
              🎭 Genre: ${movie.genre}
              🎬 Director: ${movie.director}
              📝 Writer: ${movie.writer}
              👥 Cast: ${movie.actors}
              
              📝 *Plot*: ${movie.plot}
              🌍 Language: ${movie.language}
              🏆 Awards: ${movie.awards}`;
              
                  if (movie.poster && movie.poster !== 'N/A') {
                    await sock.sendMessage(from, {
                      image: { url: movie.poster },
                      caption
                    }, { quoted: msg });
                  } else {
                    await sock.sendMessage(from, { text: caption }, { quoted: msg });
                  }
                }
              }

              if (body.startsWith('!anime ')) {
                const title = body.slice(7).trim();
                const anime = await getAnimeInfo(title);
              
                if (anime.error) {
                  await sock.sendMessage(from, { text: `❌ ${anime.error}` }, { quoted: msg });
                } else {
                  const caption = `🎌 *${anime.title}* (${anime.japaneseTitle || "N/A"})
              ⭐ Score: ${anime.score} | 🧾 Rated: ${anime.rating}
              📺 Type: ${anime.type} | 🧩 Episodes: ${anime.episodes}
              📡 Status: ${anime.status}
              🗓️ Aired: ${anime.aired}
              🎭 Genres: ${anime.genres}
              
              📝 *Synopsis:* ${anime.synopsis}
              
              🔗 [MyAnimeList](${anime.url})`;
              
                  await sock.sendMessage(from, {
                    image: { url: anime.image },
                    caption
                  }, { quoted: msg });
                }
            }

            if (body.startsWith("!google ")) {
                const query = body.slice(8).trim();
                const result = await googleSearch(query);
                await sock.sendMessage(from, { text: result }, { quoted: msg });
            }

            if (body === "!score") {
                const score = await getLiveCricketScore();
                await sock.sendMessage(from, { text: score }, { quoted: msg });
            }

            if (body.startsWith('!song ')) {
                const query = body.slice(6).trim();
                if (!query) return sock.sendMessage(from, { text: "⚠️ Usage: !song <song name>" }, { quoted: msg });
            
                // Send processing message
                const processingMsg = await sock.sendMessage(from, { text: "🎵 Searching and downloading song..." }, { quoted: msg });
            
                try {
                    const songData = await getSongAudio(query);
            
                    if (!songData) {
                        return sock.sendMessage(from, { text: "❌ Song not found. Try with a more specific name." }, { quoted: msg });
                    }
                    
                    // Create a nice caption
                    const caption = `🎵 *${songData.title}*\n` + 
                                   `👤 ${songData.artist !== 'Unknown Artist' ? songData.artist : songData.channel || 'Unknown Artist'}\n` +
                                   `⏱️ Duration: ${songData.duration || 'Unknown'}\n` +
                                   `${songData.genre ? `🎭 Genre: ${songData.genre}\n` : ''}` +
                                   `${songData.year ? `📅 Year: ${songData.year}\n` : ''}` +
                                   `\n🔍 Requested: "${query}"`;
                    
                    // Send as audio with thumbnail if available
                    if (songData.thumbnail) {
                        await sock.sendMessage(from, {
                            audio: { url: songData.filePath },
                            mimetype: 'audio/mpeg',
                            fileName: `${songData.title}.mp3`,
                            contextInfo: {
                                externalAdReply: {
                                    title: songData.title,
                                    body: songData.artist,
                                    mediaType: 1,
                                    thumbnailUrl: songData.thumbnail,
                                    sourceUrl: songData.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
                                }
                            }
                        }, { quoted: msg });
                    } else {
                        // Fallback to regular audio send if no thumbnail
                        await sock.sendMessage(from, {
                            audio: { url: songData.filePath },
                            mimetype: 'audio/mpeg',
                            fileName: `${songData.title}.mp3`,
                        }, { quoted: msg });
                    }
                    
                    // Add the caption separately
                    await sock.sendMessage(from, {
                        text: caption
                    }, { quoted: msg });
                    
                    // Clean up the temp file - Don't delete cached files
                    if (!songData.fromCache) {
                        fs.unlinkSync(songData.filePath);
                    }
                } catch (error) {
                    console.error("Song download error:", error);
                    await sock.sendMessage(from, { 
                        text: "❌ Error downloading song. Please try again later or provide a different song name." 
                    }, { quoted: msg });
                }
            }

            if (body.startsWith('!lyrics ')) {
                const query = body.slice(8).trim();
                if (!query) return sock.sendMessage(from, { text: "❌ Provide song name!" }, { quoted: msg });
            
                const data = await getLyrics(query);
            
                if (data.error) {
                    return sock.sendMessage(from, { text: data.error }, { quoted: msg });
                }
            
                const { title, lyrics, thumbnail } = data;
                const responseText = `🎵 *${title}*\n\n${lyrics.length > 4000 ? lyrics.slice(0, 3990) + "..." : lyrics}`;
            
                await sock.sendMessage(from, {
                    image: { url: thumbnail },
                    caption: responseText
                }, { quoted: msg });
            }
            
            if (body.startsWith('!docchat')) {
                const quoted = msg.quoted || (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);
                if (!quoted || !quoted.message?.documentMessage?.fileName) {
                    return await sock.sendMessage(msg.key.remoteJid, {
                        text: '📄 Please *reply to a document* with:\n```!docchat [your question]```'
                    }, { quoted: msg });
                }

                const fileMessage = quoted.message.documentMessage;
                const mime = fileMessage.mimetype;
                const fileName = fileMessage.fileName;

                try {
                    // Send processing message
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: "⏳ Processing document, please wait..." 
                    }, { quoted: msg });

                    const buffer = await downloadMediaMessage(quoted, 'buffer', {}, {});
                    const question = body.replace('!docchat', '').trim() || 'Summarize the document';
                    
                    const docchat = require('./lib/docchat');
                    const reply = await docchat(buffer, fileName, mime, question);

                    if (!reply) {
                        throw new Error('No response from document processor');
                    }

                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: reply 
                    }, { quoted: msg });
                } catch (docError) {
                    console.error("Document processing error:", docError);
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: "❌ Error processing document. Please make sure the document is in a supported format (PDF, TXT, DOC) and try again." 
                    }, { quoted: msg });
                }
            }

            if (body.startsWith('!vision')) {
                await visionHandler(msg, sock, from); 
            }
            
            if (body.startsWith('!analyzevideo')) {
                try {
                  // Check if this is a quoted video or direct video message
                  const videoMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
                               || msg.message?.videoMessage;
                  
                  if (!videoMsg) {
                    await sock.sendMessage(from, { text: "📼 Reply to a video with !analyzevideo or send a video with caption !analyzevideo" });
                    return;
                  }
              
                  // Send processing message
                  await sock.sendMessage(from, { text: "⏳ Analyzing video, please wait... This may take some time depending on the video length." });
                  
                  // Download the video
                  const buffer = await downloadMediaMessage(
                    {
                      message: { videoMessage: videoMsg },
                      key: msg.key
                    },
                    "buffer"
                  );
                  
                  // Ensure temp directory exists
                  if (!fs.existsSync('./temp')) {
                    fs.mkdirSync('./temp', { recursive: true });
                  }
                  
                  // Save the video temporarily
                  const fileName = `./temp/video_${Date.now()}.mp4`;
                  fs.writeFileSync(fileName, buffer);
              
                  // Import the analyzer module
                  const { analyzeVideo } = require('./lib/video_analyzer');
                  
                  // Analyze the video
                  const result = await analyzeVideo(fileName);
                  await sock.sendMessage(from, { text: result || "⚠️ Couldn't analyze this video." });
              
                  // Clean up
                  if (fs.existsSync(fileName)) {
                    fs.unlinkSync(fileName);
                  }
                } catch (err) {
                  console.error("Video Analysis Error:", err);
                  await sock.sendMessage(from, { text: "❌ Error analyzing video. Make sure ffmpeg is installed on your system." });
                }
            }

            if (body.startsWith('!videogen')) {
                const query = body.slice(10).trim();
                if (!query) {
                  await sock.sendMessage(from, { text: "🎥 Please provide a prompt. Example: `!videogen a panda dancing in space`" });
                  return;
                }
            
                await sock.sendMessage(from, { text: "⏳ Generating your video with Dream Machine... This may take a minute." });
            
                try {
                  const { generateVideoFromPrompt } = require('./lib/videogen');
                  
                  // First send a detailed status message
                  await sock.sendMessage(from, { 
                    text: "🎬 Generating AI video...\n\n" +
                          "⏳ This process takes 30-60 seconds\n" +
                          "🔄 Creating a short video from your prompt\n" +
                          "🧠 Using Stability AI's video generation\n\n" +
                          "⚠️ Note: This feature requires billing setup on Replicate.com"
                  });
                  
                  const videoPath = await generateVideoFromPrompt(query);
                  
                  // Send the video file
                  await sock.sendMessage(from, {
                    video: { url: videoPath },
                    caption: `🎬 Here's your AI video for: "${query}"`,
                    gifPlayback: false
                  }, { quoted: msg });
                  
                  // Clean up the temporary file after sending
                  setTimeout(() => {
                    try {
                      if (fs.existsSync(videoPath)) {
                        fs.unlinkSync(videoPath);
                        console.log(`Deleted temporary video file: ${videoPath}`);
                      }
                    } catch (cleanupError) {
                      console.error("Failed to delete temporary video file:", cleanupError);
                    }
                  }, 10000); // Wait 10 seconds to ensure the file is sent
                  
                } catch (err) {
                  console.error(err);
                  // Get more details from the error
                  let errorMsg = "❌ Failed to generate video.";
                  
                  // Special handling for billing-related errors
                  if (err.message && err.message.includes("billing")) {
                    errorMsg = "❌ This feature requires billing setup.\n\n" +
                               "To use AI video generation, you need to set up billing on Replicate:\n" +
                               "1. Go to https://replicate.com/account/billing\n" +
                               "2. Add a payment method\n" +
                               "3. Then try again with !videogen";
                  } else if (err.response && err.response.data) {
                    errorMsg += `\n\nAPI Error: ${err.response.data.detail || err.response.data.title || "Unknown API error"}`;
                  } else if (err.message) {
                    errorMsg += `\n\nError: ${err.message}`;
                  }
                  
                  await sock.sendMessage(from, { text: errorMsg });
                }
            }

            if (body.startsWith('!animechar')) {
                try {
                    // Extract character name from command
                    const characterName = body.slice(10).trim();
                    
                    if (!characterName || characterName.length < 2) {
                        await sock.sendMessage(from, { 
                            text: "⚠️ Please provide a character name. Example: `!animechar naruto`" 
                        }, { quoted: msg });
                        return;
                    }
                    
                    // Send processing message
                    await sock.sendMessage(from, { text: `🔍 Finding ${characterName} for you...` });
                    
                    // Get character image
                    const imageUrl = await getAnimeCharacterImage(characterName);
                    
                    // Send the image
                    await sock.sendMessage(from, {
                        image: { url: imageUrl },
                        caption: `✨ Here's ${characterName} for you!`
                    }, { quoted: msg }).catch(async (sendError) => {
                        console.error("Error sending character image:", sendError.message);
                        // Try without quoting the message if that fails
                        await sock.sendMessage(from, {
                            image: { url: imageUrl },
                            caption: `✨ Here's ${characterName} for you!`
                        });
                    });
                    
                } catch (err) {
                    console.error("Anime character image error:", err.message);
                    
                    // Send a more friendly error message
                    await sock.sendMessage(from, { 
                        text: `❌ I couldn't find ${body.slice(10).trim()}. Try with a more popular anime character like naruto, goku, or waifu.` 
                    }, { quoted: msg });
                }
            }
            
            // Caller ID lookup (!whois command)
            if (body.startsWith('!whois')) {
                try {
                    // Extract phone number from command
                    let phoneNumber = body.slice(6).trim();
                    
                    // Check if command is used in reply to a message
                    let lookupFromReply = false;
                    if (!phoneNumber && msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.participant) {
                        // If replying to a message, use that participant's number
                        phoneNumber = msg.message.extendedTextMessage.contextInfo.participant.split('@')[0];
                        lookupFromReply = true;
                    }
                    
                    if (!phoneNumber) {
                        await sock.sendMessage(from, { 
                            text: "⚠️ Please provide a phone number or reply to a message. Example: `!whois +1234567890`" 
                        }, { quoted: msg });
                        return;
                    }
                    
                    // Send processing message
                    await sock.sendMessage(from, { text: `🔍 Looking up information for ${phoneNumber}...` });
                    
                    // Get phone information
                    const phoneInfo = await lookupPhoneNumber(phoneNumber);
                    
                    // Format the response
                    let responseText = `📱 *Caller ID Lookup Results* 📱\n\n`;
                    responseText += `📞 *Number:* ${phoneInfo.number}\n`;
                    
                    if (phoneInfo.name && phoneInfo.name !== 'Unknown') {
                        responseText += `👤 *Name:* ${phoneInfo.name}\n`;
                    }
                    
                    if (phoneInfo.email) {
                        responseText += `📧 *Email:* ${phoneInfo.email}\n`;
                    }
                    
                    if (phoneInfo.carrier && phoneInfo.carrier !== 'Unknown') {
                        responseText += `🌐 *Carrier:* ${phoneInfo.carrier}\n`;
                    }
                    
                    if (phoneInfo.countryName && phoneInfo.countryName !== 'Unknown') {
                        responseText += `🌍 *Country:* ${phoneInfo.countryName}`;
                        if (phoneInfo.countryCode && phoneInfo.countryCode !== 'Unknown') {
                            responseText += ` (${phoneInfo.countryCode})`;
                        }
                        responseText += `\n`;
                    } else if (phoneInfo.countryCode && phoneInfo.countryCode !== 'Unknown') {
                        responseText += `🌍 *Country Code:* ${phoneInfo.countryCode}\n`;
                    }
                    
                    if (phoneInfo.location && phoneInfo.location !== 'Unknown') {
                        responseText += `📍 *Location:* ${phoneInfo.location}\n`;
                    }
                    
                    if (phoneInfo.lineType && phoneInfo.lineType !== 'Unknown') {
                        responseText += `📲 *Line Type:* ${phoneInfo.lineType}\n`;
                    }
                    
                    if (phoneInfo.isValid !== undefined) {
                        responseText += `✅ *Valid Number:* ${phoneInfo.isValid ? 'Yes' : 'No'}\n`;
                    }
                    
                    // Send the formatted info
                    await sock.sendMessage(from, { text: responseText }, { quoted: msg });
                    
                } catch (err) {
                    console.error("Phone lookup error:", err.message);
                    
                    // Send a more friendly error message
                    await sock.sendMessage(from, { 
                        text: `❌ I couldn't find information for this number. The service might be temporarily unavailable or the number format is incorrect.` 
                    }, { quoted: msg });
                }
            }
            
            // Social profile finder command
            if (body.startsWith('!social')) {
                try {
                    // Extract input from command (can be phone number or email)
                    let input = body.slice(8).trim();
                    
                    // Check if command is used in reply to a message
                    if (!input && msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.participant) {
                        // If replying to a message, use that participant's number
                        input = msg.message.extendedTextMessage.contextInfo.participant.split('@')[0];
                    }
                    
                    if (!input) {
                        await sock.sendMessage(from, { 
                            text: "⚠️ Please provide a phone number or email. Example: `!social +1234567890` or `!social example@gmail.com`" 
                        }, { quoted: msg });
                        return;
                    }
                    
                    // Send processing message
                    await sock.sendMessage(from, { text: `🔍 Searching for social profiles linked to ${input}...` });
                    
                    // Search for social profiles
                    const results = await findSocialProfiles(input);
                    
                    // Format the response
                    let responseText = `🔎 *Social Profile Search Results* 🔎\n\n`;
                    responseText += `📊 *Input:* ${results.input} (${results.inputType})\n\n`;
                    
                    // Add confirmed profiles
                    if (results.profiles && results.profiles.length > 0) {
                        responseText += `✅ *Confirmed Profiles:*\n`;
                        results.profiles.forEach(profile => {
                            responseText += `• *${profile.network}*: ${profile.url || profile.username || 'N/A'}\n`;
                        });
                        responseText += `\n`;
                    }
                    
                    // Add possible matches
                    if (results.possibleMatches && results.possibleMatches.length > 0) {
                        responseText += `🔍 *Possible Matches:*\n`;
                        results.possibleMatches.forEach(profile => {
                            responseText += `• *${profile.network}*: ${profile.url || 'N/A'}\n`;
                        });
                        responseText += `\n`;
                    }
                    
                    // Add metadata if available
                    if (results.metadata) {
                        if (results.metadata.name) {
                            responseText += `👤 *Name:* ${results.metadata.name.fullName || 'Unknown'}\n`;
                        }
                        
                        if (results.metadata.employment) {
                            responseText += `💼 *Works at:* ${results.metadata.employment.company || 'Unknown'}`;
                            if (results.metadata.employment.title) {
                                responseText += ` (${results.metadata.employment.title})`;
                            }
                            responseText += `\n`;
                        }
                        
                        if (results.metadata.reputation) {
                            responseText += `🛡️ *Reputation:* ${results.metadata.reputation.score || 'Unknown'}\n`;
                            
                            if (results.metadata.reputation.credentials_leaked) {
                                responseText += `⚠️ *Warning:* Credentials have been leaked in data breaches\n`;
                            }
                        }
                    }
                    
                    // No results message
                    if ((!results.profiles || results.profiles.length === 0) && 
                        (!results.possibleMatches || results.possibleMatches.length === 0)) {
                        responseText += `❌ No social profiles found for this ${results.inputType}.\n`;
                    }
                    
                    // Add privacy notice
                    responseText += `\n📝 *Note:* This information is gathered from public sources.`;
                    
                    // Send the formatted info
                    await sock.sendMessage(from, { text: responseText }, { quoted: msg });
                    
                } catch (err) {
                    console.error("Social profile search error:", err.message);
                    
                    // Send a more friendly error message
                    await sock.sendMessage(from, { 
                        text: `❌ I couldn't find social profiles for this input. The service might be temporarily unavailable or the format is incorrect.` 
                    }, { quoted: msg });
                }
            }
            
            // Handle character names beginning with exclamation mark (!)
        } catch (error) {
            console.error("Error processing message:", error);
            try {
                // Only try to send an error message if we have a valid message object
                if (typeof msg !== 'undefined' && msg?.key?.remoteJid) {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: "❌ Error processing message. Please try again later." 
                    }, { quoted: msg });
                }
            } catch (sendError) {
                console.error("Failed to send error message:", sendError);
            }
        }
    })
}

startBot()