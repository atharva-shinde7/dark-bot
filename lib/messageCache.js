// lib/messageCache.js
const messageCache = new Map();

function cacheMessage(key, message) {
  messageCache.set(key, message);
  setTimeout(() => messageCache.delete(key), 5 * 60 * 1000); // Keep for 5 mins
}

function getCachedMessage(key) {
  return messageCache.get(key);
}

module.exports = { cacheMessage, getCachedMessage };
