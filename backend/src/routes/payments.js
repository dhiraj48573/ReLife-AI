const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const paymentService = require('../services/paymentService');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Create Razorpay order for premium upgrade
router.post('/create-order', authenticateToken, [
  body('amount').optional().isNumeric().withMessage('Amount must be numeric'),
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

    const { amount = 99900 } = req.body; // Default ₹999 in paise

    const result = await paymentService.createPremiumOrder(req.user.userId, amount);

    res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order'
    });
  }
});

// Verify Razorpay payment
router.post('/verify-payment', authenticateToken, [
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('razorpayOrderId').notEmpty().withMessage('Razorpay Order ID is required'),
  body('razorpayPaymentId').notEmpty().withMessage('Razorpay Payment ID is required'),
  body('signature').notEmpty().withMessage('Signature is required'),
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

    const { paymentId, razorpayOrderId, razorpayPaymentId, signature } = req.body;

    const result = await paymentService.verifyPayment(
      paymentId,
      razorpayOrderId,
      razorpayPaymentId,
      signature
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed'
    });
  }
});

// Generate UPI QR code
router.post('/generate-upi-qr', authenticateToken, [
  body('amount').optional().isNumeric().withMessage('Amount must be numeric'),
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

    const { amount = 999 } = req.body; // Default ₹999

    const result = await paymentService.generateUPIQRCode(req.user.userId, amount);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error generating UPI QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate UPI QR code'
    });
  }
});

// Verify UPI payment (admin only)
router.post('/verify-upi-payment', authenticateToken, [
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('transactionReference').notEmpty().withMessage('Transaction reference is required'),
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

    // Check if user is admin
    const User = require('../models/User');
    const adminUser = await User.findById(req.user.userId);
    if (adminUser.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { paymentId, transactionReference } = req.body;

    const result = await paymentService.verifyUPIPayment(
      paymentId,
      transactionReference,
      req.user.userId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error verifying UPI payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'UPI payment verification failed'
    });
  }
});

// Get payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const result = await paymentService.getPaymentHistory(
      req.user.userId,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment history'
    });
  }
});

// Get payment details
router.get('/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const result = await paymentService.getPaymentDetails(paymentId, req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Payment details retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error getting payment details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment details'
    });
  }
});

// Check premium access
router.get('/check-premium', authenticateToken, async (req, res) => {
  try {
    const result = await paymentService.checkPremiumAccess(req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Premium access checked successfully',
      data: result
    });
  } catch (error) {
    console.error('Error checking premium access:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check premium access'
    });
  }
});

// Get Razorpay key (for frontend)
router.get('/razorpay-key', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Error getting Razorpay key:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Razorpay key'
    });
  }
});

// Admin route: Get all payments
router.get('/admin/all-payments', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const User = require('../models/User');
    const adminUser = await User.findById(req.user.userId);
    if (adminUser.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { page = 1, limit = 20, status, paymentMethod } = req.query;
    const Payment = require('../models/Payment');

    let filter = {};
    if (status) filter.paymentStatus = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const payments = await Payment.find(filter)
      .populate('userId', 'mobileNumber groupClass')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: 'All payments retrieved successfully',
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error getting all payments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payments'
    });
  }
});

module.exports = router;
