const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Group = require('../models/Group');

const router = express.Router();

// Middleware to verify JWT token and check admin access
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    req.user = decoded;
    req.userDoc = user;
    next();

  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Get admin dashboard statistics
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });

    const totalGroups = await Group.countDocuments();
    const activeGroups = await Group.countDocuments({ isActive: true, isCompleted: false });
    const completedGroups = await Group.countDocuments({ isCompleted: true });

    const usersByType = await User.aggregate([
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]);

    const groupsByTopic = await Group.aggregate([
      { $group: { _id: '$topic', count: { $sum: 1 } } }
    ]);

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    const recentGroups = await Group.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          verified: verifiedUsers,
          recent: recentUsers,
          byType: usersByType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        },
        groups: {
          total: totalGroups,
          active: activeGroups,
          completed: completedGroups,
          recent: recentGroups,
          byTopic: groupsByTopic.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create moderator account
router.post('/create-moderator', authenticateAdmin, [
  body('mobileNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian mobile number')
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

    const { mobileNumber } = req.body;

    // Check if user already exists
    let user = await User.findOne({ mobileNumber });

    if (user) {
      if (user.userType === 'moderator') {
        return res.status(400).json({
          success: false,
          message: 'User is already a moderator'
        });
      }
      // Update existing user to moderator
      user.userType = 'moderator';
      await user.save();
    } else {
      // Create new moderator user (they'll need to verify OTP)
      user = new User({
        mobileNumber,
        userType: 'moderator',
        otp: '000000', // Will be updated when they verify
        otpExpires: new Date(),
        isVerified: false
      });
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Moderator account created/updated successfully',
      user: {
        id: user._id,
        mobileNumber: user.mobileNumber,
        userType: user.userType,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('Create moderator error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all moderators
router.get('/moderators', authenticateAdmin, async (req, res) => {
  try {
    const moderators = await User.find({
      userType: 'moderator',
      isActive: true
    }).select('-otp -otpExpires');

    res.status(200).json({
      success: true,
      count: moderators.length,
      moderators: moderators.map(mod => ({
        id: mod._id,
        mobileNumber: mod.mobileNumber,
        language: mod.language,
        selectedTopics: mod.selectedTopics,
        isVerified: mod.isVerified,
        lastLogin: mod.lastLogin,
        createdAt: mod.createdAt
      }))
    });

  } catch (error) {
    console.error('Get moderators error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// System maintenance - Clear completed old groups
router.post('/maintenance/cleanup', authenticateAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const deletedGroups = await Group.deleteMany({
      isCompleted: true,
      updatedAt: { $lt: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      message: `${deletedGroups.deletedCount} old completed groups removed`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update system settings (placeholder for future features)
router.put('/settings', authenticateAdmin, async (req, res) => {
  try {
    // Placeholder for system settings updates
    // Could include: max group size, OTP expiry time, etc.

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
