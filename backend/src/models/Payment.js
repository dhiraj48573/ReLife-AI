const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentType: {
    type: String,
    enum: ['premium_upgrade', 'premium_renewal', 'session_fee'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'upi', 'qr_code'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  razorpayOrderId: {
    type: String,
    sparse: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true
  },
  razorpaySignature: {
    type: String,
    sparse: true
  },
  upiTransactionId: {
    type: String,
    sparse: true
  },
  upiId: {
    type: String,
    sparse: true
  },
  qrCodeData: {
    type: String,
    sparse: true
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  },
  failureReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ userId: 1, paymentStatus: 1 });
paymentSchema.index({ createdAt: -1 });

// Method to check if payment is expired
paymentSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Method to mark payment as completed
paymentSchema.methods.markCompleted = function(paymentDetails = {}) {
  this.paymentStatus = 'completed';
  this.completedAt = new Date();
  this.paymentDetails = { ...this.paymentDetails, ...paymentDetails };
  return this.save();
};

// Method to mark payment as failed
paymentSchema.methods.markFailed = function(reason) {
  this.paymentStatus = 'failed';
  this.failureReason = reason;
  return this.save();
};

module.exports = mongoose.model('Payment', paymentSchema);
