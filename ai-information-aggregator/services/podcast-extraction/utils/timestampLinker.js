/**
 * Timestamp Linker Utility
 * 
 * Responsible for linking references to specific timestamps in podcast episodes
 * and providing playback functionality from reference points.
 */

const mongoose = require('mongoose');
const logger = require('../../../common/utils/logger');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');
const Transcript = require('../models/Transcript');

class TimestampLinker {
  /**
   * Link a reference to a specific timestamp in a podcast episode
   * @param {Object} reference - The reference object
   * @param {string} episodeId - The episode ID
   * @param {string} timestamp - The timestamp in format "HH:MM:SS" or seconds
   * @param {string} context - The surrounding text context
   * @returns {Promise<Object>} - The updated reference with timestamp link
   */
  async linkReferenceToTimestamp(reference, episodeId, timestamp, context = '') {
    try {
      logger.info(`Linking reference ${reference._id} to timestamp ${timestamp} in episode ${episodeId}`);
      
      // Validate episode exists
      const episode = await Episode.findById(episodeId);
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found`);
      }
      
      // Normalize timestamp to seconds
      const timestampSeconds = this._normalizeTimestamp(timestamp);
      
      // Validate timestamp is within episode duration
      if (episode.duration && timestampSeconds > episode.duration) {
        logger.warn(`Timestamp ${timestamp} exceeds episode duration ${episode.duration}`);
      }
      
      // Update reference with timestamp information
      const updatedReference = await Reference.findByIdAndUpdate(
        reference._id,
        {
          $set: {
            'contextLocation.value': timestamp,
            'contextLocation.type': 'timestamp',
            context: context || reference.context,
            metadata: {
              ...reference.metadata,
              episodeId: episodeId,
              timestampSeconds: timestampSeconds,
              linkedAt: new Date()
            }
          }
        },
        { new: true }
      );
      
      logger.info(`Successfully linked reference ${reference._id} to timestamp ${timestamp}`);
      
      return {
        success: true,
        reference: updatedReference,
        playbackUrl: this._generatePlaybackUrl(episode, timestampSeconds)
      };
    } catch (error) {
      logger.error(`Error linking reference to timestamp: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Extract timestamp information from transcript text
   * @param {string} transcriptText - The full transcript text
   * @param {string} referenceContext - The context where the reference was found
   * @returns {Promise<Object>} - Timestamp information
   */
  async extractTimestampFromContext(transcriptText, referenceContext) {
    try {
      // Look for timestamp patterns in the transcript
      const timestampPatterns = [
        /(\d{1,2}:\d{2}:\d{2})/g, // HH:MM:SS format
        /(\d{1,2}:\d{2})/g,       // MM:SS format
        /\[(\d+:\d+:\d+)\]/g,     // [HH:MM:SS] format
        /\((\d+:\d+)\)/g          // (MM:SS) format
      ];
      
      // Find the position of the reference context in the transcript
      const contextIndex = transcriptText.toLowerCase().indexOf(referenceContext.toLowerCase());
      
      if (contextIndex === -1) {
        logger.warn('Reference context not found in transcript');
        return { found: false };
      }
      
      // Search for timestamps near the context (within 500 characters before)
      const searchStart = Math.max(0, contextIndex - 500);
      const searchEnd = Math.min(transcriptText.length, contextIndex + referenceContext.length + 100);
      const searchText = transcriptText.substring(searchStart, searchEnd);
      
      // Try each timestamp pattern
      for (const pattern of timestampPatterns) {
        const matches = [...searchText.matchAll(pattern)];
        
        if (matches.length > 0) {
          // Get the closest timestamp to the reference context
          const closestMatch = matches.reduce((closest, match) => {
            const matchIndex = searchStart + match.index;
            const distanceToContext = Math.abs(matchIndex - contextIndex);
            
            if (!closest || distanceToContext < closest.distance) {
              return {
                timestamp: match[1],
                distance: distanceToContext,
                index: matchIndex
              };
            }
            
            return closest;
          }, null);
          
          if (closestMatch) {
            return {
              found: true,
              timestamp: closestMatch.timestamp,
              confidence: this._calculateTimestampConfidence(closestMatch.distance)
            };
          }
        }
      }
      
      // If no explicit timestamp found, try to estimate based on position in transcript
      const estimatedTimestamp = this._estimateTimestampFromPosition(
        transcriptText,
        contextIndex,
        await this._getEpisodeDuration(transcriptText)
      );
      
      return {
        found: true,
        timestamp: estimatedTimestamp,
        confidence: 0.3, // Low confidence for estimated timestamps
        estimated: true
      };
    } catch (error) {
      logger.error(`Error extracting timestamp from context: ${error.message}`, { error });
      return { found: false, error: error.message };
    }
  }
  
  /**
   * Generate a playback URL for a specific timestamp in an episode
   * @param {Object} episode - The episode object
   * @param {number} timestampSeconds - The timestamp in seconds
   * @returns {string} - The playback URL with timestamp
   */
  _generatePlaybackUrl(episode, timestampSeconds) {
    if (!episode.audioUrl) {
      return null;
    }
    
    // For most audio players, we can append a time parameter
    const separator = episode.audioUrl.includes('?') ? '&' : '?';
    return `${episode.audioUrl}${separator}t=${timestampSeconds}`;
  }
  
  /**
   * Normalize timestamp to seconds
   * @param {string|number} timestamp - Timestamp in various formats
   * @returns {number} - Timestamp in seconds
   */
  _normalizeTimestamp(timestamp) {
    if (typeof timestamp === 'number') {
      return timestamp;
    }
    
    if (typeof timestamp === 'string') {
      // Handle HH:MM:SS format
      if (timestamp.includes(':')) {
        const parts = timestamp.split(':').map(Number);
        
        if (parts.length === 3) {
          // HH:MM:SS
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          // MM:SS
          return parts[0] * 60 + parts[1];
        }
      }
      
      // Try to parse as number
      const parsed = parseFloat(timestamp);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
  
  /**
   * Calculate confidence score for timestamp extraction
   * @param {number} distance - Distance between timestamp and reference context
   * @returns {number} - Confidence score between 0 and 1
   */
  _calculateTimestampConfidence(distance) {
    // Closer timestamps have higher confidence
    if (distance <= 50) return 0.9;
    if (distance <= 100) return 0.8;
    if (distance <= 200) return 0.7;
    if (distance <= 300) return 0.6;
    if (distance <= 500) return 0.5;
    return 0.3;
  }
  
  /**
   * Estimate timestamp based on position in transcript
   * @param {string} transcriptText - The full transcript
   * @param {number} contextIndex - Position of reference in transcript
   * @param {number} episodeDuration - Episode duration in seconds
   * @returns {string} - Estimated timestamp
   */
  _estimateTimestampFromPosition(transcriptText, contextIndex, episodeDuration) {
    const textLength = transcriptText.length;
    const relativePosition = contextIndex / textLength;
    const estimatedSeconds = Math.floor(relativePosition * episodeDuration);
    
    return this._formatTimestamp(estimatedSeconds);
  }
  
  /**
   * Get episode duration from various sources
   * @param {string} transcriptText - The transcript text (fallback for estimation)
   * @returns {Promise<number>} - Episode duration in seconds
   */
  async _getEpisodeDuration(transcriptText) {
    // Default estimation: assume average speaking rate of 150 words per minute
    const words = transcriptText.split(/\s+/).length;
    const estimatedMinutes = words / 150;
    return Math.floor(estimatedMinutes * 60);
  }
  
  /**
   * Format seconds as HH:MM:SS timestamp
   * @param {number} seconds - Seconds to format
   * @returns {string} - Formatted timestamp
   */
  _formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Batch link references to timestamps for an episode
   * @param {string} episodeId - The episode ID
   * @param {Array} references - Array of references to link
   * @returns {Promise<Object>} - Batch linking results
   */
  async batchLinkReferences(episodeId, references) {
    try {
      logger.info(`Batch linking ${references.length} references for episode ${episodeId}`);
      
      const episode = await Episode.findById(episodeId);
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found`);
      }
      
      // Get the transcript for timestamp extraction
      const transcript = await Transcript.findOne({ episodeId });
      if (!transcript) {
        logger.warn(`No transcript found for episode ${episodeId}, cannot extract timestamps`);
        return {
          success: false,
          error: 'No transcript available for timestamp extraction'
        };
      }
      
      const results = {
        linked: 0,
        estimated: 0,
        failed: 0,
        total: references.length,
        details: []
      };
      
      // Process each reference
      for (const reference of references) {
        try {
          // Extract timestamp from transcript context
          const timestampInfo = await this.extractTimestampFromContext(
            transcript.content,
            reference.context || reference.title
          );
          
          if (timestampInfo.found) {
            // Link the reference to the timestamp
            const linkResult = await this.linkReferenceToTimestamp(
              reference,
              episodeId,
              timestampInfo.timestamp,
              reference.context
            );
            
            if (linkResult.success) {
              if (timestampInfo.estimated) {
                results.estimated++;
              } else {
                results.linked++;
              }
              
              results.details.push({
                referenceId: reference._id,
                timestamp: timestampInfo.timestamp,
                confidence: timestampInfo.confidence,
                estimated: timestampInfo.estimated || false,
                playbackUrl: linkResult.playbackUrl
              });
            } else {
              results.failed++;
              results.details.push({
                referenceId: reference._id,
                error: 'Failed to link reference'
              });
            }
          } else {
            results.failed++;
            results.details.push({
              referenceId: reference._id,
              error: timestampInfo.error || 'Could not extract timestamp'
            });
          }
        } catch (error) {
          logger.error(`Error processing reference ${reference._id}: ${error.message}`);
          results.failed++;
          results.details.push({
            referenceId: reference._id,
            error: error.message
          });
        }
      }
      
      logger.info(`Batch linking completed: ${results.linked} linked, ${results.estimated} estimated, ${results.failed} failed`);
      
      return {
        success: true,
        results
      };
    } catch (error) {
      logger.error(`Error in batch linking references: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get references with timestamps for an episode
   * @param {string} episodeId - The episode ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - References with timestamp information
   */
  async getTimestampedReferences(episodeId, options = {}) {
    try {
      const { sortBy = 'timestamp', order = 'asc', limit = 100 } = options;
      
      const references = await Reference.find({
        'metadata.episodeId': episodeId,
        'contextLocation.type': 'timestamp'
      })
      .sort({ 'metadata.timestampSeconds': order === 'asc' ? 1 : -1 })
      .limit(limit)
      .populate('sourceContentId');
      
      // Enrich with playback URLs
      const episode = await Episode.findById(episodeId);
      
      return references.map(ref => ({
        ...ref.toObject(),
        playbackUrl: this._generatePlaybackUrl(episode, ref.metadata.timestampSeconds),
        formattedTimestamp: this._formatTimestamp(ref.metadata.timestampSeconds)
      }));
    } catch (error) {
      logger.error(`Error getting timestamped references: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Create a timeline of references for an episode
   * @param {string} episodeId - The episode ID
   * @returns {Promise<Object>} - Timeline data
   */
  async createReferenceTimeline(episodeId) {
    try {
      const references = await this.getTimestampedReferences(episodeId, { sortBy: 'timestamp', order: 'asc' });
      const episode = await Episode.findById(episodeId);
      
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found`);
      }
      
      // Group references by time segments (e.g., every 5 minutes)
      const segmentDuration = 300; // 5 minutes in seconds
      const segments = {};
      
      references.forEach(ref => {
        const segmentStart = Math.floor(ref.metadata.timestampSeconds / segmentDuration) * segmentDuration;
        const segmentKey = this._formatTimestamp(segmentStart);
        
        if (!segments[segmentKey]) {
          segments[segmentKey] = {
            startTime: segmentStart,
            endTime: segmentStart + segmentDuration,
            formattedStart: segmentKey,
            formattedEnd: this._formatTimestamp(segmentStart + segmentDuration),
            references: []
          };
        }
        
        segments[segmentKey].references.push({
          id: ref._id,
          title: ref.title,
          timestamp: ref.contextLocation.value,
          timestampSeconds: ref.metadata.timestampSeconds,
          formattedTimestamp: ref.formattedTimestamp,
          playbackUrl: ref.playbackUrl,
          referenceType: ref.referenceType,
          context: ref.context
        });
      });
      
      return {
        episodeId,
        episodeTitle: episode.title,
        episodeDuration: episode.duration,
        totalReferences: references.length,
        segments: Object.values(segments).sort((a, b) => a.startTime - b.startTime)
      };
    } catch (error) {
      logger.error(`Error creating reference timeline: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new TimestampLinker();