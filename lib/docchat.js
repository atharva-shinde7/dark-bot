// lib/docchat.js

const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to read and clean uploaded document content
async function readDocument(filePath) {
  try {
    const ext = path.extname(filePath);
    if (ext !== ".txt") throw new Error("Only .txt files are supported for now.");
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error("Failed to read document: " + err.message);
  }
}

// Function to initiate Gemini chat session with document context
async function createChatWithDocument(documentContent) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [
          {
            text:
              "You are a document assistant. Answer all future questions based on this document: " +
              documentContent,
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
    },
  });
  return chat;
}

// Global cache (can be improved)
let activeChats = {}; // { userId: { chat, documentTitle } }

// Function to start a session with a document
async function startDocChat(userId, filePath) {
  const content = await readDocument(filePath);
  const chat = await createChatWithDocument(content);
  activeChats[userId] = {
    chat,
    documentTitle: path.basename(filePath),
  };
  return `Document \"${path.basename(filePath)}\" loaded successfully.`;
}

// Function to ask questions based on the uploaded document
async function askDocQuestion(userId, question) {
  if (!activeChats[userId]) {
    return "No document session found. Please upload a document first.";
  }
  const chat = activeChats[userId].chat;
  const result = await chat.sendMessage(question);
  const response = await result.response;
  return response.text();
}

module.exports = {
  startDocChat,
  askDocQuestion,
};
