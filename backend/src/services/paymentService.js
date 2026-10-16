const Razorpay = require('razorpay');
const crypto = require('crypto');
const QRCode = require('qrcode');
const Payment = require('../models/Payment');
const User = require('../models/User');

class PaymentService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  // Create Razorpay order for premium upgrade
  async createPremiumOrder(userId, amount = 99900) { // ₹999 in paise
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user already has premium access
      if (user.groupClass === 'Premium') {
        throw new Error('User already has premium access');
      }

      const options = {
        amount: amount,
        currency: 'INR',
        receipt: `premium_${userId}_${Date.now()}`,
        notes: {
          userId: userId.toString(),
          paymentType: 'premium_upgrade'
        }
      };

      const order = await this.razorpay.orders.create(options);

      // Create payment record
      const payment = new Payment({
        userId,
        paymentType: 'premium_upgrade',
        amount: amount / 100, // Convert back to rupees
        paymentMethod: 'razorpay',
        razorpayOrderId: order.id,
        transactionId: order.receipt,
        paymentDetails: {
          order: order
        }
      });

      await payment.save();

      return {
        success: true,
        order,
        paymentId: payment._id
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw error;
    }
  }

  // Verify Razorpay payment
  async verifyPayment(paymentId, razorpayOrderId, razorpayPaymentId, signature) {
    try {
      const payment = await Payment.findById(paymentId).populate('userId');
      if (!payment) {
        throw new Error('Payment record not found');
      }

      // Verify signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        throw new Error('Invalid payment signature');
      }

      // Update payment record
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = signature;
      await payment.markCompleted({
        razorpayOrderId,
        razorpayPaymentId,
        signature
      });

      // Upgrade user to premium
      await User.findByIdAndUpdate(payment.userId._id, {
        groupClass: 'Premium',
        currentFeatureAccess: 'premium'
      });

      return {
        success: true,
        payment,
        message: 'Payment verified and premium access granted'
      };
    } catch (error) {
      console.error('Error verifying payment:', error);
      
      // Mark payment as failed
      if (paymentId) {
        const payment = await Payment.findById(paymentId);
        if (payment) {
          await payment.markFailed(error.message);
        }
      }
      
      throw error;
    }
  }

  // Generate UPI QR code
  async generateUPIQRCode(userId, amount = 999) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // UPI QR code data format
      const upiId = process.env.UPI_ID || 'relife@paytm';
      const merchantName = 'ReLife Support Platform';
      const transactionNote = `Premium Upgrade - ${user.mobileNumber}`;
      
      // UPI URI format
      const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(upiUri);

      // Create payment record
      const payment = new Payment({
        userId,
        paymentType: 'premium_upgrade',
        amount,
        paymentMethod: 'qr_code',
        upiId,
        qrCodeData: upiUri,
        transactionId: `upi_${userId}_${Date.now()}`,
        paymentDetails: {
          upiUri,
          qrCodeDataUrl
        }
      });

      await payment.save();

      return {
        success: true,
        paymentId: payment._id,
        qrCodeDataUrl,
        upiUri,
        upiId,
        amount,
        message: 'UPI QR code generated successfully'
      };
    } catch (error) {
      console.error('Error generating UPI QR code:', error);
      throw error;
    }
  }

  // Verify UPI payment (manual verification by admin)
  async verifyUPIPayment(paymentId, transactionReference, adminId) {
    try {
      const payment = await Payment.findById(paymentId).populate('userId');
      if (!payment) {
        throw new Error('Payment record not found');
      }

      if (payment.paymentStatus === 'completed') {
        throw new Error('Payment already completed');
      }

      // Update payment record
      payment.upiTransactionId = transactionReference;
      await payment.markCompleted({
        transactionReference,
        verifiedBy: adminId,
        verifiedAt: new Date()
      });

      // Upgrade user to premium
      await User.findByIdAndUpdate(payment.userId._id, {
        groupClass: 'Premium',
        currentFeatureAccess: 'premium'
      });

      return {
        success: true,
        payment,
        message: 'UPI payment verified and premium access granted'
      };
    } catch (error) {
      console.error('Error verifying UPI payment:', error);
      throw error;
    }
  }

  // Get payment history for a user
  async getPaymentHistory(userId, page = 1, limit = 10) {
    try {
      const payments = await Payment.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Payment.countDocuments({ userId });

      return {
        success: true,
        payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }

  // Get payment details
  async getPaymentDetails(paymentId, userId = null) {
    try {
      const query = { _id: paymentId };
      if (userId) {
        query.userId = userId;
      }

      const payment = await Payment.findOne(query).populate('userId', 'mobileNumber groupClass');

      if (!payment) {
        throw new Error('Payment not found');
      }

      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('Error getting payment details:', error);
      throw error;
    }
  }

  // Check if user has premium access
  async checkPremiumAccess(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        isPremium: user.groupClass === 'Premium',
        currentAccess: user.currentFeatureAccess,
        groupClass: user.groupClass
      };
    } catch (error) {
      console.error('Error checking premium access:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
