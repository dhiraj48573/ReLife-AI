const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const chatbotService = require('../services/chatbotService');
const supportAssistantService = require('../services/supportAssistantService');

// Rate limiter for chat endpoints (60 messages per 15 minutes window)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many messages sent. Please take a pause and try again in a few moments.'
  }
});

// Helper to extract verified userId from req.user
function getVerifiedUserId(req) {
  return req.user._id ? req.user._id.toString() : (req.user.userId || req.user.id);
}

// ============================================================================
// PHASE 5: AI EMOTIONAL SUPPORT ASSISTANT (RAG + SAFETY + CITATIONS)
// ============================================================================

/**
 * @route   POST /api/chatbot/message
 * @desc    Send a message to the AI Emotional Support Assistant (Phase 5)
 * @access  Private (Authenticated User)
 */
router.post('/message', [
  authenticateToken,
  chatLimiter,
  body('message')
    .isString().withMessage('Message must be a text string')
    .trim()
    .notEmpty().withMessage('Message cannot be empty')
    .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters'),
  body('sessionId').optional().isString().trim(),
  body('includeJournalContext').optional().isBoolean(),
  body('userLocation').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const userId = getVerifiedUserId(req);
    const { message, sessionId, includeJournalContext = false, userLocation } = req.body;

    const result = await supportAssistantService.processSupportMessage({
      userId,
      message,
      sessionId,
      includeJournalContext: Boolean(includeJournalContext),
      userLocation
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    console.error('[Chatbot Route] Error processing support message:', error.name || 'Error');
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your message.'
    });
  }
});

/**
 * @route   GET /api/chatbot/sessions
 * @desc    Get all chat sessions belonging to the authenticated user
 * @access  Private (Authenticated User)
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = getVerifiedUserId(req);
    const sessions = await supportAssistantService.getUserSessions(userId);

    return res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('[Chatbot Route] Error fetching user sessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching chat sessions',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/chatbot/history
 * @desc    Get chat history for a session (strictly isolated to owner)
 * @access  Private (Authenticated User)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.query;
    const userId = getVerifiedUserId(req);

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const history = await supportAssistantService.getSessionHistory(userId, sessionId);

    if (history === null) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    return res.status(200).json({
      success: true,
      sessionId,
      history
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    console.error('[Chatbot Route] Error fetching chat history:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching chat history',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/chatbot/history/:sessionId
 * @desc    Delete a chat session belonging to the authenticated user
 * @access  Private (Authenticated User)
 */
router.delete('/history/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = getVerifiedUserId(req);

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required in URL parameters'
      });
    }

    const deleted = await supportAssistantService.deleteUserSession(userId, sessionId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Chat session deleted successfully'
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    console.error('[Chatbot Route] Error deleting chat session:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting chat session',
      error: error.message
    });
  }
});

// ============================================================================
// LEGACY / COMPATIBILITY ROUTES (Rule-based Bot)
// ============================================================================

// Start a new chat session
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = getVerifiedUserId(req);

    const result = await chatbotService.startNewSession(userId, sessionId);

    res.status(200).json({
      success: true,
      sessionId: result.sessionId,
      response: result.message
    });
  } catch (error) {
    console.error('Error starting chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting chat session',
      error: error.message
    });
  }
});

// Rule-based chat endpoint (legacy)
router.post('/chat', authenticateToken, chatLimiter, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = getVerifiedUserId(req);

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid message'
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const { response, intent } = await chatbotService.processMessage(
      sessionId,
      userId,
      message
    );

    res.status(200).json({
      success: true,
      response,
      intent,
      sessionId
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing your request',
      error: error.message
    });
  }
});

// Get list of available intents and categories
router.get('/intents', authenticateToken, (req, res) => {
  try {
    const categories = chatbotService.getFAQCategories();

    res.status(200).json({
      success: true,
      intents: [
        'greetings - Say hello or hi',
        'help - Get help with using the platform',
        'groups - Information about support groups',
        'resources - Access helpful resources',
        'legal - Legal questions and assistance',
        'financial - Financial advice and resources',
        'emotional - Emotional support and counseling',
        'gratitude - Say thank you',
        'farewell - End the conversation'
      ],
      categories,
      example_queries: [
        'How do I file for divorce?',
        'What documents do I need for child support?',
        'Find me a lawyer in my area',
        'I need emotional support',
        'Help with financial planning after divorce'
      ]
    });
  } catch (error) {
    console.error('Error getting intents:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving intents',
      error: error.message
    });
  }
});

// Search FAQs
router.get('/faqs', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      const allFAQs = chatbotService.searchFAQs('');
      return res.status(200).json({
        success: true,
        count: allFAQs.length,
        results: allFAQs
      });
    }

    const results = chatbotService.searchFAQs(query);

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error searching FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching FAQs',
      error: error.message
    });
  }
});

// Get resources by category
router.get('/resources', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    const result = await chatbotService.getResourcesByCategory(category || 'all');

    res.status(200).json({
      success: true,
      category: result.category,
      count: result.resources.length,
      resources: result.resources
    });
  } catch (error) {
    console.error('Error getting resources:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving resources',
      error: error.message
    });
  }
});

// Submit feedback about chatbot responses
router.post('/feedback', [
  authenticateToken,
  body('sessionId').isString().notEmpty(),
  body('messageId').isString().optional(),
  body('helpful').isBoolean(),
  body('feedback').isString().optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { sessionId, messageId, helpful, feedback } = req.body;

    res.status(200).json({
      success: true,
      message: 'Thank you for your feedback!',
      data: {
        sessionId,
        messageId,
        helpful,
        feedback
      }
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    });
  }
});

module.exports = router;
