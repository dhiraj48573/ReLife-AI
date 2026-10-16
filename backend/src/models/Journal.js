const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: [120, 'Title cannot exceed 120 characters'],
    default: 'Daily Reflection'
  },
  content: {
    type: String,
    required: [true, 'Journal content cannot be empty'],
    trim: true,
    maxlength: [10000, 'Journal entry cannot exceed 10,000 characters']
  },
  selfReportedMood: {
    type: Number, // 1 (Very Low) to 5 (Very High)
    min: [1, 'Mood must be at least 1'],
    max: [5, 'Mood cannot exceed 5'],
    default: 3
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  sentiment: {
    score: { type: Number, default: null }, // Continuous score from -1.0 to 1.0
    label: {
      type: String,
      enum: ['positive', 'neutral', 'negative', null],
      default: null
    },
    confidence: { type: Number, default: null },
    uncertainty: { type: Number, default: null },
    detectedEmotions: [{ type: String }],
    model: { type: String, default: null },
    modelVersion: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', null],
      default: null
    },
    analyzedAt: { type: Date, default: null }
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for fast timeline and filtered queries per user
journalSchema.index({ userId: 1, createdAt: -1 });
journalSchema.index({ userId: 1, 'sentiment.label': 1 });

module.exports = mongoose.models.Journal || mongoose.model('Journal', journalSchema);
