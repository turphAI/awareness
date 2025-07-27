/**
 * Podcast Reference Processor
 * 
 * Integrates reference identification, source location, and timestamp linking
 * for comprehensive podcast reference processing.
 */

const logger = require('../../../common/utils/logger');
const referenceIdentifier = require('./referenceIdentifier');
const sourceLocator = require('./sourceLocator');
const timestampLinker = require('./timestampLinker');
const showNotesAnalyzer = require('./showNotesAnalyzer');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');
const Transcript = require('../models/Transcript');

class PodcastReferenceProcessor {
  /**
   * Process a complete podcast episode for references
   * @param {string} episodeId - The episode ID to process
   * @returns {Promise<Object>} - Processing results
   */
  async processEpisodeReferences(episodeId) {
    try {
      logger.info(`Starting comprehensive reference processing for episode ${episodeId}`);
      
      const episode = await Episode.findById(episodeId);
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found`);
      }
      
      const transcript = await Transcript.findOne({ episodeId });
      if (!transcript) {
        throw new Error(`No transcript found for episode ${episodeId}`);
      }
      
      const results = {
        episodeId,
        episodeTitle: episode.title,
        steps: {
          referenceExtraction: null,
          timestampLinking: null,
          sourceLocation: null,
          showNotesAnalysis: null
        },
        summary: {
          totalReferences: 0,
          timestampedReferences: 0,
          resolvedReferences: 0,
          manualResolutionNeeded: 0
        }
      };
      
      // Step 1: Extract references from transcript
      logger.info('Step 1: Extracting references from transcript');
      const extractedReferences = await referenceIdentifier.identifyReferences(transcript.content);
      
      // Save references to database
      const savedReferences = [];
      for (const ref of extractedReferences) {
        const reference = new Reference({
          sourceContentId: episodeId,
          referenceType: ref.type,
          title: ref.title,
          url: ref.url,
          authors: ref.authors,
          publishDate: ref.publishDate,
          context: ref.context,
          timestamp: ref.timestamp,
          resolved: false
        });
        
        await reference.save();
        savedReferences.push(reference);
      }
      
      results.steps.referenceExtraction = {
        success: true,
        referencesFound: savedReferences.length,
        references: savedReferences.map(ref => ({
          id: ref._id,
          title: ref.title,
          type: ref.referenceType,
          context: ref.context
        }))
      };
      
      results.summary.totalReferences = savedReferences.length;
      
      // Step 2: Link references to timestamps
      if (savedReferences.length > 0) {
        logger.info('Step 2: Linking references to timestamps');
        try {
          const timestampResult = await timestampLinker.batchLinkReferences(episodeId, savedReferences);
          
          results.steps.timestampLinking = {
            success: timestampResult.success,
            linked: timestampResult.results?.linked || 0,
            estimated: timestampResult.results?.estimated || 0,
            failed: timestampResult.results?.failed || 0,
            details: timestampResult.results?.details || []
          };
          
          results.summary.timestampedReferences = 
            (timestampResult.results?.linked || 0) + (timestampResult.results?.estimated || 0);
        } catch (error) {
          logger.error(`Timestamp linking failed: ${error.message}`);
          results.steps.timestampLinking = {
            success: false,
            error: error.message
          };
        }
      } else {
        results.steps.timestampLinking = {
          success: true,
          message: 'No references to link'
        };
      }
      
      // Step 3: Locate sources for references
      if (savedReferences.length > 0) {
        logger.info('Step 3: Locating sources for references');
        const sourceResults = {
          resolved: 0,
          manualResolution: 0,
          failed: 0,
          details: []
        };
        
        for (const reference of savedReferences) {
          try {
            const locationResult = await sourceLocator.locateSource(reference);
            
            if (locationResult.found) {
              // Update reference as resolved
              reference.resolved = true;
              if (locationResult.sourceType === 'existing') {
                reference.targetContentId = locationResult.source._id;
              } else {
                reference.url = locationResult.source.url || reference.url;
              }
              await reference.save();
              
              sourceResults.resolved++;
              sourceResults.details.push({
                referenceId: reference._id,
                status: 'resolved',
                sourceType: locationResult.sourceType,
                confidence: locationResult.confidence
              });
            } else {
              // Mark for manual resolution
              reference.needsManualResolution = true;
              reference.resolutionAttempts = (reference.resolutionAttempts || 0) + 1;
              await reference.save();
              
              sourceResults.manualResolution++;
              sourceResults.details.push({
                referenceId: reference._id,
                status: 'manual_resolution_needed',
                message: locationResult.message
              });
            }
          } catch (error) {
            logger.error(`Source location failed for reference ${reference._id}: ${error.message}`);
            sourceResults.failed++;
            sourceResults.details.push({
              referenceId: reference._id,
              status: 'failed',
              error: error.message
            });
          }
        }
        
        results.steps.sourceLocation = {
          success: true,
          ...sourceResults
        };
        
        results.summary.resolvedReferences = sourceResults.resolved;
        results.summary.manualResolutionNeeded = sourceResults.manualResolution;
      } else {
        results.steps.sourceLocation = {
          success: true,
          message: 'No references to locate sources for'
        };
      }
      
      // Step 4: Analyze show notes if available
      logger.info('Step 4: Analyzing show notes');
      try {
        const showNotesResult = await showNotesAnalyzer.analyzeEpisodeShowNotes(episodeId);
        
        if (showNotesResult.success) {
          results.steps.showNotesAnalysis = {
            success: true,
            hasShowNotes: showNotesResult.hasShowNotes,
            extractedReferences: showNotesResult.extractedReferences?.length || 0,
            matchedReferences: showNotesResult.crossReference?.summary?.matchedReferences || 0,
            newReferences: showNotesResult.savedNewReferences?.length || 0,
            updatedReferences: showNotesResult.updatedReferences?.length || 0
          };
          
          // Update summary with show notes data
          results.summary.totalReferences += showNotesResult.savedNewReferences?.length || 0;
        } else {
          results.steps.showNotesAnalysis = {
            success: false,
            hasShowNotes: showNotesResult.hasShowNotes,
            message: showNotesResult.message
          };
        }
      } catch (error) {
        logger.error(`Show notes analysis failed: ${error.message}`);
        results.steps.showNotesAnalysis = {
          success: false,
          error: error.message
        };
      }
      
      // Update episode with processing results
      await Episode.findByIdAndUpdate(episodeId, {
        $set: {
          referencesExtracted: true,
          referenceCount: results.summary.totalReferences,
          referencesResolved: results.summary.resolvedReferences,
          referencesNeedingManualResolution: results.summary.manualResolutionNeeded
        }
      });
      
      // Mark transcript as processed
      transcript.processed = true;
      transcript.referenceCount = results.summary.totalReferences;
      await transcript.save();
      
      logger.info(`Comprehensive reference processing completed for episode ${episodeId}`);
      logger.info(`Summary: ${results.summary.totalReferences} total, ${results.summary.timestampedReferences} timestamped, ${results.summary.resolvedReferences} resolved`);
      
      return results;
    } catch (error) {
      logger.error(`Error in comprehensive reference processing: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get processing status for an episode
   * @param {string} episodeId - The episode ID
   * @returns {Promise<Object>} - Processing status
   */
  async getProcessingStatus(episodeId) {
    try {
      const episode = await Episode.findById(episodeId);
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found`);
      }
      
      const transcript = await Transcript.findOne({ episodeId });
      const references = await Reference.find({ sourceContentId: episodeId });
      
      const timestampedReferences = references.filter(ref => 
        ref.contextLocation && ref.contextLocation.type === 'timestamp'
      );
      
      const resolvedReferences = references.filter(ref => ref.resolved);
      const manualResolutionNeeded = references.filter(ref => ref.needsManualResolution);
      
      return {
        episodeId,
        episodeTitle: episode.title,
        hasTranscript: !!transcript,
        transcriptProcessed: transcript?.processed || false,
        referencesExtracted: episode.referencesExtracted || false,
        summary: {
          totalReferences: references.length,
          timestampedReferences: timestampedReferences.length,
          resolvedReferences: resolvedReferences.length,
          manualResolutionNeeded: manualResolutionNeeded.length
        },
        processingComplete: transcript?.processed && episode.referencesExtracted,
        lastUpdated: episode.updatedAt
      };
    } catch (error) {
      logger.error(`Error getting processing status: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Create a comprehensive episode report
   * @param {string} episodeId - The episode ID
   * @returns {Promise<Object>} - Episode report
   */
  async createEpisodeReport(episodeId) {
    try {
      const episode = await Episode.findById(episodeId);
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found`);
      }
      
      // Get processing status
      const status = await this.getProcessingStatus(episodeId);
      
      // Get timestamped references
      const timestampedReferences = await timestampLinker.getTimestampedReferences(episodeId);
      
      // Get reference timeline
      const timeline = await timestampLinker.createReferenceTimeline(episodeId);
      
      // Get references needing manual resolution
      const manualResolutionRefs = await Reference.find({
        sourceContentId: episodeId,
        needsManualResolution: true,
        manuallyResolved: { $ne: true }
      });
      
      return {
        episode: {
          id: episode._id,
          title: episode.title,
          publishDate: episode.publishDate,
          duration: episode.duration,
          audioUrl: episode.audioUrl
        },
        processingStatus: status,
        timestampedReferences: timestampedReferences.map(ref => ({
          id: ref._id,
          title: ref.title,
          timestamp: ref.contextLocation.value,
          formattedTimestamp: ref.formattedTimestamp,
          playbackUrl: ref.playbackUrl,
          context: ref.context,
          resolved: ref.resolved
        })),
        timeline,
        manualResolutionNeeded: manualResolutionRefs.map(ref => ({
          id: ref._id,
          title: ref.title,
          context: ref.context,
          resolutionAttempts: ref.resolutionAttempts,
          timestamp: ref.contextLocation?.value
        })),
        summary: {
          ...status.summary,
          completionPercentage: status.summary.totalReferences > 0 
            ? Math.round((status.summary.resolvedReferences / status.summary.totalReferences) * 100)
            : 100
        }
      };
    } catch (error) {
      logger.error(`Error creating episode report: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new PodcastReferenceProcessor();