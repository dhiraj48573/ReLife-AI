/**
 * Support Assistant Service (Phase 5)
 * 
 * Orchestrates:
 * - Deterministic safety escalation (self-harm, crisis) with verified helplines
 * - Privacy-first journal context isolation (only sent if explicitly authorized)
 * - Retrieval-Augmented Generation (RAG) over verified emotional-wellness resources
 * - Prompt injection resistance & untrusted data boundaries
 * - Configurable LLM adapter with graceful fallback
 * - Multi-tenant chat history persistence scoped strictly to authenticated users
 */

const { v4: uuidv4 } = require('uuid');
const ChatHistory = require('../models/ChatHistory');
const Journal = require('../models/Journal');
const { checkCrisis } = require('./rag/safetyGuard');
const { retrieve } = require('./rag/ragService');
const { buildPrompt } = require('./rag/promptBuilder');
const { generateResponse } = require('./rag/llmAdapter');

const CLINICAL_DISCLAIMER = 'ReLife AI provides emotional wellness support and coping information, not medical diagnosis, psychiatric treatment, or licensed legal counsel. If you need clinical or legal assistance, please consult a licensed professional.';

/**
 * Process a message from an authenticated user
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - Authenticated user ID
 * @param {string} params.message - Raw user input text
 * @param {string} [params.sessionId] - Session ID
 * @param {boolean} [params.includeJournalContext=false] - Explicit user opt-in to share journal history
 * @param {string} [params.userLocation] - Optional user location for localized crisis response
 * @param {string} [params.overrideProvider] - Optional provider override (e.g. for testing)
 * @returns {Promise<Object>} Assistant response with citations, escalation flags, and disclaimer
 */
async function processSupportMessage({
  userId,
  message,
  sessionId,
  includeJournalContext = false,
  userLocation = '',
  overrideProvider = null
}) {
  // 1. Input Validation
  if (!message || typeof message !== 'string') {
    const error = new Error('A valid text message is required.');
    error.statusCode = 400;
    throw error;
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    const error = new Error('Message cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  if (trimmedMessage.length > 2000) {
    const error = new Error('Message exceeds the maximum limit of 2,000 characters.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Resolve Session & Verify Ownership
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    activeSessionId = uuidv4();
  } else {
    // Check if session exists and verify ownership
    const existingSession = await ChatHistory.findOne({ sessionId: activeSessionId });
    if (existingSession && existingSession.userId.toString() !== userId.toString()) {
      const error = new Error('Access denied. Chat session belongs to another user.');
      error.statusCode = 403;
      throw error;
    }
  }

  // 3. Deterministic Crisis Check (Explicit self-harm / immediate danger only)
  // CRITICAL: Sentiment score alone NEVER triggers a crisis!
  const crisisResult = checkCrisis({
    text: trimmedMessage,
    userLocation
  });

  if (crisisResult.isCrisis) {
    // Persist user query and crisis escalation response
    await recordExchange({
      sessionId: activeSessionId,
      userId,
      userMessage: trimmedMessage,
      botMessage: crisisResult.response,
      citations: crisisResult.citations,
      escalated: true,
      intent: 'crisis_escalation'
    });

    return {
      success: true,
      sessionId: activeSessionId,
      response: crisisResult.response,
      citations: crisisResult.citations,
      escalated: true,
      crisisDetected: true,
      disclaimer: crisisResult.disclaimer,
      provider: 'safety_guard_deterministic',
      providerStatus: 'escalated'
    };
  }

  // 4. Privacy Control: Journal History Context
  // Never send journal history unless the user explicitly chooses to share it
  let journalContext = '';
  if (includeJournalContext === true) {
    try {
      const recentEntries = await Journal.find({ userId })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('title mood sentiment.label createdAt')
        .lean();

      if (recentEntries && recentEntries.length > 0) {
        journalContext = recentEntries.map((e, idx) => {
          const dateStr = e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : 'Recent';
          const moodStr = e.mood ? `Self-reported mood: ${e.mood}/5` : '';
          const sentimentStr = e.sentiment?.label ? `Sentiment estimate: ${e.sentiment.label}` : '';
          const titleStr = e.title ? `Title: "${e.title}"` : '';
          return `[Journal ${idx + 1} (${dateStr})] ${[titleStr, moodStr, sentimentStr].filter(Boolean).join(' | ')}`;
        }).join('\n');
      }
    } catch (err) {
      console.warn('[SupportAssistant] Error fetching journal context:', err.message);
    }
  }

  // 5. RAG Knowledge Retrieval
  const ragResult = retrieve(trimmedMessage, { topK: 2, minScore: 2.0 });

  // 6. Fetch Recent History for Context
  let existingHistory = null;
  if (require('mongoose').connection.readyState === 1) {
    try {
      existingHistory = await ChatHistory.findOne(
        { sessionId: activeSessionId, userId },
        { messages: { $slice: -6 } }
      ).lean();
    } catch (dbErr) {
      console.warn('[SupportAssistant] Unable to fetch chat history:', dbErr.message);
    }
  }
  const recentHistory = existingHistory?.messages || [];

  // 7. Prompt Assembly with Untrusted Data Boundaries
  const { systemPrompt, userPrompt, hasInjectionAttempt } = buildPrompt({
    userMessage: trimmedMessage,
    retrievedContext: ragResult.contextText,
    journalContext,
    recentHistory
  });

  // 8. LLM Provider Generation with Graceful Fallback
  const llmResult = await generateResponse({
    systemPrompt,
    userPrompt,
    userMessage: trimmedMessage,
    retrievedChunks: ragResult.chunks,
    hasInjectionAttempt,
    overrideProvider
  });

  // 9. Persist Exchange to ChatHistory
  await recordExchange({
    sessionId: activeSessionId,
    userId,
    userMessage: trimmedMessage,
    botMessage: llmResult.text,
    citations: ragResult.citations,
    escalated: false,
    intent: hasInjectionAttempt ? 'security_boundary' : 'emotional_support'
  });

  // 10. Return Structured Assistant Response
  return {
    success: true,
    sessionId: activeSessionId,
    response: llmResult.text,
    citations: ragResult.citations,
    escalated: false,
    crisisDetected: false,
    disclaimer: CLINICAL_DISCLAIMER,
    provider: llmResult.provider,
    providerStatus: llmResult.status,
    hasInjectionAttempt
  };
}

/**
 * Record user and assistant messages to database
 */
async function recordExchange({
  sessionId,
  userId,
  userMessage,
  botMessage,
  citations = [],
  escalated = false,
  intent = null
}) {
  const userMsgObj = {
    sender: 'user',
    message: userMessage,
    timestamp: new Date()
  };

  const botMsgObj = {
    sender: 'bot',
    message: botMessage,
    citations,
    escalated,
    timestamp: new Date()
  };

  const update = {
    $push: {
      messages: { $each: [userMsgObj, botMsgObj] }
    },
    $set: {
      'context.lastIntent': intent,
      'context.lastInteraction': new Date()
    },
    $setOnInsert: {
      userId,
      sessionId,
      'context.userPreferences.language': 'en',
      'context.userPreferences.notify': true
    }
  };

  if (require('mongoose').connection.readyState === 1) {
    try {
      await ChatHistory.findOneAndUpdate(
        { sessionId },
        update,
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      console.warn('[SupportAssistant] Unable to record chat exchange:', dbErr.message);
    }
  }
}

/**
 * Retrieve chat history for a session with strict user ownership validation
 */
async function getSessionHistory(userId, sessionId, limit = 50) {
  if (!sessionId) return null;

  const session = await ChatHistory.findOne(
    { sessionId },
    { userId: 1, sessionId: 1, messages: { $slice: -limit }, createdAt: 1 }
  ).lean();

  if (!session) {
    return null;
  }

  // Strict ownership enforcement
  if (session.userId.toString() !== userId.toString()) {
    const error = new Error('Access denied. Chat session belongs to another user.');
    error.statusCode = 403;
    throw error;
  }

  return session.messages || [];
}

/**
 * Retrieve all chat sessions belonging to the authenticated user
 */
async function getUserSessions(userId, limit = 20) {
  const sessions = await ChatHistory.find(
    { userId },
    { sessionId: 1, createdAt: 1, 'context.lastIntent': 1, messages: { $slice: -1 } }
  )
    .sort({ 'context.lastInteraction': -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return sessions.map(s => ({
    sessionId: s.sessionId,
    createdAt: s.createdAt,
    lastIntent: s.context?.lastIntent || 'general',
    lastMessage: s.messages?.[0]?.message || ''
  }));
}

/**
 * Delete a chat session belonging to the authenticated user
 */
async function deleteUserSession(userId, sessionId) {
  const session = await ChatHistory.findOne({ sessionId });
  if (!session) {
    return false;
  }

  if (session.userId.toString() !== userId.toString()) {
    const error = new Error('Access denied. You cannot delete another user\'s session.');
    error.statusCode = 403;
    throw error;
  }

  await ChatHistory.deleteOne({ sessionId, userId });
  return true;
}

module.exports = {
  processSupportMessage,
  getSessionHistory,
  getUserSessions,
  deleteUserSession,
  CLINICAL_DISCLAIMER
};
