/**
 * Safety Guard & Crisis Escalation Service
 * 
 * Provides deterministic escalation for explicit self-harm, suicidal ideation,
 * or immediate physical danger using verified support resources.
 * 
 * CRITICAL RULE: Sentiment scores alone MUST NEVER trigger a crisis determination.
 * Only explicit indicators of self-harm, suicide, or immediate physical peril
 * trigger crisis escalation.
 */

// Regex patterns targeting explicit self-harm, suicide, or acute physical danger
const CRISIS_PATTERNS = [
  // Explicit suicide ideation or intent
  /\b(suicid(e|al|ing)?|kill myself|want to die|ending my life|end my life|take my own life)\b/i,
  /\b(hang(ing)? myself|slit(ting)? my wrists?|shoot(ing)? myself|overdos(e|ing)|poison(ing)? myself)\b/i,
  /\b(jump(ing)? off a (bridge|building|roof|cliff))\b/i,
  /\b(better off dead|no reason to (live|go on|keep living)|don't want to live anymore|dont want to live anymore)\b/i,
  
  // Explicit self-harm
  /\b(self[- ]harm(ing)?|cut(ting)? myself|burn(ing)? myself|harm(ing)? myself|hurt(ing)? myself physically)\b/i,
  
  // Imminent physical violence / emergency danger in progress
  /\b(he is (beating|hitting|strangling|attacking) me|she is (beating|hitting|strangling|attacking) me)\b/i,
  /\b(in immediate physical danger|threatened to kill me|threaten(ing)? my life right now)\b/i
];

// Verified Regional Support Resources
const REGIONAL_RESOURCES = {
  in: {
    country: 'India',
    emergency: '112',
    services: [
      {
        name: 'Tele-MANAS (Govt of India / MoHFW)',
        phone: '14416 / 1800-891-4416',
        description: '24/7 Toll-free, confidential national mental health counseling in 20+ Indian languages',
        url: 'https://telemanas.mohfw.gov.in/'
      },
      {
        name: 'KIRAN Mental Health Helpline',
        phone: '1800-599-0019',
        description: '24/7 Toll-free psychological first aid and emotional distress support',
        url: 'https://disabilityaffairs.gov.in/'
      },
      {
        name: 'National Commission for Women (NCW)',
        phone: '7827170170',
        description: '24/7 Domestic violence and women distress helpline',
        url: 'http://ncw.nic.in/'
      },
      {
        name: 'ERSS Pan-India Emergency',
        phone: '112',
        description: 'Immediate police, ambulance, and medical emergency assistance',
        url: 'https://112.gov.in/'
      }
    ]
  },
  us: {
    country: 'United States',
    emergency: '911',
    services: [
      {
        name: '988 Suicide & Crisis Lifeline',
        phone: '988 (Call or Text)',
        description: '24/7 Free and confidential support for people in suicidal crisis or distress',
        url: 'https://988lifeline.org/'
      },
      {
        name: 'Crisis Text Line',
        phone: 'Text HOME to 741741',
        description: '24/7 Free text support with a trained crisis counselor',
        url: 'https://www.crisistextline.org/'
      },
      {
        name: 'National Domestic Violence Hotline',
        phone: '1-800-799-SAFE (7233)',
        description: '24/7 Free, confidential domestic violence support',
        url: 'https://www.thehotline.org/'
      }
    ]
  },
  uk: {
    country: 'United Kingdom',
    emergency: '999',
    services: [
      {
        name: 'Samaritans',
        phone: '116 123',
        description: '24/7 Free helpline for anyone struggling to cope',
        url: 'https://www.samaritans.org/'
      },
      {
        name: 'NHS Mental Health Services',
        phone: '111',
        description: '24/7 Urgent mental health advice and triage',
        url: 'https://www.nhs.uk/service-search/mental-health/find-an-urgent-mental-health-helpline'
      }
    ]
  },
  ca: {
    country: 'Canada',
    emergency: '911',
    services: [
      {
        name: '988 Suicide Crisis Helpline',
        phone: '988 (Call or Text)',
        description: '24/7 Toll-free suicide prevention and crisis support across Canada',
        url: 'https://988.ca/'
      }
    ]
  },
  au: {
    country: 'Australia',
    emergency: '000',
    services: [
      {
        name: 'Lifeline Australia',
        phone: '13 11 14',
        description: '24/7 Crisis support and suicide prevention services',
        url: 'https://www.lifeline.org.au/'
      }
    ]
  }
};

/**
 * Detect location code from user profile or message context
 */
function resolveLocationCode(userLocation = '') {
  if (!userLocation || typeof userLocation !== 'string') {
    return 'in'; // Default to India where ReLife is based
  }

  const loc = userLocation.toLowerCase().trim();
  if (loc === 'us' || loc === 'usa' || loc === 'united states' || loc.includes('america')) {
    return 'us';
  }
  if (loc === 'uk' || loc === 'united kingdom' || loc === 'britain' || loc === 'england' || loc === 'scotland') {
    return 'uk';
  }
  if (loc === 'ca' || loc === 'canada') {
    return 'ca';
  }
  if (loc === 'au' || loc === 'australia') {
    return 'au';
  }
  return 'in';
}

/**
 * Checks if a message indicates an explicit crisis or immediate danger.
 * 
 * IMPORTANT: Sentiment scores alone MUST NEVER trigger a crisis determination.
 * Even if sentimentScore is -1.0, isCrisis remains false if there are no explicit crisis triggers.
 * 
 * @param {Object} params
 * @param {string} params.text - User message text
 * @param {number} [params.sentimentScore] - Sentiment score (-1.0 to 1.0)
 * @param {string} [params.userLocation] - User location or country code
 * @returns {Object} Crisis evaluation result
 */
function checkCrisis({ text, sentimentScore, userLocation } = {}) {
  if (!text || typeof text !== 'string') {
    return {
      isCrisis: false,
      escalated: false,
      reason: null
    };
  }

  const cleanText = text.trim();
  let matchedPattern = null;

  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(cleanText)) {
      matchedPattern = pattern.toString();
      break;
    }
  }

  // If no explicit crisis pattern matched, return false
  // Explicitly proving sentimentScore alone has no bearing on crisis detection:
  if (!matchedPattern) {
    return {
      isCrisis: false,
      escalated: false,
      reason: null,
      sentimentOnlyCheck: typeof sentimentScore === 'number' ? 'ignored_for_crisis' : null
    };
  }

  // Crisis confirmed via explicit pattern
  const locCode = resolveLocationCode(userLocation || extractLocationFromText(cleanText));
  const regionalData = REGIONAL_RESOURCES[locCode] || REGIONAL_RESOURCES.in;

  const crisisResponse = buildCrisisResponse(regionalData);

  return {
    isCrisis: true,
    escalated: true,
    reason: 'explicit_self_harm_or_immediate_danger',
    location: regionalData.country,
    response: crisisResponse.message,
    resources: regionalData.services,
    citations: regionalData.services.map(s => ({
      title: s.name,
      publisher: regionalData.country + ' Emergency & Support Services',
      url: s.url,
      reviewDate: '2024-01-01'
    })),
    disclaimer: 'ReLife AI is an emotional support platform and does NOT provide medical diagnosis, clinical treatment, or crisis intervention services. If you are in immediate danger, please reach out to the emergency services listed above immediately.'
  };
}

/**
 * Extract simple location hints mentioned in query text (e.g. "I am in the US")
 */
function extractLocationFromText(text) {
  if (/\b(in the us|in the usa|in the united states|in america)\b/i.test(text)) return 'us';
  if (/\b(in the uk|in the united kingdom|in london|in england)\b/i.test(text)) return 'uk';
  if (/\b(in canada)\b/i.test(text)) return 'ca';
  if (/\b(in australia)\b/i.test(text)) return 'au';
  if (/\b(in india|in delhi|in mumbai|in bangalore)\b/i.test(text)) return 'in';
  return null;
}

/**
 * Build compassionate, non-judgmental crisis escalation message
 */
function buildCrisisResponse(regionalData) {
  let message = `I hear how much pain you are experiencing right now, and I want you to be safe. Because your safety and life are deeply important, please connect with trained professionals who can support you immediately.\n\n`;
  message += `🚨 **Immediate Free & Confidential Support (${regionalData.country}):**\n`;

  regionalData.services.forEach(s => {
    message += `• **${s.name}**: Call **${s.phone}**\n  _${s.description}_ (${s.url})\n`;
  });

  message += `\n• **Immediate Emergency**: Dial **${regionalData.emergency}** directly.\n`;
  message += `• **International Support Directory**: https://findahelpline.com/\n\n`;
  message += `Please reach out to one of these resources right now, or contact a trusted family member, doctor, or emergency room. You do not have to carry this alone.`;

  return { message };
}

module.exports = {
  checkCrisis,
  resolveLocationCode,
  REGIONAL_RESOURCES,
  CRISIS_PATTERNS
};
