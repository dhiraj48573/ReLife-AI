/**
 * RAG (Retrieval-Augmented Generation) Service
 * 
 * Provides fast, deterministic, maintainable document retrieval over the
 * verified emotional wellness and legal support knowledge base.
 * Returns citations with verified real URLs, titles, publishers, and review dates.
 */

const { WELLNESS_RESOURCES } = require('../../knowledge/wellnessResources');

// Common English stopwords to ignore in search queries
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your',
  'what', 'how', 'why', 'can', 'should', 'would', 'could', 'about', 'just'
]);

/**
 * Tokenize text into lowercased non-stopword tokens
 */
function tokenize(text = '') {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Score a single knowledge resource against query tokens
 */
function scoreDocument(doc, queryTokens, rawQueryLower) {
  let score = 0;

  // 1. Keyword overlap (Highest weight: 3.5 points per matching keyword)
  if (Array.isArray(doc.keywords)) {
    for (const kw of doc.keywords) {
      const kwLower = kw.toLowerCase();
      // Check full phrase match
      if (rawQueryLower.includes(kwLower)) {
        score += 4.0;
      } else {
        // Check token-level match
        const kwTokens = kwLower.split(/\s+/);
        for (const qt of queryTokens) {
          if (kwTokens.includes(qt)) {
            score += 2.0;
          }
        }
      }
    }
  }

  // 2. Title term match (Weight: 2.5 per match)
  const titleTokens = tokenize(doc.title);
  for (const qt of queryTokens) {
    if (titleTokens.includes(qt)) {
      score += 2.5;
    }
  }

  // 3. Content term match (Weight: 0.8 per match)
  const contentLower = doc.content.toLowerCase();
  for (const qt of queryTokens) {
    if (contentLower.includes(qt)) {
      score += 0.8;
    }
  }

  // 4. Category-specific intent boosts
  if (doc.category === 'legal_mediation' && /(law|legal|lawyer|court|custody|alimony|maintenance|mediation|nalsa)/i.test(rawQueryLower)) {
    score += 3.0;
  }
  if (doc.category === 'coparenting_custody' && /(child|children|custody|coparent|parent|visitation|parenting|kids)/i.test(rawQueryLower)) {
    score += 3.0;
  }
  if (doc.category === 'anxiety_regulation' && /(panic|anxiety|anxious|breathe|breathing|grounding|calm|overwhelmed|heart racing)/i.test(rawQueryLower)) {
    score += 3.0;
  }
  if (doc.category === 'loneliness_isolation' && /(lonely|alone|isolation|no one|isolated|abandoned|friendless)/i.test(rawQueryLower)) {
    score += 3.0;
  }
  if (doc.category === 'emotional_coping' && /(grief|divorce|separation|heartbroken|coping|sad|crying|pain)/i.test(rawQueryLower)) {
    score += 2.5;
  }

  return score;
}

/**
 * Retrieve top relevant verified documents for a user query.
 * 
 * @param {string} userQuery - The user query to search for
 * @param {Object} [options]
 * @param {number} [options.topK=2] - Max number of chunks to return
 * @param {number} [options.minScore=2.0] - Relevance threshold
 * @returns {Object} { chunks, citations, contextText }
 */
function retrieve(userQuery, options = {}) {
  const topK = options.topK || 2;
  const minScore = options.minScore || 2.0;

  if (!userQuery || typeof userQuery !== 'string') {
    return {
      chunks: [],
      citations: [],
      contextText: ''
    };
  }

  const rawQueryLower = userQuery.toLowerCase().trim();
  const queryTokens = tokenize(userQuery);

  if (queryTokens.length === 0) {
    return {
      chunks: [],
      citations: [],
      contextText: ''
    };
  }

  // Score all available verified resources
  const scored = WELLNESS_RESOURCES.map(doc => {
    const score = scoreDocument(doc, queryTokens, rawQueryLower);
    return {
      doc,
      score
    };
  });

  // Filter by threshold and sort descending
  const relevant = scored
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const chunks = relevant.map(item => ({
    id: item.doc.id,
    title: item.doc.title,
    publisher: item.doc.publisher,
    url: item.doc.url,
    reviewDate: item.doc.reviewDate,
    category: item.doc.category,
    content: item.doc.content,
    score: item.score
  }));

  const citations = chunks.map(chunk => ({
    title: chunk.title,
    publisher: chunk.publisher,
    url: chunk.url,
    reviewDate: chunk.reviewDate
  }));

  // Build formatted context text for LLM insertion
  let contextText = '';
  if (chunks.length > 0) {
    contextText = chunks.map((chunk, idx) => {
      return `[Document ${idx + 1}] Title: ${chunk.title}\nPublisher: ${chunk.publisher}\nURL: ${chunk.url}\nReview Date: ${chunk.reviewDate}\nExcerpt:\n${chunk.content}`;
    }).join('\n\n---\n\n');
  }

  return {
    chunks,
    citations,
    contextText
  };
}

module.exports = {
  retrieve,
  tokenize,
  scoreDocument
};
