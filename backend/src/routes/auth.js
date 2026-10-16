const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateOTP, sendOTP } = require('../utils/otp');

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// In-memory user store for offline / mock testing
const testMemoryUsers = new Map();

// Prepopulate mock users for offline testing (demo credentials)
if (process.env.NODE_ENV !== 'production') {
  const demoUsers = [
    { email: 'member@example.com', password: 'member123', role: 'user' },
    { email: 'moderator@example.com', password: 'mod12345', role: 'moderator' },
    { email: 'admin@example.com', password: 'admin12345', role: 'admin' }
  ];
  (async () => {
    for (const du of demoUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(du.password, salt);
      const mockId = new mongoose.Types.ObjectId().toString();
      testMemoryUsers.set(du.email, { ...du, password: hashed, _id: mockId, id: mockId });
    }
  })();
}

// Generate JWT token
const generateToken = (userId, userType) => {
  return jwt.sign(
    { userId, userType },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ==========================================
// Password-Based Registration & Login
// ==========================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with Email, Password, Name, and Role
 * @access  Public
 */
router.post('/register', [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('mobileNumber').optional().matches(/^[6-9]\d{9}$/).withMessage('Mobile number must be a valid 10-digit Indian number'),
  body('userType').optional().isIn(['user', 'moderator', 'admin']).withMessage('Invalid role type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg || 'Validation error',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, mobileNumber, userType } = req.body;
    const finalRole = userType || 'user';
    const first = firstName ? firstName.trim() : 'Member';
    const last = lastName ? lastName.trim() : '';

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const existing = await User.findOne({
        $or: [
          { 'profile.email': email },
          ...(mobileNumber ? [{ mobileNumber }] : [])
        ]
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email or mobile number already exists.'
        });
      }

      const user = new User({
        password,
        userType: finalRole,
        isVerified: true,
        ...(mobileNumber ? { mobileNumber } : {}),
        profile: {
          firstName: first,
          lastName: last,
          email
        }
      });

      await user.save();
      const token = generateToken(user._id, user.userType);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        token,
        user: {
          id: user._id,
          name: `${first} ${last}`.trim(),
          email,
          mobileNumber: user.mobileNumber || null,
          role: user.userType,
          userType: user.userType
        }
      });
    } else {
      if (testMemoryUsers.has(email)) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email or mobile number already exists.'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const mockId = new mongoose.Types.ObjectId().toString();

      const mockUser = {
        _id: mockId,
        id: mockId,
        password: hashedPassword,
        email,
        mobileNumber: mobileNumber || null,
        firstName: first,
        lastName: last,
        name: `${first} ${last}`.trim(),
        role: finalRole,
        userType: finalRole
      };

      testMemoryUsers.set(email, mockUser);
      const token = generateToken(mockId, finalRole);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        token,
        user: {
          id: mockId,
          name: mockUser.name,
          email,
          mobileNumber: mockUser.mobileNumber,
          role: finalRole,
          userType: finalRole
        }
      });
    }
  } catch (err) {
    console.error('Registration error:', err.name || 'Error');
    return res.status(500).json({
      success: false,
      message: 'Failed to create account. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Sign in with Email / Mobile & Password
 * @access  Public
 */
router.post('/login', [
  body('identifier').notEmpty().withMessage('Please provide your email or mobile number'),
  body('password').notEmpty().withMessage('Please enter your password')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg || 'Validation error',
        errors: errors.array()
      });
    }

    const { identifier, password } = req.body;
    const cleanId = identifier.trim().toLowerCase();

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const user = await User.findOne({
        $or: [
          { 'profile.email': cleanId },
          { mobileNumber: cleanId }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id, user.userType);
      const fullName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'Member';

      return res.status(200).json({
        success: true,
        message: `Welcome back, ${fullName}!`,
        token,
        user: {
          id: user._id,
          name: fullName,
          email: user.profile?.email || null,
          mobileNumber: user.mobileNumber || null,
          role: user.userType || 'user',
          userType: user.userType || 'user'
        }
      });
    } else {
      const user = testMemoryUsers.get(cleanId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      const token = generateToken(user._id, user.userType);

      return res.status(200).json({
        success: true,
        message: `Welcome back, ${user.name}!`,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobileNumber: user.mobileNumber,
          role: user.role,
          userType: user.userType
        }
      });
    }
  } catch (err) {
    console.error('Password login error:', err.name || 'Error');
    return res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.'
    });
  }
});

// Send OTP
router.post('/send-otp', [
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

    // Check if user exists
    let user = await User.findOne({ mobileNumber });

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (user) {
      // Update existing user
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      // Create new user
      user = new User({
        mobileNumber,
        otp,
        otpExpires,
        userType: 'user',
        profile: {
          firstName: 'User',
          lastName: mobileNumber.slice(-4)
        }
      });
      await user.save();
    }

    // Send OTP via Twilio (in production)
    if (process.env.NODE_ENV === 'production') {
      try {
        await sendOTP(mobileNumber, otp);
      } catch (error) {
        console.error('Error sending OTP:', error.name || 'Error');
        return res.status(500).json({
          success: false,
          message: 'Error sending OTP. Please try again.'
        });
      }
    } else {
      // Development: Log OTP to console
      console.log(`📱 OTP for ${mobileNumber}: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: '10 minutes',
      ...(process.env.NODE_ENV !== 'production' && { demoOtp: otp })
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify OTP and login
router.post('/verify-otp', [
  body('mobileNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid mobile number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
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

    const { mobileNumber, otp } = req.body;

    // Find user
    const user = await User.findOne({ mobileNumber });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please request OTP first.'
      });
    }

    // Check if OTP is expired
    if (user.otpExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Verify OTP
    const isValidOTP = await user.compareOTP(otp);

    if (!isValidOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // Mark user as verified and update login time
    user.isVerified = true;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.userType);

    // Return user data and token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        mobileNumber: user.mobileNumber,
        userType: user.userType,
        language: user.language,
        selectedTopics: user.selectedTopics,
        groupClass: user.groupClass,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        mobileNumber: user.mobileNumber,
        userType: user.userType,
        language: user.language,
        selectedTopics: user.selectedTopics,
        groupClass: user.groupClass,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user preferences
router.put('/preferences', [
  body('language').optional().isIn(['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam']),
  body('selectedTopics').optional().isArray(),
  body('groupClass').optional().isIn(['Basic', 'Premium'])
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

    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { language, selectedTopics, groupClass } = req.body;

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user preferences
    if (language) user.language = language;
    if (selectedTopics) user.selectedTopics = selectedTopics;
    if (groupClass) user.groupClass = groupClass;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      user: {
        language: user.language,
        selectedTopics: user.selectedTopics,
        groupClass: user.groupClass
      }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user's profile and permissions
 * @access  Private (Authenticated)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const firstName = user.profile?.firstName || user.name || 'ReLife';
    const lastName = user.profile?.lastName || 'Member';
    const fullName = `${firstName} ${lastName}`.trim();

    return res.status(200).json({
      success: true,
      user: {
        id: user._id ? user._id.toString() : user.userId,
        name: fullName,
        mobileNumber: user.mobileNumber || null,
        email: user.profile?.email || user.email || null,
        role: user.role || user.userType || 'user',
        userType: user.userType || user.role || 'user',
        isVerified: user.isVerified || false
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile'
    });
  }
});

/**
 * @route   POST /api/auth/demo-login
 * @desc    Fast 1-click authentication for Member, Moderator, or Admin
 * @access  Public (Demo / Staging / Development)
 */
router.post('/demo-login', async (req, res) => {
  try {
    const requestedRole = (req.body.role || 'user').toLowerCase();
    const demoProfiles = {
      user: {
        mobileNumber: '9876543210',
        userType: 'user',
        firstName: 'Sarah',
        lastName: 'Miller',
        email: 'sarah.miller@example.com'
      },
      moderator: {
        mobileNumber: '9876543211',
        userType: 'moderator',
        firstName: 'Dr. Priya',
        lastName: 'Sharma',
        email: 'priya.sharma@example.com'
      },
      admin: {
        mobileNumber: '9876543212',
        userType: 'admin',
        firstName: 'Rajesh',
        lastName: 'Sethi',
        email: 'admin@relife.in'
      }
    };

    const target = demoProfiles[requestedRole] || demoProfiles.user;

    let user = null;
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ mobileNumber: target.mobileNumber });
      } catch {
        // DB lookup failure
      }
    }

    if (!user) {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          user = new User({
            mobileNumber: target.mobileNumber,
            otp: '123456',
            otpExpires: new Date(Date.now() + 86400000),
            userType: target.userType,
            isVerified: true,
            profile: {
              firstName: target.firstName,
              lastName: target.lastName,
              email: target.email
            }
          });
          await user.save();
        } catch {
          // Fallback demo user ID
        }
      }
      if (!user) {
        user = {
          _id: target.userType === 'admin' ? '65f123456789abcdef000003' : (target.userType === 'moderator' ? '65f123456789abcdef000002' : '65f123456789abcdef000001'),
          mobileNumber: target.mobileNumber,
          userType: target.userType,
          isVerified: true,
          profile: { firstName: target.firstName, lastName: target.lastName, email: target.email }
        };
      }
    }

    const token = generateToken(user._id, user.userType);

    return res.status(200).json({
      success: true,
      message: `Signed in as ${target.firstName} (${target.userType.toUpperCase()})`,
      token,
      user: {
        id: user._id,
        name: `${target.firstName} ${target.lastName}`,
        mobileNumber: user.mobileNumber,
        userType: user.userType,
        role: user.userType,
        email: target.email,
        isVerified: true
      }
    });
  } catch (error) {
    console.error('Demo login error:', error.name || 'Error');
    return res.status(500).json({
      success: false,
      message: 'Error processing demo authentication'
    });
  }
});

module.exports = router;
