const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true,
    enum: [
      'Women Support', 'Mens Support', 'Emotional & Mental Support',
      'Child Issues & Custody', 'NRI Section', 'Alimony', 'Maintenance',
      'Property', 'Cash', 'Gold', 'Domestic Violence', 'Child Abuse',
      'Extra Marital Issues'
    ]
  },
  language: {
    type: String,
    required: true,
    enum: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam']
  },
  groupClass: {
    type: String,
    enum: ['Basic', 'Premium'],
    default: 'Basic'
  },
  moderator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  maxParticipants: {
    type: Number,
    default: 50,
    max: 100
  },
  meetingLink: {
    type: String,
    required: true // Google Meet or Zoom link
  },
  meetingPassword: {
    type: String,
    default: null
  },
  meetingType: {
    type: String,
    enum: ['google_meet', 'zoom'],
    default: 'google_meet'
  },
  zoomMeetingId: {
    type: String,
    default: null
  },
  zoomJoinUrl: {
    type: String,
    default: null
  },
  zoomPassword: {
    type: String,
    default: null
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
groupSchema.index({ topic: 1, language: 1, groupClass: 1 });
groupSchema.index({ scheduledDate: 1, isActive: 1 });

module.exports = mongoose.model('Group', groupSchema);
