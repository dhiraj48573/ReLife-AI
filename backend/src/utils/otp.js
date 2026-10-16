const crypto = require('crypto');
const twilio = require('twilio');

// Generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Send OTP via Twilio
const sendOTP = async (mobileNumber, otp) => {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await client.messages.create({
      body: `Your ReLife verification code is: ${otp}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${mobileNumber}` // Add country code for India
    });

    console.log(`OTP sent to ${mobileNumber}:`, message.sid);
    return message;

  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP');
  }
};

// Verify OTP (for testing purposes)
const verifyOTP = (inputOTP, storedOTP) => {
  return inputOTP === storedOTP;
};

module.exports = {
  generateOTP,
  sendOTP,
  verifyOTP
};
