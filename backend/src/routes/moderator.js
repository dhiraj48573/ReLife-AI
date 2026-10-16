const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');

const router = express.Router();

// Middleware to verify JWT token and check moderator/admin access
const authenticateModerator = async (req, res, next) => {
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

    if (!user || (user.userType !== 'moderator' && user.userType !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Moderator or admin access required'
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

// Get moderator's groups
router.get('/my-groups', authenticateModerator, async (req, res) => {
  try {
    const moderatorId = req.user.userId;

    const groups = await Group.find({ moderator: moderatorId })
      .populate('participants', 'mobileNumber')
      .sort({ scheduledDate: 1 });

    res.status(200).json({
      success: true,
      count: groups.length,
      groups: groups.map(group => ({
        id: group._id,
        name: group.name,
        description: group.description,
        topic: group.topic,
        language: group.language,
        groupClass: group.groupClass,
        participants: group.participants.map(p => p.mobileNumber),
        participantCount: group.participants.length,
        maxParticipants: group.maxParticipants,
        scheduledDate: group.scheduledDate,
        duration: group.duration,
        meetingLink: group.meetingLink,
        isActive: group.isActive,
        isCompleted: group.isCompleted,
        createdAt: group.createdAt
      }))
    });

  } catch (error) {
    console.error('Get moderator groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update group status
router.put('/groups/:groupId/status', authenticateModerator, [
  body('isActive').isBoolean(),
  body('isCompleted').optional().isBoolean()
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

    const { groupId } = req.params;
    const { isActive, isCompleted } = req.body;
    const moderatorId = req.user.userId;

    const group = await Group.findOne({ _id: groupId, moderator: moderatorId });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not the moderator'
      });
    }

    if (isActive !== undefined) group.isActive = isActive;
    if (isCompleted !== undefined) group.isCompleted = isCompleted;

    await group.save();

    res.status(200).json({
      success: true,
      message: 'Group status updated successfully',
      group: {
        id: group._id,
        name: group.name,
        isActive: group.isActive,
        isCompleted: group.isCompleted
      }
    });

  } catch (error) {
    console.error('Update group status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get group participants
router.get('/groups/:groupId/participants', authenticateModerator, async (req, res) => {
  try {
    const { groupId } = req.params;
    const moderatorId = req.user.userId;

    const group = await Group.findOne({ _id: groupId, moderator: moderatorId })
      .populate('participants', 'mobileNumber language selectedTopics groupClass lastLogin');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not the moderator'
      });
    }

    res.status(200).json({
      success: true,
      group: {
        id: group._id,
        name: group.name,
        topic: group.topic
      },
      participants: group.participants.map(participant => ({
        id: participant._id,
        mobileNumber: participant.mobileNumber,
        language: participant.language,
        selectedTopics: participant.selectedTopics,
        groupClass: participant.groupClass,
        lastLogin: participant.lastLogin
      }))
    });

  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send reminder to group participants
router.post('/groups/:groupId/remind', authenticateModerator, async (req, res) => {
  try {
    const { groupId } = req.params;
    const moderatorId = req.user.userId;

    const group = await Group.findOne({ _id: groupId, moderator: moderatorId })
      .populate('participants', 'mobileNumber');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not the moderator'
      });
    }

    // In a real implementation, you would send SMS reminders here
    // For now, we'll just log it
    console.log(`Reminder sent for group ${group.name} to ${group.participants.length} participants`);

    // Update last reminder sent time (you might want to add this field to the model)
    // group.lastReminderSent = new Date();
    // await group.save();

    res.status(200).json({
      success: true,
      message: `Reminder sent to ${group.participants.length} participants`,
      group: {
        id: group._id,
        name: group.name,
        scheduledDate: group.scheduledDate
      }
    });

  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get moderator statistics
router.get('/stats/dashboard', authenticateModerator, async (req, res) => {
  try {
    const moderatorId = req.user.userId;

    const totalGroups = await Group.countDocuments({ moderator: moderatorId });
    const activeGroups = await Group.countDocuments({
      moderator: moderatorId,
      isActive: true,
      isCompleted: false
    });
    const completedGroups = await Group.countDocuments({
      moderator: moderatorId,
      isCompleted: true
    });

    const groupsByTopic = await Group.aggregate([
      { $match: { moderator: mongoose.Types.ObjectId(moderatorId) } },
      { $group: { _id: '$topic', count: { $sum: 1 } } }
    ]);

    const totalParticipants = await Group.aggregate([
      { $match: { moderator: mongoose.Types.ObjectId(moderatorId) } },
      { $group: { _id: null, total: { $sum: { $size: '$participants' } } } }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalGroups,
        activeGroups,
        completedGroups,
        totalParticipants: totalParticipants[0]?.total || 0,
        groupsByTopic: groupsByTopic.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Get moderator stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
