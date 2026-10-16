const { google } = require('googleapis');
const { requireGoogleAuth } = require('../middleware/googleAuth');
const Group = require('../models/Group');
const User = require('../models/User');
const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

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

// Get all available groups
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const { topic, language, groupClass } = req.query;

    let filter = { isActive: true, isCompleted: false };

    if (topic) filter.topic = topic;
    if (language) filter.language = language;
    if (groupClass) filter.groupClass = groupClass;

    const groups = await Group.find(filter)
      .populate('moderator', 'mobileNumber')
      .sort({ scheduledDate: 1 })
      .limit(50);

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
        moderatorNumber: group.moderator.mobileNumber,
        participantCount: group.participants.length,
        maxParticipants: group.maxParticipants,
        scheduledDate: group.scheduledDate,
        duration: group.duration,
        meetingLink: group.meetingLink,
        meetingType: group.meetingType,
        zoomMeetingId: group.zoomMeetingId,
        zoomJoinUrl: group.zoomJoinUrl
      }))
    });

  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get groups by topic
router.get('/topics/:topic', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.params;
    const { language, groupClass } = req.query;

    let filter = {
      topic,
      isActive: true,
      isCompleted: false
    };

    if (language) filter.language = language;
    if (groupClass) filter.groupClass = groupClass;

    const groups = await Group.find(filter)
      .populate('moderator', 'mobileNumber')
      .sort({ scheduledDate: 1 });

    res.status(200).json({
      success: true,
      count: groups.length,
      groups: groups.map(group => ({
        id: group._id,
        name: group.name,
        description: group.description,
        language: group.language,
        groupClass: group.groupClass,
        moderatorNumber: group.moderator.mobileNumber,
        participantCount: group.participants.length,
        maxParticipants: group.maxParticipants,
        scheduledDate: group.scheduledDate,
        duration: group.duration,
        meetingLink: group.meetingLink,
        meetingType: group.meetingType,
        zoomMeetingId: group.zoomMeetingId,
        zoomJoinUrl: group.zoomJoinUrl
      }))
    });

  } catch (error) {
    console.error('Get groups by topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Join a group
router.post('/:groupId/join', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isActive || group.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Group is not available for joining'
      });
    }

    if (group.participants.length >= group.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Group is full'
      });
    }

    if (group.participants.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group'
      });
    }

    // Check if user has been assigned to this group through feature access request
    const user = await User.findById(userId);
    const assignedRequest = user.featureAccessRequests.find(
      request => request.assignedGroup && request.assignedGroup.toString() === groupId && request.status === 'pending'
    );

    if (!assignedRequest) {
      return res.status(403).json({
        success: false,
        message: 'You must request feature access first to join this group. Please use the /api/groups/request-feature-access endpoint.',
        code: 'FEATURE_ACCESS_REQUIRED'
      });
    }

    // User has been assigned to this group, allow joining
    group.participants.push(userId);
    await group.save();

    // Update user's selected topics if not already included
    if (!user.selectedTopics.includes(group.topic)) {
      user.selectedTopics.push(group.topic);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Successfully joined the group',
      group: {
        id: group._id,
        name: group.name,
        topic: group.topic,
        meetingLink: group.meetingLink,
        meetingType: group.meetingType,
        zoomMeetingId: group.zoomMeetingId,
        zoomJoinUrl: group.zoomJoinUrl,
        scheduledDate: group.scheduledDate
      }
    });

  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Leave a group
router.post('/:groupId/leave', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.participants.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Remove user from group
    group.participants = group.participants.filter(
      participant => participant.toString() !== userId
    );
    await group.save();

    res.status(200).json({
      success: true,
      message: 'Successfully left the group'
    });

  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's groups
router.get('/my-groups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const groups = await Group.find({
      participants: userId,
      isActive: true
    })
    .populate('moderator', 'mobileNumber')
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
        moderatorNumber: group.moderator.mobileNumber,
        scheduledDate: group.scheduledDate,
        duration: group.duration,
        meetingLink: group.meetingLink,
        meetingType: group.meetingType,
        zoomMeetingId: group.zoomMeetingId,
        zoomJoinUrl: group.zoomJoinUrl,
        isCompleted: group.isCompleted
      }))
    });

  } catch (error) {
    console.error('Get my groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create a new group (for moderators/admins)
router.post('/create', authenticateToken, [
  body('name').trim().isLength({ min: 3, max: 100 }),
  body('description').trim().isLength({ min: 10, max: 500 }),
  body('topic').isIn([
    'Women Support', 'Mens Support', 'Emotional & Mental Support',
    'Child Issues & Custody', 'NRI Section', 'Alimony', 'Maintenance',
    'Property', 'Cash', 'Gold', 'Domestic Violence', 'Child Abuse',
    'Extra Marital Issues'
  ]),
  body('language').isIn(['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam']),
  body('groupClass').isIn(['Basic', 'Premium']),
  body('meetingLink').isURL(),
  body('scheduledDate').isISO8601(),
  body('duration').isInt({ min: 30, max: 180 })
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

    const userId = req.user.userId;
    const user = await User.findById(userId);

    // Check if user is moderator or admin
    if (user.userType !== 'moderator' && user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only moderators and admins can create groups'
      });
    }

    const {
      name,
      description,
      topic,
      language,
      groupClass,
      meetingLink,
      scheduledDate,
      duration,
      maxParticipants
    } = req.body;

    const group = new Group({
      name,
      description,
      topic,
      language,
      groupClass,
      moderator: userId,
      meetingLink,
      scheduledDate,
      duration,
      maxParticipants: maxParticipants || 50,
      createdBy: userId
    });

    await group.save();

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: {
        id: group._id,
        name: group.name,
        topic: group.topic,
        language: group.language,
        scheduledDate: group.scheduledDate,
        meetingLink: group.meetingLink
      }
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create a new group with Google Calendar integration (for moderators/admins)
router.post('/create-with-calendar', authenticateToken, requireGoogleAuth, [
  body('name').trim().isLength({ min: 3, max: 100 }),
  body('description').trim().isLength({ min: 10, max: 500 }),
  body('topic').isIn([
    'Women Support', 'Mens Support', 'Emotional & Mental Support',
    'Child Issues & Custody', 'NRI Section', 'Alimony', 'Maintenance',
    'Property', 'Cash', 'Gold', 'Domestic Violence', 'Child Abuse',
    'Extra Marital Issues'
  ]),
  body('language').isIn(['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam']),
  body('groupClass').isIn(['Basic', 'Premium']),
  body('scheduledDate').isISO8601(),
  body('duration').isInt({ min: 30, max: 180 })
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

    const userId = req.user.userId;
    const user = await User.findById(userId);

    // Check if user is moderator or admin
    if (user.userType !== 'moderator' && user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only moderators and admins can create groups'
      });
    }

    const {
      name,
      description,
      topic,
      language,
      groupClass,
      scheduledDate,
      duration,
      maxParticipants
    } = req.body;

    // Create Google Calendar event with Meet link
    const startTime = new Date(scheduledDate);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const calendar = google.calendar({ version: 'v3', auth: req.googleAuth });

    const event = {
      summary: `${name} - ${topic}`,
      description: `${description}\n\nTopic: ${topic}\nLanguage: ${language}\nClass: ${groupClass}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      conferenceData: {
        createRequest: {
          requestId: `group-meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    const eventResponse = await calendar.events.insert({
      calendarId: user.googleCalendarId || 'primary',
      resource: event,
      conferenceDataVersion: 1
    });

    const meetLink = eventResponse.data.conferenceData?.entryPoints?.[0]?.uri;

    if (!meetLink) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate Google Meet link'
      });
    }

    // Create group in database
    const group = new Group({
      name,
      description,
      topic,
      language,
      groupClass,
      moderator: userId,
      meetingLink: meetLink,
      scheduledDate,
      duration,
      maxParticipants: maxParticipants || 50,
      createdBy: userId
    });

    await group.save();

    res.status(201).json({
      success: true,
      message: 'Group created successfully with Google Calendar integration',
      group: {
        id: group._id,
        name: group.name,
        topic: group.topic,
        language: group.language,
        scheduledDate: group.scheduledDate,
        meetingLink: group.meetingLink,
        calendarEventId: eventResponse.data.id,
        calendarLink: eventResponse.data.htmlLink
      }
    });

  } catch (error) {
    console.error('Create group with calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's feature access requests and current status
router.get('/my-feature-access', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId)
      .populate('featureAccessRequests.assignedGroup', 'name topic language scheduledDate meetingLink')
      .populate('featureAccessRequests.approvedBy', 'mobileNumber');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      currentAccess: user.currentFeatureAccess,
      requests: user.featureAccessRequests.map(request => ({
        id: request._id,
        featureType: request.featureType,
        status: request.status,
        requestedAt: request.requestedAt,
        moderatorNote: request.moderatorNote,
        approvedAt: request.approvedAt,
        approvedBy: request.approvedBy?.mobileNumber,
        assignedGroup: request.assignedGroup ? {
          id: request.assignedGroup._id,
          name: request.assignedGroup.name,
          topic: request.assignedGroup.topic,
          language: request.assignedGroup.language,
          scheduledDate: request.assignedGroup.scheduledDate,
          meetingLink: request.assignedGroup.meetingLink
        } : null
      }))
    });

  } catch (error) {
    console.error('Get feature access error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Request feature access (assign user to a group)
router.post('/request-feature-access', authenticateToken, [
  body('featureType').isIn(['basic', 'premium'])
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

    const userId = req.user.userId;
    const { featureType } = req.body;

    // Get user details
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has active feature access
    if (user.currentFeatureAccess === featureType) {
      return res.status(400).json({
        success: false,
        message: `You already have ${featureType} access`
      });
    }

    // Check if user has a pending request for this feature type
    const existingRequest = user.featureAccessRequests.find(
      request => request.featureType === featureType && request.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: `You already have a pending ${featureType} access request`
      });
    }

    // Find an available group based on user's preferences and feature type
    const groupFilter = {
      groupClass: featureType,
      isActive: true,
      isCompleted: false,
      participants: { $ne: userId }, // Not already a participant
      $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] } // Has available slots
    };

    // If user has selected topics, prioritize groups with matching topics
    if (user.selectedTopics && user.selectedTopics.length > 0) {
      groupFilter.topic = { $in: user.selectedTopics };
    }

    // Prioritize groups in user's preferred language
    groupFilter.language = user.language;

    let assignedGroup = await Group.findOne(groupFilter)
      .populate('moderator', 'mobileNumber')
      .sort({ scheduledDate: 1 });

    // If no group found in user's language, try any language
    if (!assignedGroup) {
      delete groupFilter.language;
      assignedGroup = await Group.findOne(groupFilter)
        .populate('moderator', 'mobileNumber')
        .sort({ scheduledDate: 1 });
    }

    if (!assignedGroup) {
      return res.status(404).json({
        success: false,
        message: `No available ${featureType} groups found. Please contact a moderator for assistance.`
      });
    }

    // Create feature access request
    const featureRequest = {
      featureType,
      status: 'pending',
      assignedGroup: assignedGroup._id,
      requestedAt: new Date()
    };

    user.featureAccessRequests.push(featureRequest);
    await user.save();

    // Add user to the group as a pending participant
    assignedGroup.participants.push(userId);
    await assignedGroup.save();

    res.status(200).json({
      success: true,
      message: `Your ${featureType} access request has been submitted. Please join the assigned group meeting.`,
      request: {
        id: featureRequest._id,
        featureType,
        status: 'pending',
        assignedGroup: {
          id: assignedGroup._id,
          name: assignedGroup.name,
          topic: assignedGroup.topic,
          language: assignedGroup.language,
          moderatorNumber: assignedGroup.moderator.mobileNumber,
          scheduledDate: assignedGroup.scheduledDate,
          duration: assignedGroup.duration,
          meetingLink: assignedGroup.meetingLink
        }
      }
    });

  } catch (error) {
    console.error('Request feature access error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all pending feature access requests (moderators/admins only)
router.get('/pending-feature-requests', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (user.userType !== 'moderator' && user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Moderator or admin access required'
      });
    }

    const pendingRequests = await User.aggregate([
      {
        $unwind: '$featureAccessRequests'
      },
      {
        $match: {
          'featureAccessRequests.status': 'pending'
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'featureAccessRequests.assignedGroup',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      {
        $project: {
          _id: 1,
          mobileNumber: 1,
          userType: 1,
          language: 1,
          selectedTopics: 1,
          'featureAccessRequests': 1,
          'groupInfo': { $arrayElemAt: ['$groupInfo', 0] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: pendingRequests.length,
      requests: pendingRequests.map(request => ({
        user: {
          id: request._id,
          mobileNumber: request.mobileNumber,
          userType: request.userType,
          language: request.language,
          selectedTopics: request.selectedTopics
        },
        request: {
          id: request.featureAccessRequests._id,
          featureType: request.featureAccessRequests.featureType,
          requestedAt: request.featureAccessRequests.requestedAt,
          assignedGroup: request.groupInfo ? {
            id: request.groupInfo._id,
            name: request.groupInfo.name,
            topic: request.groupInfo.topic,
            language: request.groupInfo.language,
            scheduledDate: request.groupInfo.scheduledDate
          } : null
        }
      }))
    });

  } catch (error) {
    console.error('Get pending feature requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create Zoom meeting for group joining
router.post('/:groupId/create-zoom-meeting', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is a participant in the group
    if (!group.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member of this group to create a Zoom meeting'
      });
    }

    // Check if group already has a Zoom meeting
    if (group.meetingType === 'zoom' && group.zoomMeetingId) {
      return res.status(400).json({
        success: false,
        message: 'This group already has a Zoom meeting scheduled'
      });
    }

    // In a real implementation, you would integrate with Zoom API here
    // For now, we'll simulate creating a Zoom meeting
    const zoomMeetingId = `zoom_${Date.now()}`;
    const zoomJoinUrl = `https://zoom.us/j/${zoomMeetingId}`;
    const zoomPassword = Math.random().toString(36).slice(-8);

    // Update group with Zoom meeting details
    group.meetingType = 'zoom';
    group.zoomMeetingId = zoomMeetingId;
    group.zoomJoinUrl = zoomJoinUrl;
    group.zoomPassword = zoomPassword;
    // Keep the original meeting link as well for reference
    group.meetingLink = zoomJoinUrl;

    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Zoom meeting created successfully',
      meeting: {
        meetingId: zoomMeetingId,
        joinUrl: zoomJoinUrl,
        password: zoomPassword,
        topic: group.topic,
        scheduledDate: group.scheduledDate,
        duration: group.duration
      }
    });
  } catch (error) {
    console.error('Error in create-zoom-meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Approve or reject feature access request (moderators/admins only)
router.put('/feature-request/:requestId', authenticateToken, [
  body('action').isIn(['approve', 'reject']),
  body('moderatorNote').optional().isLength({ max: 500 })
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

    const { requestId } = req.params;
    const { action, moderatorNote } = req.body;
    const moderatorId = req.user.userId;

    // Check if user is moderator or admin
    const moderator = await User.findById(moderatorId);
    if (moderator.userType !== 'moderator' && moderator.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Moderator or admin access required'
      });
    }

    // Find the user with this feature request
    const user = await User.findOne({
      'featureAccessRequests._id': requestId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Feature request not found'
      });
    }

    // Find the specific request
    const request = user.featureAccessRequests.id(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request not found or already processed'
      });
    }

    // Update request status
    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.moderatorNote = moderatorNote;
    request.approvedBy = moderatorId;
    request.approvedAt = new Date();

    if (action === 'approve') {
      // Update user's current feature access
      user.currentFeatureAccess = request.featureType;

      // If user was assigned to a group, ensure they're properly added
      if (request.assignedGroup) {
        const group = await Group.findById(request.assignedGroup);
        if (group && !group.participants.includes(user._id)) {
          group.participants.push(user._id);
          await group.save();
        }
      }
    } else {
      // If rejected, remove user from the assigned group if they were added
      if (request.assignedGroup) {
        const group = await Group.findById(request.assignedGroup);
        if (group && group.participants.includes(user._id)) {
          group.participants = group.participants.filter(
            participant => participant.toString() !== user._id.toString()
          );
          await group.save();
        }
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `Feature access request ${action}d successfully`,
      request: {
        id: request._id,
        featureType: request.featureType,
        status: request.status,
        approvedBy: moderator.mobileNumber,
        approvedAt: request.approvedAt,
        moderatorNote: request.moderatorNote
      }
    });

  } catch (error) {
    console.error('Process feature request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
