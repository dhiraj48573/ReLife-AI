/**
 * LLM Configuration
 * 
 * Supports configurable LLM providers: 'gemini', 'openai', or 'mock'.
 * All API keys remain strictly server-side in environment variables.
 */

require('dotenv').config();

module.exports = {
  get provider() {
    return process.env.LLM_PROVIDER || 'mock';
  },
  gemini: {
    get apiKey() {
      return process.env.GEMINI_API_KEY || '';
    },
    get model() {
      return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    },
    get endpoint() {
      return process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta';
    }
  },
  openai: {
    get apiKey() {
      return process.env.OPENAI_API_KEY || '';
    },
    get model() {
      return process.env.OPENAI_MODEL || 'gpt-4o-mini';
    },
    get endpoint() {
      return process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1';
    }
  },
  get timeoutMs() {
    return parseInt(process.env.LLM_TIMEOUT_MS, 10) || 12000;
  },
  maxOutputTokens: 800,
  temperature: 0.4
};
