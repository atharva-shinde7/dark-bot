const axios = require("axios");
const cheerio = require("cheerio");
const { spawn } = require('child_process');
const path = require('path');

// List of common user agents to rotate through
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

const getRandomUserAgent = () => {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

const fetchWithRetry = async (url, maxRetries = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const headers = {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            };

            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
            // Wait for a short time before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
};

const extractArticleContent = ($) => {
    // Try different selectors commonly used for article content
    const selectors = [
        'article', // Common article wrapper
        '.article-content',
        '#article-content',
        '.post-content',
        'main',
        '[role="main"]',
        '.content',
        '#content'
    ];

    for (const selector of selectors) {
        const content = $(selector).find('p').map((i, el) => $(el).text()).get().join(" ");
        if (content && content.length > 100) {
            return content;
        }
    }

    // Fallback to all paragraphs if no article content found
    return $("p").map((i, el) => $(el).text()).get().join(" ");
};

const callPythonSummarizer = async (text) => {
  return new Promise((resolve, reject) => {
    // Spawn Python process
    const pythonProcess = spawn('python', [
      path.join(__dirname, '..', 'summarize.py'),
      text
    ]);

    let result = '';
    let error = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    // Collect errors from stderr
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error('Python Error:', error);
        reject(new Error(error || 'Failed to summarize text'));
      } else {
        resolve(result.trim());
      }
    });
  });
};

const summarizeInput = async (input) => {
  const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^\s&]+)/;
  const match = input.match(ytRegex);

  try {
    let textToSummarize = "";

    if (match) {
      // Extract the video ID
      const videoId = match[1];
      
      try {
        // Get YouTube metadata using oEmbed API
        const response = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        
        // Try to get description
        const htmlResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
        const $ = cheerio.load(htmlResponse.data);
        let description = $('meta[name="description"]').attr('content') || "";
        
        textToSummarize = `Title: ${response.data.title}\nCreator: ${response.data.author_name}\nDescription: ${description}`;
        
        if (!textToSummarize || textToSummarize.length < 50) {
          return "⚠️ Could not get enough information about this YouTube video.";
        }
      } catch (videoError) {
        console.error("YouTube error:", videoError);
        return "⚠️ Could not access this YouTube video. It might be private or unavailable.";
      }
    } else if (input.startsWith("http")) {
      try {
        const html = await fetchWithRetry(input);
        const $ = cheerio.load(html);
        
        // Try to get article title
        const title = $('meta[property="og:title"]').attr('content') || 
                     $('title').text() || '';
        
        // Get article content
        const content = extractArticleContent($);
        
        if (title) {
          textToSummarize = `Title: ${title}\n\n${content}`;
        } else {
          textToSummarize = content;
        }
        
        textToSummarize = textToSummarize.slice(0, 3000); // Limit length
        
        if (!textToSummarize || textToSummarize.length < 50) {
          return "⚠️ Could not extract enough text from this webpage. The content might be protected or require authentication.";
        }
      } catch (webError) {
        console.error("Web scraping error:", webError);
        if (webError.response?.status === 403) {
          return "⚠️ Access to this webpage was denied. The site might have anti-bot protection or require authentication.";
        }
        return "⚠️ Could not access or parse this webpage. Please check if the URL is correct and publicly accessible.";
      }
    } else {
      // Direct text handling
      textToSummarize = input;
      
      if (textToSummarize.length < 50) {
        return "⚠️ Text is too short to summarize. Please provide more content.";
      }
    }

    // Call Python summarizer
    try {
      const summary = await callPythonSummarizer(textToSummarize);
      if (!summary) {
        return "❌ Could not generate summary. Please try again.";
      }
      return summary;
    } catch (summaryError) {
      console.error("Summary error:", summaryError);
      return "❌ Error generating summary. Please try again with different text.";
    }
  } catch (error) {
    console.error("Summarize error:", error);
    return "❌ Error summarizing. Please try again with direct text instead of a URL.";
  }
};

module.exports = summarizeInput;
