const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Journal = require('../models/Journal');
const { authenticateToken } = require('../middleware/auth');
const sentimentService = require('../services/sentimentService');
const sentimentAdapter = require('../services/sentiment/sentimentAdapter');

const router = express.Router();

/**
 * Middleware to handle express-validator validation results
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validation rules for journal creation
 */
const validateCreateJournal = [
  body('content')
    .exists({ checkFalsy: false })
    .withMessage('Journal content is required')
    .isString()
    .withMessage('Journal content must be a string')
    .trim()
    .notEmpty()
    .withMessage('Journal content cannot be empty')
    .isLength({ max: 10000 })
    .withMessage('Journal entry cannot exceed 10,000 characters'),
  body('title')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Title must be a string')
    .trim()
    .isLength({ max: 120 })
    .withMessage('Title cannot exceed 120 characters'),
  body('selfReportedMood')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Self-reported mood must be an integer between 1 and 5'),
  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Tags must be an array with at most 20 tags'),
  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string')
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag cannot exceed 30 characters'),
  handleValidationErrors
];

/**
 * Validation rules for journal updates
 */
const validateUpdateJournal = [
  param('id')
    .custom(val => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid journal entry ID format'),
  body('content')
    .optional()
    .isString()
    .withMessage('Journal content must be a string')
    .trim()
    .notEmpty()
    .withMessage('Journal content cannot be empty')
    .isLength({ max: 10000 })
    .withMessage('Journal entry cannot exceed 10,000 characters'),
  body('title')
    .optional()
    .isString()
    .withMessage('Title must be a string')
    .trim()
    .isLength({ max: 120 })
    .withMessage('Title cannot exceed 120 characters'),
  body('selfReportedMood')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Self-reported mood must be an integer between 1 and 5'),
  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Tags must be an array with at most 20 tags'),
  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string')
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag cannot exceed 30 characters'),
  body('isArchived')
    .optional()
    .isBoolean()
    .withMessage('isArchived must be a boolean'),
  handleValidationErrors
];

/**
 * Validation rules for journal entry ID parameter
 */
const validateJournalId = [
  param('id')
    .custom(val => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid journal entry ID format'),
  handleValidationErrors
];

/**
 * Validation rules for listing journal entries
 */
const validateListJournal = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters'),
  query('mood')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Mood filter must be an integer between 1 and 5'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO8601 date string'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO8601 date string'),
  query('isArchived')
    .optional()
    .isBoolean()
    .withMessage('isArchived must be a boolean'),
  handleValidationErrors
];

/**
 * Validation rules for analytics trends period query parameter
 */
const validateTrendsPeriod = [
  query('period')
    .optional()
    .isIn(['7d', '14d', '30d', '60d', '90d', '12w'])
    .withMessage('Period must be one of: 7d, 14d, 30d, 60d, 90d, 12w'),
  handleValidationErrors
];

/**
 * POST /api/journal
 * Create a new journal entry for authenticated user
 * Automatically evaluates sentiment via modular adapter and persists alongside the entry
 */
router.post('/', authenticateToken, validateCreateJournal, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const { title, content, selfReportedMood, tags } = req.body;

    const entryData = {
      userId: authenticatedUserId,
      content: content.trim(),
      title: title && title.trim() ? title.trim() : 'Daily Reflection',
      selfReportedMood: selfReportedMood !== undefined ? Number(selfReportedMood) : 3,
      tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : []
    };

    // Run modular sentiment evaluation
    const sentimentResult = await sentimentAdapter.analyze(content.trim());
    if (sentimentResult.success && sentimentResult.status === 'completed') {
      entryData.sentiment = {
        score: sentimentResult.score,
        label: sentimentResult.label,
        confidence: sentimentResult.confidence,
        uncertainty: sentimentResult.uncertainty,
        detectedEmotions: sentimentResult.detectedEmotions || [],
        model: sentimentResult.model,
        modelVersion: sentimentResult.modelVersion,
        status: 'completed',
        analyzedAt: sentimentResult.analyzedAt || new Date()
      };
    } else {
      entryData.sentiment = {
        score: null,
        label: null,
        confidence: null,
        uncertainty: null,
        detectedEmotions: [],
        model: sentimentResult.model || sentimentAdapter.modelName,
        modelVersion: sentimentResult.modelVersion || sentimentAdapter.modelVersion,
        status: 'failed',
        analyzedAt: new Date()
      };
    }

    const journal = new Journal(entryData);
    await journal.save();

    // Security & privacy: Never log journal text/content
    return res.status(201).json({
      success: true,
      message: 'Journal entry created successfully',
      data: journal,
      disclaimer: sentimentService.disclaimer
    });
  } catch (error) {
    // Avoid logging sensitive journal content
    console.error('Error creating journal entry:', error.name || 'Error');
    return next(error);
  }
});

/**
 * GET /api/journal
 * Retrieve paginated journal entries for the authenticated user
 * Strict user isolation: only retrieves entries where userId matches req.user
 */
router.get('/', authenticateToken, validateListJournal, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const filter = {
      userId: authenticatedUserId
    };

    if (req.query.isArchived !== undefined) {
      filter.isArchived = req.query.isArchived === true || req.query.isArchived === 'true';
    }

    if (req.query.mood) {
      filter.selfReportedMood = Number(req.query.mood);
    }

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    if (req.query.search) {
      // Escape regex special characters to prevent ReDoS
      const sanitizedSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: sanitizedSearch, $options: 'i' } },
        { tags: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    const [entries, total] = await Promise.all([
      Journal.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Journal.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: entries,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error listing journal entries:', error.name || 'Error');
    return next(error);
  }
});

/**
 * GET /api/journal/analytics/summary
 * Retrieve aggregate sentiment distribution, averages, and emotion frequency for current user
 * Placed before /:id route to prevent routing collision
 */
router.get('/analytics/summary', authenticateToken, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const result = await sentimentService.getSummary(authenticatedUserId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching sentiment summary:', error.name || 'Error');
    return next(error);
  }
});

/**
 * GET /api/journal/analytics/trends
 * Retrieve weekly trends and longitudinal daily trajectories for current user
 * Placed before /:id route to prevent routing collision
 */
router.get('/analytics/trends', authenticateToken, validateTrendsPeriod, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const period = req.query.period || '30d';
    const result = await sentimentService.getTrends(authenticatedUserId, { period });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching sentiment trends:', error.name || 'Error');
    return next(error);
  }
});

/**
 * GET /api/journal/:id
 * Retrieve a single journal entry by ID
 * Cross-user isolation: strictly verifies entry belongs to authenticated user
 */
router.get('/:id', authenticateToken, validateJournalId, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const { id } = req.params;

    const journal = await Journal.findOne({
      _id: id,
      userId: authenticatedUserId
    });

    if (!journal) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: journal,
      disclaimer: sentimentService.disclaimer
    });
  } catch (error) {
    console.error('Error fetching journal entry:', error.name || 'Error');
    return next(error);
  }
});

/**
 * POST /api/journal/:id/analyze
 * On-demand sentiment analysis / re-evaluation of an existing journal entry
 */
router.post('/:id/analyze', authenticateToken, validateJournalId, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const { id } = req.params;

    const result = await sentimentService.analyzeJournalEntry(id, authenticatedUserId);

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    if (!result.success) {
      return res.status(422).json({
        success: false,
        status: 'failed',
        message: result.message,
        data: result.data,
        disclaimer: result.disclaimer
      });
    }

    return res.status(200).json({
      success: true,
      status: 'completed',
      message: result.message,
      data: result.data,
      disclaimer: result.disclaimer
    });
  } catch (error) {
    console.error('Error analyzing journal entry:', error.name || 'Error');
    return next(error);
  }
});

/**
 * PUT /api/journal/:id
 * Update an existing journal entry
 * Refreshes sentiment analysis if content has been modified
 */
router.put('/:id', authenticateToken, validateUpdateJournal, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const { id } = req.params;

    const journal = await Journal.findOne({
      _id: id,
      userId: authenticatedUserId
    });

    if (!journal) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    if (req.body.title !== undefined) {
      journal.title = req.body.title.trim() || 'Daily Reflection';
    }

    // If content updated, re-evaluate sentiment
    if (req.body.content !== undefined) {
      const newContent = req.body.content.trim();
      if (newContent !== journal.content) {
        journal.content = newContent;
        const analysis = await sentimentAdapter.analyze(newContent);
        if (analysis.success) {
          journal.sentiment = {
            score: analysis.score,
            label: analysis.label,
            confidence: analysis.confidence,
            uncertainty: analysis.uncertainty,
            detectedEmotions: analysis.detectedEmotions || [],
            model: analysis.model,
            modelVersion: analysis.modelVersion,
            status: 'completed',
            analyzedAt: new Date()
          };
        }
      }
    }

    if (req.body.selfReportedMood !== undefined) {
      journal.selfReportedMood = Number(req.body.selfReportedMood);
    }
    if (Array.isArray(req.body.tags)) {
      journal.tags = req.body.tags.map(t => String(t).trim()).filter(Boolean);
    }
    if (req.body.isArchived !== undefined) {
      journal.isArchived = Boolean(req.body.isArchived);
    }

    await journal.save();

    return res.status(200).json({
      success: true,
      message: 'Journal entry updated successfully',
      data: journal,
      disclaimer: sentimentService.disclaimer
    });
  } catch (error) {
    console.error('Error updating journal entry:', error.name || 'Error');
    return next(error);
  }
});

/**
 * DELETE /api/journal/:id
 * Delete a journal entry
 * Cross-user isolation: strictly verifies entry belongs to authenticated user
 */
router.delete('/:id', authenticateToken, validateJournalId, async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id || req.user.userId;
    const { id } = req.params;

    const journal = await Journal.findOneAndDelete({
      _id: id,
      userId: authenticatedUserId
    });

    if (!journal) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Journal entry deleted successfully',
      data: { id: journal._id }
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error.name || 'Error');
    return next(error);
  }
});

module.exports = router;
