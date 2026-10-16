const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'bot'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  citations: [{
    title: { type: String, required: true },
    publisher: { type: String, required: true },
    url: { type: String, required: true },
    reviewDate: { type: String }
  }],
  escalated: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  messages: [chatMessageSchema],
  context: {
    lastIntent: String,
    lastTopic: String,
    userPreferences: {
      language: {
        type: String,
        default: 'en'
      },
      notify: {
        type: Boolean,
        default: true
      }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Auto-delete chat history after 30 days
  }
});

// Compound indexes for user isolation and fast query performance
chatHistorySchema.index({ userId: 1, sessionId: 1 });
chatHistorySchema.index({ userId: 1, createdAt: -1 });

// Add text index for search functionality
chatHistorySchema.index({
  'messages.message': 'text',
  'context.lastIntent': 'text'
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory;

