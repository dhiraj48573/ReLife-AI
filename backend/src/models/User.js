const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  mobileNumber: {
    type: String,
    required: false,
    match: /^[6-9]\d{9}$/ // Indian mobile number pattern
  },
  password: {
    type: String,
    required: false,
    minlength: 6
  },
  otp: {
    type: String,
    required: false
  },
  otpExpires: {
    type: Date,
    required: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  userType: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  language: {
    type: String,
    enum: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'],
    default: 'English'
  },
  selectedTopics: [{
    type: String,
    enum: [
      'Women Support', 'Mens Support', 'Emotional & Mental Support',
      'Child Issues & Custody', 'NRI Section', 'Alimony', 'Maintenance',
      'Property', 'Cash', 'Gold', 'Domestic Violence', 'Child Abuse',
      'Extra Marital Issues'
    ]
  }],
  groupClass: {
    type: String,
    enum: ['Basic', 'Premium'],
    default: 'Basic'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  googleCalendarId: {
    type: String,
    default: null
  },
  featureAccessRequests: [{
    featureType: {
      type: String,
      enum: ['basic', 'premium'],
      required: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    assignedGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    },
    moderatorNote: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date
  }],
  currentFeatureAccess: {
    type: String,
    enum: ['basic', 'premium', 'none'],
    default: 'none'
  },
  assignedGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  moderatorNote: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 100
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(value) {
          return !value || new Date(value) < new Date();
        },
        message: 'Date of birth cannot be in the future'
      }
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Other'
    },
    location: {
      city: String,
      state: String,
      country: {
        type: String,
        default: 'India'
      },
      pincode: {
        type: String,
        match: /^[1-9]\d{6}$/
      }
    },
    profilePicture: {
      type: String,
      default: null
    },
    bio: {
      type: String,
      maxlength: 500,
      trim: true
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String
    },
    lastLogin: {
      type: Date,
      default: Date.now
    },
    loginHistory: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      ipAddress: String,
      userAgent: String,
      location: {
        type: {
          type: String,
          enum: ['approximate', 'city', 'country']
        },
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      }
    }],
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true }
      },
      privacy: {
        profileVisibility: {
          type: String,
          enum: ['public', 'private', 'friends'],
          default: 'private'
        },
        showOnlineStatus: { type: Boolean, default: false }
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      }
    }
  },
  googleCalendarId: {
    type: String,
    default: null
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium'],
      default: 'basic'
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending'],
      default: 'active'
    },
    startDate: Date,
    endDate: Date,
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'upi', 'card', 'netbanking'],
      default: null
    },
    lastPayment: {
      amount: Number,
      currency: {
        type: String,
        default: 'INR'
      },
      date: Date,
      transactionId: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
userSchema.index({ mobileNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ userType: 1 });
userSchema.index({ groupClass: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'profile.email': 1 }, { sparse: true });
userSchema.index({ 'assignedGroup': 1 });
userSchema.index({ 'subscription.status': 1 });

// Virtual fields for derived data
userSchema.virtual('fullName').get(function() {
  return `${this.profile?.firstName || ''} ${this.profile?.lastName || ''}`.trim();
});

userSchema.virtual('age').get(function() {
  if (!this.profile?.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.profile.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

userSchema.virtual('isPremium').get(function() {
  return this.groupClass === 'Premium' || this.subscription?.plan === 'premium';
});

userSchema.virtual('profileCompletion').get(function() {
  let completed = 0;
  let total = 0;
  
  if (this.profile) {
    const required = ['firstName', 'lastName', 'email', 'dateOfBirth', 'gender'];
    required.forEach(field => {
      if (this.profile[field]) completed++;
      total++;
    });
  }
  
  return Math.round((completed / total) * 100);
});

// Hash Password and OTP before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  if (this.isModified('otp') && this.otp) {
    const salt = await bcrypt.genSalt(10);
    this.otp = await bcrypt.hash(this.otp, salt);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Compare OTP method
userSchema.methods.compareOTP = async function(candidateOTP) {
  if (!this.otp) return false;
  return await bcrypt.compare(candidateOTP, this.otp);
};

// Method to update last login
userSchema.methods.updateLastLogin = function(loginData) {
  this.lastLogin = new Date();
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress: loginData.ipAddress,
    userAgent: loginData.userAgent,
    location: loginData.location
  });
  return this.save();
};

// Method to get active users with pagination
userSchema.statics.getActiveUsers = function(page = 1, limit = 20) {
  return this.find({ isActive: true })
    .select('mobileNumber userType profile.firstName profile.lastName profile.email currentFeatureAccess')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

// Method to search users
userSchema.statics.searchUsers = function(query, page = 1, limit = 20) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { 'profile.firstName': searchRegex },
          { 'profile.lastName': searchRegex },
          { 'profile.email': searchRegex },
          { mobileNumber: searchRegex }
        ]
      }
    ]
  })
  .select('mobileNumber profile.firstName profile.lastName profile.email userType currentFeatureAccess')
  .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

module.exports = mongoose.model('User', userSchema);
