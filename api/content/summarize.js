import { connectToDatabase } from '../../lib/database.js';
import { authenticate } from '../../lib/auth.js';

// AI and NLP utilities
import natural from 'natural';
import compromise from 'compromise';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

export default async function handler(req, res) {
  try {
    // Authentication
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    // Database connection
    const db = await connectToDatabase();

    if (req.method === 'POST') {
      const { text, contentId, options = {} } = req.body;

      // Validate input
      if (!text && !contentId) {
        return res.status(400).json({
          success: false,
          error: 'Either text or contentId is required'
        });
      }

      let textToSummarize = text;
      let content = null;

      // If contentId provided, fetch content from database
      if (contentId) {
        const [contents] = await db.execute(
          `SELECT c.*, s.created_by 
           FROM content c 
           JOIN sources s ON c.source_id = s.id 
           WHERE c.id = ? AND s.created_by = ?`,
          [contentId, user.id]
        );

        if (contents.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Content not found'
          });
        }

        content = contents[0];
        textToSummarize = content.full_text || content.summary;

        if (!textToSummarize) {
          return res.status(400).json({
            success: false,
            error: 'Content has no text to summarize'
          });
        }
      }

      // Summarize the text
      const result = await summarizeText(textToSummarize, options);

      // If contentId provided, update the content with summary
      if (contentId && result.summary) {
        await db.execute(
          'UPDATE content SET summary = ?, processed = TRUE WHERE id = ?',
          [result.summary, contentId]
        );
      }

      return res.json({
        success: true,
        data: result
      });
    }

    if (req.method === 'GET') {
      // Get summarization configuration
      const config = {
        lengthOptions: ['brief', 'short', 'medium', 'long', 'detailed'],
        detailOptions: ['brief', 'balanced', 'detailed'],
        defaultOptions: {
          length: 'medium',
          detail: 'balanced',
          temperature: 0.3
        },
        limits: {
          maxTextLength: 50000, // characters
          maxBatchSize: 50,
          maxTokens: {
            brief: 100,
            short: 150,
            medium: 250,
            long: 400,
            detailed: 600
          }
        },
        aiAvailable: !!process.env.OPENAI_API_KEY
      };

      return res.json({
        success: true,
        data: config
      });
    }

    res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('Content summarization error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

/**
 * Summarize text using AI-based approach with extractive fallback
 */
async function summarizeText(text, options = {}) {
  try {
    const {
      length = 'medium',
      detail = 'balanced',
      maxTokens = getMaxTokens(length),
      temperature = 0.3
    } = options;

    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input');
    }

    // Clean and preprocess text
    const cleanedText = preprocessText(text);
    
    // Check if text is too short to summarize
    if (getWordCount(cleanedText) < 50) {
      return {
        summary: cleanedText,
        originalLength: getWordCount(text),
        summaryLength: getWordCount(cleanedText),
        compressionRatio: 1.0,
        method: 'no_summarization_needed'
      };
    }

    // Use AI-based summarization for better quality
    const aiSummary = await aiSummarize(cleanedText, {
      maxTokens,
      temperature,
      detail
    });

    // Fallback to extractive summarization if AI fails
    const fallbackSummary = extractiveSummarize(cleanedText, options);

    const finalSummary = aiSummary || fallbackSummary;
    
    return {
      summary: finalSummary,
      originalLength: getWordCount(text),
      summaryLength: getWordCount(finalSummary),
      compressionRatio: getWordCount(finalSummary) / getWordCount(text),
      method: aiSummary ? 'ai_based' : 'extractive',
      confidence: aiSummary ? 0.9 : 0.7
    };

  } catch (error) {
    console.error('Error in text summarization:', error);
    throw new Error(`Summarization failed: ${error.message}`);
  }
}

/**
 * AI-based summarization using OpenAI
 */
async function aiSummarize(text, options) {
  try {
    if (!openai) {
      console.warn('OpenAI API key not configured, falling back to extractive summarization');
      return null;
    }

    const prompt = buildSummarizationPrompt(text, options);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating concise, accurate summaries of technical content, particularly in AI/ML and technology domains.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    return response.choices[0]?.message?.content?.trim();
  } catch (error) {
    console.error('AI summarization failed:', error);
    return null;
  }
}

/**
 * Build summarization prompt based on detail level
 */
function buildSummarizationPrompt(text, options) {
  const detailInstructions = {
    brief: 'Create a very concise summary focusing only on the main point.',
    balanced: 'Create a balanced summary that captures key points and important details.',
    detailed: 'Create a comprehensive summary that includes main points, key details, and important context.'
  };

  return `Please summarize the following text. ${detailInstructions[options.detail] || detailInstructions.balanced}

Text to summarize:
${text}

Summary:`;
}

/**
 * Extractive summarization as fallback
 */
function extractiveSummarize(text, options) {
  try {
    const sentences = extractSentences(text);
    const scoredSentences = scoreSentences(sentences, text);
    const topSentences = selectTopSentences(scoredSentences, options);
    
    return topSentences
      .sort((a, b) => a.position - b.position)
      .map(s => s.text)
      .join(' ');
  } catch (error) {
    console.error('Extractive summarization failed:', error);
    // Return first few sentences as last resort
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3).join('. ') + '.';
  }
}

/**
 * Extract sentences from text
 */
function extractSentences(text) {
  const doc = compromise(text);
  const sentences = doc.sentences().out('array');
  
  return sentences
    .filter(sentence => sentence.length > 20) // Filter out very short sentences
    .map((sentence, index) => ({
      text: sentence.trim(),
      position: index,
      length: sentence.length
    }));
}

/**
 * Score sentences based on various factors
 */
function scoreSentences(sentences, fullText) {
  const tokens = tokenizer.tokenize(fullText.toLowerCase());
  const wordFreq = calculateWordFrequency(tokens);
  
  return sentences.map(sentence => {
    const sentenceTokens = tokenizer.tokenize(sentence.text.toLowerCase());
    let score = 0;
    
    // Score based on word frequency
    sentenceTokens.forEach(token => {
      if (wordFreq[token]) {
        score += wordFreq[token];
      }
    });
    
    // Normalize by sentence length
    score = score / sentenceTokens.length;
    
    // Boost sentences with numbers (often contain important facts)
    if (/\d+/.test(sentence.text)) {
      score *= 1.2;
    }
    
    // Boost sentences with key phrases
    const keyPhrases = ['important', 'significant', 'key', 'main', 'primary', 'conclusion', 'result'];
    keyPhrases.forEach(phrase => {
      if (sentence.text.toLowerCase().includes(phrase)) {
        score *= 1.1;
      }
    });
    
    return {
      ...sentence,
      score
    };
  });
}

/**
 * Select top sentences for summary
 */
function selectTopSentences(scoredSentences, options) {
  const targetLength = getTargetSentenceCount(options.length);
  
  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, targetLength);
}

/**
 * Calculate word frequency
 */
function calculateWordFrequency(tokens) {
  const freq = {};
  const stopWords = new Set(natural.stopwords);
  
  tokens.forEach(token => {
    if (!stopWords.has(token) && token.length > 2) {
      const stemmed = stemmer.stem(token);
      freq[stemmed] = (freq[stemmed] || 0) + 1;
    }
  });
  
  return freq;
}

/**
 * Preprocess text for summarization
 */
function preprocessText(text) {
  return text
    .replace(/[^\w\s.,!?;:()-]/g, '') // Remove special characters first
    .replace(/\s+/g, ' ') // Then normalize whitespace
    .trim();
}

/**
 * Get word count
 */
function getWordCount(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get max tokens based on length setting
 */
function getMaxTokens(length) {
  const tokenLimits = {
    brief: 100,
    short: 150,
    medium: 250,
    long: 400,
    detailed: 600
  };
  
  return tokenLimits[length] || tokenLimits.medium;
}

/**
 * Get target sentence count for extractive summarization
 */
function getTargetSentenceCount(length) {
  const sentenceCounts = {
    brief: 2,
    short: 3,
    medium: 5,
    long: 8,
    detailed: 12
  };
  
  return sentenceCounts[length] || sentenceCounts.medium;
}