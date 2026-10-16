const ChatHistory = require('../models/ChatHistory');
const { v4: uuidv4 } = require('uuid');

// Enhanced responses with more context
// Knowledge base for FAQs
const FAQS = [
  {
    question: /how.*file.*divorce/i,
    answer: 'To file for divorce, you\'ll need to complete the necessary legal forms and submit them to your local family court. Would you like me to provide more specific information based on your location?',
    tags: ['divorce', 'legal', 'filing']
  },
  {
    question: /how.*child.*support/i,
    answer: 'Child support is typically calculated based on both parents\' incomes and the custody arrangement. The exact formula varies by state. Would you like information specific to your state?',
    tags: ['child support', 'custody', 'legal']
  },
  {
    question: /how.*find.*lawyer/i,
    answer: 'You can find a qualified divorce attorney through your local bar association or legal aid society. We also have a directory of family law attorneys. Would you like me to search for lawyers in your area?',
    tags: ['lawyer', 'attorney', 'legal help']
  },
  {
    question: /what.*documents.*need/i,
    answer: 'Commonly required documents for divorce include: marriage certificate, financial statements, tax returns, and information about assets/debts. The exact requirements vary by jurisdiction.',
    tags: ['documents', 'paperwork', 'requirements']
  }
];

// Resource database
const RESOURCES = {
  legal: [
    { title: 'Legal Aid Society', url: 'https://www.legalaid.org', description: 'Free legal assistance for those who qualify' },
    { title: 'State Bar Association', url: 'https://www.americanbar.org/groups/legal_services/flh-home/', description: 'Find a lawyer in your state' },
    { title: 'Divorce Forms', url: 'https://www.rocketlawyer.com/divorce/divorce-forms', description: 'Downloadable divorce forms' }
  ],
  emotional: [
    { title: 'BetterHelp', url: 'https://www.betterhelp.com', description: 'Online counseling and therapy' },
    { title: 'NAMI Helpline', url: 'https://www.nami.org/help', description: 'Mental health support' },
    { title: 'DivorceCare', url: 'https://www.divorcecare.org', description: 'Support groups for divorce recovery' }
  ],
  financial: [
    { title: 'Financial Planning Association', url: 'https://www.plannersearch.org', description: 'Find a certified financial planner' },
    { title: 'Mint', url: 'https://www.mint.com', description: 'Budgeting and financial tracking' },
    { title: 'Credit Karma', url: 'https://www.creditkarma.com', description: 'Free credit score monitoring' }
  ]
};

const RESPONSES = {
  greetings: {
    patterns: ['hello', 'hi', 'hey', 'greetings'],
    responses: [
      'Hello! Welcome to ReLife Support. I can help with legal questions, emotional support, and finding resources. How can I assist you today?',
      'Hi there! I\'m here to help with your divorce support needs. You can ask me about legal processes, support groups, or any other concerns you might have.',
      'Welcome back! How can I support you with your divorce journey today?'
    ]
  },
  help: {
    patterns: ['help', 'support', 'assistance'],
    responses: [
      'I can help you with:\n- Finding support groups\n- Scheduling meetings\n- Answering FAQs\n- Connecting with professionals\n\nWhat do you need help with?',
      'I\'m here to assist with:\n• Group information\n• Meeting schedules\n• Account help\n• Support resources\n\nWhat would you like to know more about?'
    ]
  },
  groups: {
    patterns: ['group', 'support group', 'meeting'],
    responses: [
      'You can join support groups through the Groups section. Would you like to know about available groups?',
      'Our support groups provide a safe space to share and connect. Would you like to join one?'
    ]
  },
  resources: {
    patterns: ['resource', 'helpful', 'information', 'material'],
    responses: [
      'We offer various resources including articles, hotlines, and professional contacts. What specific information are you looking for?',
      'I can provide resources on legal advice, counseling, and support services. What do you need help with?'
    ]
  },
  gratitude: {
    patterns: ['thank', 'thanks', 'appreciate'],
    responses: [
      'You\'re welcome! Is there anything else I can help you with?',
      'Happy to help! Let me know if you have any other questions.'
    ]
  },
  farewell: {
    patterns: ['bye', 'goodbye', 'see you'],
    responses: [
      'Goodbye! Remember, we\'re here to support you.',
      'Take care! Feel free to come back if you need more assistance.'
    ]
  }
};

// Function to check FAQ matches
function checkFAQs(message) {
  const lowerMessage = message.toLowerCase();
  
  // Check for FAQ matches
  for (const faq of FAQS) {
    if (faq.question.test(lowerMessage)) {
      return {
        response: faq.answer,
        intent: 'faq',
        confidence: 0.95,
        metadata: { tags: faq.tags }
      };
    }
  }
  return null;
}

// Function to find relevant resources
function findResources(message) {
  const lowerMessage = message.toLowerCase();
  const matchedResources = [];
  
  // Check each resource category
  for (const [category, resources] of Object.entries(RESOURCES)) {
    if (lowerMessage.includes(category) || 
        (category === 'legal' && (lowerMessage.includes('lawyer') || lowerMessage.includes('attorney') || lowerMessage.includes('legal'))) ||
        (category === 'emotional' && (lowerMessage.includes('support') || lowerMessage.includes('therapy') || lowerMessage.includes('counseling'))) ||
        (category === 'financial' && (lowerMessage.includes('money') || lowerMessage.includes('finance') || lowerMessage.includes('debt')))) {
      matchedResources.push(...resources);
    }
  }
  
  return matchedResources.slice(0, 3); // Return max 3 resources
}

// Function to find the best matching response
function findMatchingResponse(message, context = {}) {
  const lowerMessage = message.toLowerCase();
  
  // Check FAQ matches first
  const faqMatch = checkFAQs(message);
  if (faqMatch) return faqMatch;
  
  // Check for resource requests
  if (lowerMessage.includes('resource') || lowerMessage.includes('help') || lowerMessage.includes('need help')) {
    const resources = findResources(lowerMessage);
    if (resources.length > 0) {
      const resourceList = resources.map(r => 
        `• [${r.title}](${r.url}): ${r.description}`
      ).join('\n');
      
      return {
        response: `Here are some resources that might help:\n${resourceList}\n\nWould you like more specific information on any of these?`,
        intent: 'resource_suggestion',
        confidence: 0.9,
        metadata: { resources: resources.map(r => r.title) }
      };
    }
  }
  
  // Check for exact matches in responses
  for (const [intent, data] of Object.entries(RESPONSES)) {
    if (data.patterns.some(pattern => lowerMessage.includes(pattern))) {
      const randomResponse = data.responses[Math.floor(Math.random() * data.responses.length)];
      return {
        response: randomResponse,
        intent,
        confidence: 0.9 // High confidence for direct matches
      };
    }
  }

  // If no direct match, try to find partial matches
  const words = lowerMessage.split(/\s+/);
  for (const word of words) {
    for (const [intent, data] of Object.entries(RESPONSES)) {
      if (data.patterns.some(pattern => pattern.includes(word) || word.includes(pattern))) {
        const randomResponse = data.responses[Math.floor(Math.random() * data.responses.length)];
        return {
          response: randomResponse,
          intent,
          confidence: 0.7 // Medium confidence for partial matches
        };
      }
    }
  }

  // Default fallback response
  return {
    response: "I'm sorry, I didn't understand that. Could you rephrase or ask about something else? I can help with group information, meetings, or support resources.",
    intent: 'unknown',
    confidence: 0
  };
}

// Save chat message to history
async function saveMessage(sessionId, userId, sender, message, intent = null) {
  const chatUpdate = {
    $push: {
      messages: {
        sender,
        message,
        ...(intent && { metadata: { intent } })
      }
    },
    $set: {
      'context.lastIntent': intent,
      'context.lastInteraction': new Date()
    },
    $setOnInsert: {
      userId,
      sessionId,
      'context.userPreferences.language': 'en',
      'context.userPreferences.notify': true
    }
  };

  await ChatHistory.findOneAndUpdate(
    { sessionId },
    chatUpdate,
    { upsert: true, new: true }
  );
}

// Get chat history for a session
async function getChatHistory(sessionId, userId = null, limit = 10) {
  const query = { sessionId };
  if (userId) query.userId = userId;
  const result = await ChatHistory.findOne(
    query,
    { messages: { $slice: -limit } }
  );
  
  return result ? result.messages : [];
}

// Start a new chat session
async function startNewSession(userId) {
  const sessionId = uuidv4();
  const welcomeMessage = "Hello! I'm your divorce support assistant. How can I help you today?";
  
  await saveMessage(sessionId, userId, 'bot', welcomeMessage, 'welcome');
  
  return {
    sessionId,
    message: welcomeMessage
  };
}

// Process user message and generate response
async function processMessage(sessionId, userId, userMessage) {
  // Save user message
  await saveMessage(sessionId, userId, 'user', userMessage);
  
  // Get chat context
  const chatHistory = await ChatHistory.findOne({ sessionId });
  const context = chatHistory?.context || {};
  
  // Generate response
  const { response, intent, metadata = {} } = findMatchingResponse(userMessage, context);
  
  // Handle follow-up questions
  let finalResponse = response;
  if (intent === 'faq' && metadata.tags) {
    const followUp = '\n\nWould you like more information about this topic or help finding resources?';
    finalResponse = response + followUp;
  }
  
  // Save bot response
  await saveMessage(sessionId, userId, 'bot', finalResponse, intent);
  
  return {
    response: finalResponse,
    intent,
    sessionId,
    metadata
  };
}

// Get resources by category
async function getResourcesByCategory(category) {
  const normalizedCategory = category.toLowerCase();
  if (RESOURCES[normalizedCategory]) {
    return {
      success: true,
      category: normalizedCategory,
      resources: RESOURCES[normalizedCategory]
    };
  }
  
  // If category not found, return all resources
  return {
    success: true,
    category: 'all',
    resources: Object.values(RESOURCES).flat()
  };
}

// Add a function to get all FAQ categories
function getFAQCategories() {
  const categories = new Set();
  FAQS.forEach(faq => {
    faq.tags.forEach(tag => categories.add(tag));
  });
  return Array.from(categories);
}

// Add a function to search FAQs
function searchFAQs(query) {
  const results = [];
  const lowerQuery = query.toLowerCase();
  
  FAQS.forEach(faq => {
    if (faq.question.test(lowerQuery) || 
        faq.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      results.push({
        question: faq.question.toString().replace('/^/i', '').replace('/i?$', ''),
        answer: faq.answer,
        tags: faq.tags
      });
    }
  });
  
  return results;
}

module.exports = {
  processMessage,
  getChatHistory,
  startNewSession,
  getResourcesByCategory,
  getFAQCategories,
  searchFAQs
};
