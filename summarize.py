import os
import sys
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup

# Load .env file
load_dotenv()
api_key = os.getenv('GEMINI_API_KEY')

if not api_key or api_key == "your_gemini_api_key":
    print("❌ Error: No valid GEMINI_API_KEY found in .env file")
    print("Please add a valid Gemini API key to your .env file:")
    print("GEMINI_API_KEY=your_gemini_api_key_here")
    sys.exit(1)

try:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
except ImportError:
    print("❌ Error: The google-generativeai package is not installed.")
    print("Run: pip install google-generativeai")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error configuring Gemini API: {e}")
    sys.exit(1)

# Check if YouTube transcript API is available
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    youtube_api_available = True
except ImportError:
    print("⚠️ Warning: YouTube transcript API not available. YouTube video summarization will be limited.")
    print("To install: pip install youtube-transcript-api")
    youtube_api_available = False

# Get text from generic websites
def fetch_text_from_url(url):
    try:
        response = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try to extract content from article body first
        article_tags = soup.find_all('article')
        if article_tags:
            paragraphs = []
            for article in article_tags:
                paragraphs.extend(article.find_all('p'))
            if paragraphs:
                return ' '.join(p.text for p in paragraphs)
        
        # Special handling for Wikipedia
        if 'wikipedia.org' in url:
            wiki_content = soup.select('#mw-content-text .mw-parser-output > p')
            if wiki_content:
                return ' '.join(p.text for p in wiki_content)
        
        # If no article tags or no paragraphs in articles, get all paragraphs
        paragraphs = soup.find_all('p')
        return ' '.join(p.text for p in paragraphs)
    except Exception as e:
        print(f"Error fetching URL content: {e}")
        return None

# Get text from YouTube transcripts
def fetch_text_from_youtube(url):
    if not youtube_api_available:
        return f"Cannot fetch YouTube transcript: youtube-transcript-api not installed. URL: {url}"
        
    try:
        if "v=" in url:
            video_id = url.split("v=")[-1].split("&")[0]
        elif "youtu.be/" in url:
            video_id = url.split("youtu.be/")[-1].split("?")[0]
        else:
            raise ValueError("Invalid YouTube URL format")
        
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join([entry['text'] for entry in transcript])
    except Exception as e:
        print(f"Error fetching YouTube transcript: {e}")
        return None

# Summarize with Gemini
def summarize_text_with_gemini(text):
    try:
        model = genai.GenerativeModel('models/gemini-2.0-flash')
        response = model.generate_content(f"Summarize this text in detail, preserving important information:\n\n{text}")
        return response.text.strip()
    except Exception as e:
        print(f"Error during summarization: {e}")
        return None

# Main summarization handler
def handle_summarize_command(input_text):
    if not input_text or input_text.strip() == "":
        return "❌ Error: No text provided for summarization."
        
    extracted_text = None
    source_type = "text"
    
    print(f"Processing input: {input_text[:50]}...")

    if "youtube.com" in input_text or "youtu.be" in input_text:
        print("Detected YouTube URL, fetching transcript...")
        source_type = "YouTube video"
        extracted_text = fetch_text_from_youtube(input_text)
    elif input_text.startswith(("http://", "https://")):
        print(f"Detected URL, fetching content from: {input_text}")
        source_type = "article"
        extracted_text = fetch_text_from_url(input_text)
    else:
        print("Processing direct text input...")
        extracted_text = input_text

    if extracted_text:
        print(f"Extracted {len(extracted_text)} characters of text. Summarizing...")
        summary = summarize_text_with_gemini(extracted_text)
        if summary:
            print("Summarization successful!")
            return summary
        else:
            return f"❌ Failed to generate summary for this {source_type}."
    else:
        return f"❌ Failed to extract content from this {source_type}."

# Main function for CLI usage
if __name__ == "__main__":
    # Check if input is provided as argument
    if len(sys.argv) > 1:
        user_input = sys.argv[1]
        print(f"Input provided as argument: {user_input[:50]}...")
    else:
        # Read from stdin (for Node.js integration)
        print("Reading from stdin...")
        user_input = sys.stdin.read().strip()
        if user_input:
            print(f"Got input from stdin: {user_input[:50]}...")
    
    # If no input provided at all, prompt the user
    if not user_input:
        print("No input detected. Prompting user...")
        user_input = input("Enter text or URL to summarize: ")
    
    summary = handle_summarize_command(user_input)
    print("\nSUMMARY:\n", summary)
