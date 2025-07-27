const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const Bull = require('bull');
const createLogger = require('../../../common/utils/logger');
const Episode = require('../models/Episode');
const Transcript = require('../models/Transcript');

// Initialize logger
const logger = createLogger('audio-processor');

// Create Redis connection options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Create queues for audio processing
const downloadQueue = new Bull('audio-download', { redis: redisOptions });
const transcriptionQueue = new Bull('audio-transcription', { redis: redisOptions });

// Audio storage directory
const AUDIO_STORAGE_DIR = process.env.AUDIO_STORAGE_DIR || './storage/audio';

/**
 * Initialize audio processing system
 */
function initialize() {
  // Ensure storage directory exists
  if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
    fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true });
  }

  // Process download queue
  downloadQueue.process(async (job) => {
    logger.info(`Processing audio download for episode: ${job.data.episodeId}`);
    return processAudioDownload(job.data.episodeId);
  });

  // Process transcription queue
  transcriptionQueue.process(async (job) => {
    logger.info(`Processing audio transcription for episode: ${job.data.episodeId}`);
    return processAudioTranscription(job.data.episodeId);
  });

  // Set up error handlers for all queues
  [downloadQueue, transcriptionQueue].forEach(queue => {
    queue.on('error', (error) => {
      logger.error(`Queue error: ${error.message}`, { error });
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed: ${error.message}`, { 
        jobId: job.id, 
        episodeId: job.data.episodeId,
        error 
      });
    });

    queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed`, { 
        jobId: job.id, 
        episodeId: job.data.episodeId,
        success: result.success 
      });
    });
  });

  logger.info('Audio processing system initialized');
}

/**
 * Process audio download for an episode
 * @param {string} episodeId - Episode ID
 * @returns {Promise<Object>} - Processing result
 */
async function processAudioDownload(episodeId) {
  try {
    // Get episode from database
    const episode = await Episode.findById(episodeId);
    
    if (!episode) {
      logger.warn(`Episode not found: ${episodeId}`);
      return { success: false, error: 'Episode not found' };
    }

    // Update processing status
    await episode.updateProcessingStatus('downloading');

    // Download audio file
    const downloadResult = await downloadAudioFile(episode);
    
    if (!downloadResult.success) {
      await episode.updateProcessingStatus('failed', downloadResult.error);
      return downloadResult;
    }

    // Set download path
    await episode.setDownloadPath(downloadResult.filePath);

    // Process audio file (normalize, convert format if needed)
    const processResult = await processAudioFile(downloadResult.filePath);
    
    if (!processResult.success) {
      await episode.updateProcessingStatus('failed', processResult.error);
      return processResult;
    }

    // Mark audio as processed
    await episode.markAudioProcessed();
    
    // Queue for transcription
    await queueAudioTranscription(episodeId);

    return {
      success: true,
      episodeId,
      filePath: downloadResult.filePath,
      duration: processResult.duration,
      fileSize: processResult.fileSize
    };
  } catch (error) {
    logger.error(`Error processing audio download for episode ${episodeId}: ${error.message}`, { error });
    
    // Update episode status
    try {
      const episode = await Episode.findById(episodeId);
      if (episode) {
        await episode.updateProcessingStatus('failed', error.message);
      }
    } catch (updateError) {
      logger.error(`Failed to update episode status: ${updateError.message}`);
    }
    
    return { 
      success: false, 
      episodeId,
      error: error.message 
    };
  }
}

/**
 * Download audio file from URL
 * @param {Object} episode - Episode document
 * @returns {Promise<Object>} - Download result
 */
async function downloadAudioFile(episode) {
  try {
    logger.info(`Downloading audio file: ${episode.audioUrl}`);
    
    // Generate file path
    const fileName = `${episode._id}_${Date.now()}.mp3`;
    const filePath = path.join(AUDIO_STORAGE_DIR, fileName);
    
    // Download file
    const response = await axios({
      method: 'GET',
      url: episode.audioUrl,
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
      headers: {
        'User-Agent': 'AI-Information-Aggregator/1.0'
      }
    });
    
    // Create write stream
    const writer = fs.createWriteStream(filePath);
    
    // Pipe response to file
    response.data.pipe(writer);
    
    // Wait for download to complete
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    logger.info(`Audio file downloaded: ${filePath} (${stats.size} bytes)`);
    
    return {
      success: true,
      filePath,
      fileSize: stats.size
    };
  } catch (error) {
    logger.error(`Error downloading audio file: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process audio file (normalize, convert format)
 * @param {string} filePath - Path to audio file
 * @returns {Promise<Object>} - Processing result
 */
async function processAudioFile(filePath) {
  try {
    logger.info(`Processing audio file: ${filePath}`);
    
    // Get audio metadata
    const metadata = await getAudioMetadata(filePath);
    
    // Check if file needs processing
    const needsProcessing = shouldProcessAudio(metadata);
    
    if (!needsProcessing) {
      logger.info(`Audio file does not need processing: ${filePath}`);
      return {
        success: true,
        duration: metadata.duration,
        fileSize: fs.statSync(filePath).size,
        processed: false
      };
    }
    
    // Process audio file
    const processedFilePath = await normalizeAudio(filePath);
    
    // Get processed file stats
    const processedStats = fs.statSync(processedFilePath);
    const processedMetadata = await getAudioMetadata(processedFilePath);
    
    // Remove original file if different from processed
    if (processedFilePath !== filePath) {
      fs.unlinkSync(filePath);
    }
    
    logger.info(`Audio file processed: ${processedFilePath}`);
    
    return {
      success: true,
      duration: processedMetadata.duration,
      fileSize: processedStats.size,
      processed: true,
      filePath: processedFilePath
    };
  } catch (error) {
    logger.error(`Error processing audio file: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get audio metadata using ffmpeg
 * @param {string} filePath - Path to audio file
 * @returns {Promise<Object>} - Audio metadata
 */
function getAudioMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      
      resolve({
        duration: parseFloat(metadata.format.duration),
        bitrate: parseInt(metadata.format.bit_rate),
        format: metadata.format.format_name,
        codec: audioStream ? audioStream.codec_name : null,
        sampleRate: audioStream ? audioStream.sample_rate : null,
        channels: audioStream ? audioStream.channels : null
      });
    });
  });
}

/**
 * Check if audio file needs processing
 * @param {Object} metadata - Audio metadata
 * @returns {boolean} - Whether file needs processing
 */
function shouldProcessAudio(metadata) {
  // Check if format is supported for transcription
  const supportedFormats = ['mp3', 'wav', 'flac', 'm4a'];
  const formatSupported = supportedFormats.some(format => 
    metadata.format.toLowerCase().includes(format)
  );
  
  if (!formatSupported) {
    return true;
  }
  
  // Check if bitrate is too high (might need compression)
  if (metadata.bitrate > 128000) {
    return true;
  }
  
  // Check if sample rate is too high
  if (metadata.sampleRate > 44100) {
    return true;
  }
  
  return false;
}

/**
 * Normalize audio file for transcription
 * @param {string} filePath - Path to audio file
 * @returns {Promise<string>} - Path to normalized file
 */
function normalizeAudio(filePath) {
  return new Promise((resolve, reject) => {
    const outputPath = filePath.replace(/\.[^/.]+$/, '_normalized.wav');
    
    ffmpeg(filePath)
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .audioBitrate('64k')
      .format('wav')
      .on('end', () => {
        logger.info(`Audio normalized: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error(`Error normalizing audio: ${err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Process audio transcription for an episode
 * @param {string} episodeId - Episode ID
 * @returns {Promise<Object>} - Processing result
 */
async function processAudioTranscription(episodeId) {
  try {
    // Get episode from database
    const episode = await Episode.findById(episodeId);
    
    if (!episode) {
      logger.warn(`Episode not found: ${episodeId}`);
      return { success: false, error: 'Episode not found' };
    }

    if (!episode.downloadPath || !fs.existsSync(episode.downloadPath)) {
      logger.warn(`Audio file not found for episode: ${episodeId}`);
      return { success: false, error: 'Audio file not found' };
    }

    // Update processing status
    await episode.updateProcessingStatus('transcribing');

    // Transcribe audio
    const transcriptionResult = await transcribeAudio(episode.downloadPath);
    
    if (!transcriptionResult.success) {
      await episode.updateProcessingStatus('failed', transcriptionResult.error);
      return transcriptionResult;
    }

    // Create transcript document
    const transcript = new Transcript({
      episodeId: episode._id,
      fullText: transcriptionResult.fullText,
      segments: transcriptionResult.segments || [],
      language: transcriptionResult.language || 'en'
    });
    
    await transcript.save();

    // Update episode
    await episode.setTranscriptAvailable(true);
    await episode.updateProcessingStatus('analyzing');
    
    // Process transcript for references
    try {
      const referenceIdentifier = require('./referenceIdentifier');
      await referenceIdentifier.processTranscript(transcript);
      logger.info(`Processed references for transcript: ${transcript._id}`);
    } catch (refError) {
      logger.error(`Error processing references for transcript ${transcript._id}: ${refError.message}`, { error: refError });
      // Continue despite reference processing error
    }
    
    // Mark episode as completed
    await episode.updateProcessingStatus('completed');

    logger.info(`Transcription completed for episode: ${episodeId}`);

    return {
      success: true,
      episodeId,
      transcriptId: transcript._id,
      fullText: transcriptionResult.fullText,
      segments: transcriptionResult.segments,
      language: transcriptionResult.language
    };
  } catch (error) {
    logger.error(`Error processing audio transcription for episode ${episodeId}: ${error.message}`, { error });
    
    // Update episode status
    try {
      const episode = await Episode.findById(episodeId);
      if (episode) {
        await episode.updateProcessingStatus('failed', error.message);
      }
    } catch (updateError) {
      logger.error(`Failed to update episode status: ${updateError.message}`);
    }
    
    return { 
      success: false, 
      episodeId,
      error: error.message 
    };
  }
}

/**
 * Transcribe audio file to text
 * @param {string} filePath - Path to audio file
 * @returns {Promise<Object>} - Transcription result
 */
async function transcribeAudio(filePath) {
  try {
    logger.info(`Transcribing audio file: ${filePath}`);
    
    // For this implementation, we'll use a placeholder for the actual transcription service
    // In a real implementation, you would integrate with services like:
    // - OpenAI Whisper API
    // - Google Speech-to-Text
    // - AWS Transcribe
    // - Azure Speech Services
    
    // Placeholder implementation using a mock transcription
    const mockTranscription = await mockTranscribeAudio(filePath);
    
    return {
      success: true,
      fullText: mockTranscription.fullText,
      segments: mockTranscription.segments,
      language: mockTranscription.language
    };
  } catch (error) {
    logger.error(`Error transcribing audio: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Mock transcription function (replace with actual service)
 * @param {string} filePath - Path to audio file
 * @returns {Promise<Object>} - Mock transcription result
 */
async function mockTranscribeAudio(filePath) {
  // Get audio duration for realistic mock
  const metadata = await getAudioMetadata(filePath);
  const duration = metadata.duration;
  
  // Generate mock transcript based on duration
  const wordsPerMinute = 150;
  const totalWords = Math.floor((duration / 60) * wordsPerMinute);
  
  const mockWords = [
    'welcome', 'to', 'our', 'podcast', 'today', 'we', 'are', 'discussing',
    'important', 'topics', 'in', 'technology', 'and', 'innovation',
    'our', 'guest', 'is', 'an', 'expert', 'in', 'the', 'field',
    'they', 'will', 'share', 'insights', 'about', 'recent', 'developments',
    'and', 'future', 'trends', 'this', 'is', 'a', 'fascinating', 'conversation'
  ];
  
  // Generate full text
  const fullText = Array.from({ length: totalWords }, (_, i) => 
    mockWords[i % mockWords.length]
  ).join(' ');
  
  // Generate segments (every 30 seconds)
  const segmentDuration = 30;
  const segmentCount = Math.ceil(duration / segmentDuration);
  const wordsPerSegment = Math.floor(totalWords / segmentCount);
  
  const segments = Array.from({ length: segmentCount }, (_, i) => {
    const startTime = i * segmentDuration;
    const endTime = Math.min((i + 1) * segmentDuration, duration);
    const segmentWords = Array.from({ length: wordsPerSegment }, (_, j) => 
      mockWords[(i * wordsPerSegment + j) % mockWords.length]
    );
    
    return {
      text: segmentWords.join(' '),
      startTime,
      endTime,
      confidence: 0.85 + Math.random() * 0.1 // Random confidence between 0.85-0.95
    };
  });
  
  return {
    fullText,
    segments,
    language: 'en'
  };
}

/**
 * Queue audio download for an episode
 * @param {string} episodeId - Episode ID
 * @returns {Promise<Object>} - Queue result
 */
async function queueAudioDownload(episodeId) {
  try {
    const job = await downloadQueue.add(
      { episodeId },
      { 
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000
        }
      }
    );
    
    logger.info(`Queued audio download for episode ${episodeId}, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      episodeId
    };
  } catch (error) {
    logger.error(`Error queuing audio download for episode ${episodeId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      episodeId,
      error: error.message 
    };
  }
}

/**
 * Queue audio transcription for an episode
 * @param {string} episodeId - Episode ID
 * @returns {Promise<Object>} - Queue result
 */
async function queueAudioTranscription(episodeId) {
  try {
    const job = await transcriptionQueue.add(
      { episodeId },
      { 
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 15000
        }
      }
    );
    
    logger.info(`Queued audio transcription for episode ${episodeId}, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      episodeId
    };
  } catch (error) {
    logger.error(`Error queuing audio transcription for episode ${episodeId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      episodeId,
      error: error.message 
    };
  }
}

/**
 * Process pending episodes
 * @param {number} limit - Maximum number of episodes to process
 * @returns {Promise<Object>} - Processing result
 */
async function processPendingEpisodes(limit = 10) {
  try {
    // Find pending episodes
    const pendingEpisodes = await Episode.findPendingProcessing(limit);
    
    logger.info(`Found ${pendingEpisodes.length} pending episodes`);
    
    // Queue each episode for download
    const results = [];
    for (const episode of pendingEpisodes) {
      const result = await queueAudioDownload(episode._id);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      total: pendingEpisodes.length,
      queued: successCount,
      failed: pendingEpisodes.length - successCount
    };
  } catch (error) {
    logger.error(`Error processing pending episodes: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} - Queue statistics
 */
async function getQueueStats() {
  try {
    const [downloadStats, transcriptionStats] = await Promise.all([
      getQueueStatistics(downloadQueue),
      getQueueStatistics(transcriptionQueue)
    ]);
    
    return {
      success: true,
      stats: {
        download: downloadStats,
        transcription: transcriptionStats,
        total: {
          waiting: downloadStats.waiting + transcriptionStats.waiting,
          active: downloadStats.active + transcriptionStats.active,
          completed: downloadStats.completed + transcriptionStats.completed,
          failed: downloadStats.failed + transcriptionStats.failed,
          delayed: downloadStats.delayed + transcriptionStats.delayed
        }
      }
    };
  } catch (error) {
    logger.error(`Error getting queue stats: ${error.message}`, { error });
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Get statistics for a specific queue
 * @param {Bull.Queue} queue - Bull queue
 * @returns {Promise<Object>} - Queue statistics
 */
async function getQueueStatistics(queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed
  };
}

/**
 * Clean up completed and failed jobs
 * @returns {Promise<Object>} - Result of cleanup
 */
async function cleanupJobs() {
  try {
    await Promise.all([
      downloadQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      transcriptionQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      downloadQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
      transcriptionQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed') // 7 days
    ]);
    
    logger.info('Cleaned up completed and failed jobs');
    
    return {
      success: true,
      message: 'Cleaned up completed and failed jobs'
    };
  } catch (error) {
    logger.error(`Error cleaning up jobs: ${error.message}`, { error });
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Shutdown all queues gracefully
 * @returns {Promise<void>}
 */
async function shutdown() {
  logger.info('Shutting down audio processing queues');
  
  await Promise.all([
    downloadQueue.close(),
    transcriptionQueue.close()
  ]);
  
  logger.info('All audio processing queues shut down');
}

module.exports = {
  initialize,
  queueAudioDownload,
  queueAudioTranscription,
  processPendingEpisodes,
  getQueueStats,
  cleanupJobs,
  shutdown,
  processAudioDownload,
  processAudioTranscription
};