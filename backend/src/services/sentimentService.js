/**
 * ReLife Platform - Sentiment Analysis & Analytics Service (Phase 3)
 *
 * Coordinates sentiment inference, journal persistence, aggregate summary metrics,
 * and longitudinal weekly trend tracking for authenticated users.
 *
 * Safety & Ethical Compliance:
 * - Never presents results as psychiatric or medical diagnoses.
 * - Never infers crisis or suicidal ideation solely from negative sentiment.
 * - Never fabricates pseudo-confidence scores if inference fails.
 */

const Journal = require('../models/Journal');
const sentimentAdapter = require('./sentiment/sentimentAdapter');

const CLINICAL_DISCLAIMER =
  'ReLife Sentiment Estimates are algorithmic reflections designed for well-being tracking only and do not constitute a medical, psychiatric, or psychological diagnosis. Never infer crisis solely from sentiment.';

class SentimentService {
  constructor() {
    this.disclaimer = CLINICAL_DISCLAIMER;
  }

  /**
   * Analyze and persist sentiment for a specific journal entry
   * @param {string|ObjectId} journalId
   * @param {string|ObjectId} userId
   * @returns {Promise<object>}
   */
  async analyzeJournalEntry(journalId, userId) {
    const journal = await Journal.findOne({ _id: journalId, userId });

    if (!journal) {
      return {
        success: false,
        notFound: true,
        message: 'Journal entry not found'
      };
    }

    const inferenceResult = await sentimentAdapter.analyze(journal.content);

    if (!inferenceResult.success || inferenceResult.status === 'failed') {
      // Record failure state explicitly without silent fabrication
      journal.sentiment = {
        score: null,
        label: null,
        confidence: null,
        uncertainty: null,
        detectedEmotions: [],
        model: inferenceResult.model || sentimentAdapter.modelName,
        modelVersion: inferenceResult.modelVersion || sentimentAdapter.modelVersion,
        status: 'failed',
        analyzedAt: new Date()
      };
      await journal.save();

      return {
        success: false,
        status: 'failed',
        message: `Sentiment inference failed: ${inferenceResult.error || 'Unknown error'}`,
        data: journal,
        disclaimer: this.disclaimer
      };
    }

    // Persist model label, score, uncertainty, and model metadata
    journal.sentiment = {
      score: inferenceResult.score,
      label: inferenceResult.label,
      confidence: inferenceResult.confidence,
      uncertainty: inferenceResult.uncertainty,
      detectedEmotions: inferenceResult.detectedEmotions || [],
      model: inferenceResult.model,
      modelVersion: inferenceResult.modelVersion,
      status: 'completed',
      analyzedAt: inferenceResult.analyzedAt || new Date()
    };

    await journal.save();

    return {
      success: true,
      status: 'completed',
      message: 'Journal sentiment evaluated successfully',
      data: journal,
      disclaimer: this.disclaimer
    };
  }

  /**
   * Retrieve aggregate sentiment summary for an authenticated user
   * @param {string|ObjectId} userId
   * @returns {Promise<object>}
   */
  async getSummary(userId) {
    const entries = await Journal.find({ userId, isArchived: false }).lean();

    const totalEntries = entries.length;
    let analyzedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    const distribution = { positive: 0, neutral: 0, negative: 0 };
    let scoreSum = 0;
    let moodSum = 0;
    let moodCount = 0;
    const emotionFrequency = {};

    for (const entry of entries) {
      if (entry.selfReportedMood) {
        moodSum += entry.selfReportedMood;
        moodCount++;
      }

      if (entry.sentiment && entry.sentiment.status === 'completed' && entry.sentiment.label) {
        analyzedCount++;
        if (distribution[entry.sentiment.label] !== undefined) {
          distribution[entry.sentiment.label]++;
        }
        if (typeof entry.sentiment.score === 'number') {
          scoreSum += entry.sentiment.score;
        }
        if (Array.isArray(entry.sentiment.detectedEmotions)) {
          for (const emo of entry.sentiment.detectedEmotions) {
            emotionFrequency[emo] = (emotionFrequency[emo] || 0) + 1;
          }
        }
      } else if (entry.sentiment && entry.sentiment.status === 'failed') {
        failedCount++;
      } else {
        pendingCount++;
      }
    }

    const averageSentimentScore = analyzedCount > 0 ? Math.round((scoreSum / analyzedCount) * 1000) / 1000 : null;
    const averageSelfReportedMood = moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : null;

    // Sort detected emotions by frequency
    const topEmotions = Object.entries(emotionFrequency)
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      success: true,
      data: {
        totalEntries,
        analyzedEntries: analyzedCount,
        pendingEntries: pendingCount,
        failedEntries: failedCount,
        distribution,
        averageSentimentScore,
        averageSelfReportedMood,
        topEmotions
      },
      disclaimer: this.disclaimer
    };
  }

  /**
   * Retrieve longitudinal trends and weekly aggregates for an authenticated user
   * @param {string|ObjectId} userId
   * @param {object} options - { period: '7d'|'30d'|'90d'|'12w' }
   * @returns {Promise<object>}
   */
  async getTrends(userId, options = {}) {
    const period = options.period || '30d';

    let daysToFetch = 30;
    if (period === '7d') daysToFetch = 7;
    else if (period === '14d') daysToFetch = 14;
    else if (period === '60d') daysToFetch = 60;
    else if (period === '90d') daysToFetch = 90;
    else if (period === '12w') daysToFetch = 84;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToFetch);
    cutoffDate.setHours(0, 0, 0, 0);

    const entries = await Journal.find({
      userId,
      isArchived: false,
      createdAt: { $gte: cutoffDate }
    })
      .sort({ createdAt: 1 })
      .lean();

    // 1. Daily timeline aggregation
    const dailyMap = {};
    for (let i = 0; i <= daysToFetch; i++) {
      const d = new Date(cutoffDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = {
        date: key,
        count: 0,
        scoreSum: 0,
        scoreCount: 0,
        moodSum: 0,
        moodCount: 0,
        emotions: []
      };
    }

    const overallEmotionCounts = {};

    for (const entry of entries) {
      const dateKey = new Date(entry.createdAt).toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          count: 0,
          scoreSum: 0,
          scoreCount: 0,
          moodSum: 0,
          moodCount: 0,
          emotions: []
        };
      }

      const point = dailyMap[dateKey];
      point.count++;

      if (entry.selfReportedMood) {
        point.moodSum += entry.selfReportedMood;
        point.moodCount++;
      }

      if (entry.sentiment && entry.sentiment.status === 'completed' && typeof entry.sentiment.score === 'number') {
        point.scoreSum += entry.sentiment.score;
        point.scoreCount++;
      }

      if (entry.sentiment && Array.isArray(entry.sentiment.detectedEmotions)) {
        for (const emo of entry.sentiment.detectedEmotions) {
          point.emotions.push(emo);
          overallEmotionCounts[emo] = (overallEmotionCounts[emo] || 0) + 1;
        }
      }
    }

    const dailyTimeline = Object.values(dailyMap).map(d => ({
      date: d.date,
      entryCount: d.count,
      averageScore: d.scoreCount > 0 ? Math.round((d.scoreSum / d.scoreCount) * 1000) / 1000 : null,
      averageMood: d.moodCount > 0 ? Math.round((d.moodSum / d.moodCount) * 10) / 10 : null,
      emotions: Array.from(new Set(d.emotions))
    }));

    // 2. Weekly trends aggregation (chunks of 7 days)
    const weeklyTrends = [];
    const totalWeeks = Math.ceil(daysToFetch / 7);

    for (let w = 0; w < totalWeeks; w++) {
      const weekStart = new Date(cutoffDate);
      weekStart.setDate(weekStart.getDate() + w * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekEntries = entries.filter(e => {
        const cTime = new Date(e.createdAt);
        return cTime >= weekStart && cTime <= weekEnd;
      });

      let wScoreSum = 0;
      let wScoreCount = 0;
      let wMoodSum = 0;
      let wMoodCount = 0;
      const wDistribution = { positive: 0, neutral: 0, negative: 0 };
      const wEmotions = {};

      for (const e of weekEntries) {
        if (e.selfReportedMood) {
          wMoodSum += e.selfReportedMood;
          wMoodCount++;
        }

        if (e.sentiment && e.sentiment.status === 'completed' && e.sentiment.label) {
          if (wDistribution[e.sentiment.label] !== undefined) {
            wDistribution[e.sentiment.label]++;
          }
          if (typeof e.sentiment.score === 'number') {
            wScoreSum += e.sentiment.score;
            wScoreCount++;
          }
          if (Array.isArray(e.sentiment.detectedEmotions)) {
            for (const emo of e.sentiment.detectedEmotions) {
              wEmotions[emo] = (wEmotions[emo] || 0) + 1;
            }
          }
        }
      }

      let dominantSentiment = 'none';
      if (wDistribution.positive > wDistribution.negative && wDistribution.positive >= wDistribution.neutral) {
        dominantSentiment = 'positive';
      } else if (wDistribution.negative > wDistribution.positive && wDistribution.negative >= wDistribution.neutral) {
        dominantSentiment = 'negative';
      } else if (wDistribution.neutral > 0) {
        dominantSentiment = 'neutral';
      }

      const topWeekEmotions = Object.entries(wEmotions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emo]) => emo);

      weeklyTrends.push({
        weekIndex: w + 1,
        startDate: weekStart.toISOString().slice(0, 10),
        endDate: weekEnd.toISOString().slice(0, 10),
        entryCount: weekEntries.length,
        averageSentimentScore: wScoreCount > 0 ? Math.round((wScoreSum / wScoreCount) * 1000) / 1000 : null,
        averageMood: wMoodCount > 0 ? Math.round((wMoodSum / wMoodCount) * 10) / 10 : null,
        distribution: wDistribution,
        dominantSentiment,
        prominentEmotions: topWeekEmotions
      });
    }

    return {
      success: true,
      data: {
        period,
        days: daysToFetch,
        totalEntriesPeriod: entries.length,
        weeklyTrends,
        dailyTimeline,
        overallEmotionBreakdown: overallEmotionCounts
      },
      disclaimer: this.disclaimer
    };
  }
}

const sentimentService = new SentimentService();
module.exports = sentimentService;
