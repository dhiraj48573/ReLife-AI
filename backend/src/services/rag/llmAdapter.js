/**
 * Configurable LLM Provider Adapter
 * 
 * Supports 'gemini', 'openai', and 'mock' providers.
 * Handles timeouts, network failures, and missing API keys gracefully with a
 * safe, compassionate fallback that maintains retrieved citations.
 * All API keys remain strictly server-side.
 */

const config = require('../../config/llm');

/**
 * Generate a supportive mock response for offline/testing/fallback scenarios.
 */
function generateMockResponse({ userMessage, retrievedChunks = [], hasInjectionAttempt = false }) {
  // If user attempted prompt injection
  if (hasInjectionAttempt) {
    return (
      "I understand you are testing my boundaries, but I cannot modify my core purpose or ignore my safety guidelines. " +
      "I am ReLife's AI Emotional Support Assistant, here to provide compassionate listening, emotional coping strategies, " +
      "and verified support resources. Please let me know how you are feeling or what you'd like support with today."
    );
  }

  // Empathetic active listening opener
  let response = "I hear what you're sharing, and navigating these feelings and life changes can feel deeply challenging. ";

  if (retrievedChunks && retrievedChunks.length > 0) {
    const primary = retrievedChunks[0];
    if (primary.category === 'legal_mediation') {
      response += "When dealing with separation or divorce logistics, having clear information can help ease the feeling of uncertainty. ";
      response += `Under official mediation guidelines like those from ${primary.publisher}, pre-litigation mediation and legal aid can help both parties reach constructive agreements without prolonged courtroom conflict. `;
      response += "Remember to consult a licensed family attorney or your local legal aid service for legal advice tailored to your specific situation.";
    } else if (primary.category === 'anxiety_regulation') {
      response += "When emotional overwhelm or panic peaks, focusing on physiological calming can help. ";
      response += "Try a simple grounding exercise, such as the 5-4-3-2-1 technique or 4-7-8 deep diaphragmatic breathing to help signal safety to your nervous system. ";
      response += "Take it one small breath at a time—you don't have to resolve everything this very minute.";
    } else if (primary.category === 'coparenting_custody') {
      response += "Co-parenting through separation requires immense emotional patience. ";
      response += `As highlighted by ${primary.publisher}, keeping parental conflict away from children and maintaining predictable schedules gives kids a vital sense of security. `;
      response += "Keeping communications concise, neutral, and focused on logistics can also protect your own emotional energy.";
    } else if (primary.category === 'loneliness_isolation') {
      response += "Feeling lonely or isolated after a relationship ends is very painful, but it is a temporary chapter, not your permanent state. ";
      response += "Taking small micro-steps—like reaching out to a peer support group, practicing expressive journaling, or scheduling an anchor activity—can help restore your sense of connection.";
    } else {
      response += "Allow yourself the space to mourn and process these emotions. Healing from a major life change is rarely linear. ";
      response += "Focus on gentle daily self-care, maintaining healthy boundaries, and leaning on trusted friends or community support.";
    }
  } else {
    response += "Remember that you don't have to carry this all alone. Allowing yourself to acknowledge your emotions without self-judgment is an important first step. ";
    response += "Taking things one day at a time, establishing steady daily routines, and connecting with supportive communities can make a meaningful difference.";
  }

  return response;
}

/**
 * Call Google Gemini REST API using server-side key
 */
async function callGemini({ systemPrompt, userPrompt, timeoutMs }) {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const url = `${config.gemini.endpoint}/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini API returned empty text response');
    }
    return candidateText.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call OpenAI Chat Completions API using server-side key
 */
async function callOpenAI({ systemPrompt, userPrompt, timeoutMs }) {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server');
  }

  const url = `${config.openai.endpoint}/chat/completions`;

  const payload = {
    model: config.openai.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: config.temperature,
    max_tokens: config.maxOutputTokens
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const candidateText = data.choices?.[0]?.message?.content;
    if (!candidateText) {
      throw new Error('OpenAI API returned empty message content');
    }
    return candidateText.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Main adapter dispatch function with graceful degradation
 * 
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {string} params.userMessage
 * @param {Array} [params.retrievedChunks]
 * @param {boolean} [params.hasInjectionAttempt]
 * @param {string} [params.overrideProvider]
 * @returns {Promise<Object>} { text, provider, status, error? }
 */
async function generateResponse({
  systemPrompt,
  userPrompt,
  userMessage,
  retrievedChunks = [],
  hasInjectionAttempt = false,
  overrideProvider = null
}) {
  const provider = overrideProvider || config.provider || 'mock';
  const timeoutMs = config.timeoutMs || 12000;

  // 1. Mock provider directly
  if (provider === 'mock') {
    const text = generateMockResponse({ userMessage, retrievedChunks, hasInjectionAttempt });
    return {
      text,
      provider: 'mock',
      status: 'ok'
    };
  }

  // 2. Real cloud provider with fallback
  try {
    let text = '';
    if (provider === 'gemini') {
      text = await callGemini({ systemPrompt, userPrompt, timeoutMs });
    } else if (provider === 'openai') {
      text = await callOpenAI({ systemPrompt, userPrompt, timeoutMs });
    } else {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    return {
      text,
      provider,
      status: 'ok'
    };
  } catch (error) {
    // Provider failure: Log securely without exposing API keys
    let safeErrorMsg = error.name === 'AbortError'
      ? 'Provider request timed out'
      : (error.message || 'Unknown provider error').replace(/key=[^&\s]+/gi, 'key=[REDACTED]');

    const geminiKey = config.gemini.apiKey;
    if (geminiKey && geminiKey.length > 5 && safeErrorMsg.includes(geminiKey)) {
      safeErrorMsg = safeErrorMsg.replaceAll(geminiKey, '[REDACTED]');
    }
    const openaiKey = config.openai.apiKey;
    if (openaiKey && openaiKey.length > 5 && safeErrorMsg.includes(openaiKey)) {
      safeErrorMsg = safeErrorMsg.replaceAll(openaiKey, '[REDACTED]');
    }

    console.warn(`[LLM Adapter] ${provider} inference failed: ${safeErrorMsg}. Gracefully falling back to supportive local response.`);

    // Return safe compassionate fallback incorporating retrieved context
    const fallbackText = generateMockResponse({ userMessage, retrievedChunks, hasInjectionAttempt });

    return {
      text: fallbackText,
      provider,
      status: 'fallback',
      fallback: true,
      providerError: safeErrorMsg
    };
  }
}

module.exports = {
  generateResponse,
  generateMockResponse,
  callGemini,
  callOpenAI
};
