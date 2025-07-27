const ContentMetadata = require('../models/ContentMetadata');
const Content = require('../../content-discovery/models/Content');

/**
 * Related Content Identifier
 * Implements content similarity algorithms and connection visualization
 */
class RelatedContentIdentifier {
  constructor() {
    this.similarityThreshold = 0.3;
    this.maxRelatedItems = 10;
  }

  /**
   * Calculate content similarity based on multiple factors
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(content1, content2) {
    let totalScore = 0;
    let weightSum = 0;

    // Topic similarity (weight: 0.3)
    const topicSimilarity = this.calculateTopicSimilarity(content1.topics || [], content2.topics || []);
    totalScore += topicSimilarity * 0.3;
    weightSum += 0.3;

    // Category similarity (weight: 0.2)
    const categorySimilarity = this.calculateCategorySimilarity(content1.categories || [], content2.categories || []);
    totalScore += categorySimilarity * 0.2;
    weightSum += 0.2;

    // Author similarity (weight: 0.15)
    const authorSimilarity = this.calculateAuthorSimilarity(content1, content2);
    totalScore += authorSimilarity * 0.15;
    weightSum += 0.15;

    // Content type similarity (weight: 0.1)
    const typeSimilarity = this.calculateTypeSimilarity(content1, content2);
    totalScore += typeSimilarity * 0.1;
    weightSum += 0.1;

    // Temporal similarity (weight: 0.1)
    const temporalSimilarity = this.calculateTemporalSimilarity(content1, content2);
    totalScore += temporalSimilarity * 0.1;
    weightSum += 0.1;

    // Text similarity (weight: 0.15)
    const textSimilarity = this.calculateTextSimilarity(content1, content2);
    totalScore += textSimilarity * 0.15;
    weightSum += 0.15;

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  /**
   * Calculate topic similarity using Jaccard coefficient
   * @param {Array} topics1 - Topics from first content
   * @param {Array} topics2 - Topics from second content
   * @returns {number} - Similarity score (0-1)
   */
  calculateTopicSimilarity(topics1, topics2) {
    if (!topics1.length && !topics2.length) return 1;
    if (!topics1.length || !topics2.length) return 0;

    const set1 = new Set(topics1.map(t => t.toLowerCase()));
    const set2 = new Set(topics2.map(t => t.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate category similarity using Jaccard coefficient
   * @param {Array} categories1 - Categories from first content
   * @param {Array} categories2 - Categories from second content
   * @returns {number} - Similarity score (0-1)
   */
  calculateCategorySimilarity(categories1, categories2) {
    if (!categories1.length && !categories2.length) return 1;
    if (!categories1.length || !categories2.length) return 0;

    const set1 = new Set(categories1.map(c => c.toLowerCase()));
    const set2 = new Set(categories2.map(c => c.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate author similarity
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @returns {number} - Similarity score (0-1)
   */
  calculateAuthorSimilarity(content1, content2) {
    const author1 = content1.author || (content1.authors && content1.authors[0]?.name) || '';
    const author2 = content2.author || (content2.authors && content2.authors[0]?.name) || '';
    
    if (!author1 && !author2) return 1;
    if (!author1 || !author2) return 0;
    
    return author1.toLowerCase() === author2.toLowerCase() ? 1 : 0;
  }

  /**
   * Calculate content type similarity
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @returns {number} - Similarity score (0-1)
   */
  calculateTypeSimilarity(content1, content2) {
    const type1 = content1.type || content1.contentType;
    const type2 = content2.type || content2.contentType;
    
    if (!type1 && !type2) return 1;
    if (!type1 || !type2) return 0;
    
    return type1 === type2 ? 1 : 0;
  }

  /**
   * Calculate temporal similarity based on publication dates
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @returns {number} - Similarity score (0-1)
   */
  calculateTemporalSimilarity(content1, content2) {
    const date1 = content1.publishDate || content1.publishedAt;
    const date2 = content2.publishDate || content2.publishedAt;
    
    if (!date1 || !date2) return 0.5;
    
    const timeDiff = Math.abs(new Date(date1) - new Date(date2));
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    
    // Exponential decay: content published within 30 days gets higher similarity
    return Math.exp(-daysDiff / 30);
  }

  /**
   * Calculate text similarity using simple word overlap
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @returns {number} - Similarity score (0-1)
   */
  calculateTextSimilarity(content1, content2) {
    const text1 = this.extractText(content1);
    const text2 = this.extractText(content2);
    
    if (!text1 || !text2) return 0;
    
    const words1 = this.extractKeywords(text1);
    const words2 = this.extractKeywords(text2);
    
    if (!words1.length || !words2.length) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Extract text content from content object
   * @param {Object} content - Content object
   * @returns {string} - Extracted text
   */
  extractText(content) {
    const textParts = [];
    
    if (content.title) textParts.push(content.title);
    if (content.summary) textParts.push(content.summary);
    if (content.description) textParts.push(content.description);
    if (content.keyInsights) textParts.push(...content.keyInsights);
    
    return textParts.join(' ').toLowerCase();
  }

  /**
   * Extract keywords from text
   * @param {string} text - Input text
   * @returns {Array} - Array of keywords
   */
  extractKeywords(text) {
    // Simple keyword extraction - remove common words and short words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
      'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
    ]);
    
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 50); // Limit to top 50 keywords
  }

  /**
   * Find related content for a given content item
   * @param {string} contentId - Content ID
   * @param {Object} options - Options for finding related content
   * @returns {Promise<Array>} - Array of related content with similarity scores
   */
  async findRelatedContent(contentId, options = {}) {
    const {
      limit = this.maxRelatedItems,
      threshold = this.similarityThreshold,
      includeMetadata = true
    } = options;

    try {
      // Get the source content
      const sourceContent = await Content.findById(contentId);
      if (!sourceContent) {
        throw new Error('Source content not found');
      }

      // Get source content metadata if available
      let sourceMetadata = null;
      if (includeMetadata) {
        sourceMetadata = await ContentMetadata.findOne({ contentId });
      }

      // Combine source content with metadata
      const enrichedSourceContent = this.combineContentWithMetadata(sourceContent, sourceMetadata);

      // Get all other content items
      const allContent = await Content.find({
        _id: { $ne: contentId },
        processed: true
      }).lean();

      // Calculate similarities
      const similarities = [];
      
      for (const content of allContent) {
        let metadata = null;
        if (includeMetadata) {
          metadata = await ContentMetadata.findOne({ contentId: content._id });
        }
        
        const enrichedContent = this.combineContentWithMetadata(content, metadata);
        const similarity = this.calculateSimilarity(enrichedSourceContent, enrichedContent);
        
        if (similarity >= threshold) {
          similarities.push({
            content: enrichedContent,
            similarity,
            relationshipType: this.determineRelationshipType(enrichedSourceContent, enrichedContent, similarity)
          });
        }
      }

      // Sort by similarity and limit results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      throw new Error(`Failed to find related content: ${error.message}`);
    }
  }

  /**
   * Combine content with metadata
   * @param {Object} content - Content object
   * @param {Object} metadata - Metadata object
   * @returns {Object} - Combined content object
   */
  combineContentWithMetadata(content, metadata) {
    if (!metadata) return content;
    
    return {
      ...content,
      ...metadata,
      // Merge arrays
      topics: [...(content.topics || []), ...(metadata.topics || [])],
      categories: [...(content.categories || []), ...(metadata.categories || [])],
      keywords: metadata.keywords || [],
      tags: metadata.tags || []
    };
  }

  /**
   * Determine relationship type based on content analysis
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @param {number} similarity - Similarity score
   * @returns {string} - Relationship type
   */
  determineRelationshipType(content1, content2, similarity) {
    // Check for direct references
    if (this.hasDirectReference(content1, content2)) {
      return 'reference';
    }
    
    // Check for same author
    if (this.calculateAuthorSimilarity(content1, content2) === 1) {
      return 'same_author';
    }
    
    // Check for update/sequel relationship
    if (this.isUpdateOrSequel(content1, content2)) {
      return 'update';
    }
    
    // Check for high topic similarity
    const topicSim = this.calculateTopicSimilarity(content1.topics || [], content2.topics || []);
    if (topicSim > 0.7) {
      return 'similar_topic';
    }
    
    // Default to similar
    return 'similar';
  }

  /**
   * Check if content has direct reference to another
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @returns {boolean} - True if direct reference exists
   */
  hasDirectReference(content1, content2) {
    const url2 = content2.url;
    const title2 = content2.title;
    
    // Check in full text, summary, and references
    const searchText = [
      content1.fullText,
      content1.summary,
      content1.description,
      ...(content1.keyInsights || [])
    ].join(' ').toLowerCase();
    
    return searchText.includes(url2) || 
           (title2 && searchText.includes(title2.toLowerCase()));
  }

  /**
   * Check if content is an update or sequel
   * @param {Object} content1 - First content item
   * @param {Object} content2 - Second content item
   * @returns {boolean} - True if update/sequel relationship exists
   */
  isUpdateOrSequel(content1, content2) {
    const title1 = (content1.title || '').toLowerCase();
    const title2 = (content2.title || '').toLowerCase();
    
    // Check for version indicators
    const versionIndicators = ['v2', 'version 2', 'updated', 'revised', 'part 2', 'sequel'];
    
    return versionIndicators.some(indicator => 
      title1.includes(indicator) || title2.includes(indicator)
    );
  }

  /**
   * Update related content relationships in metadata
   * @param {string} contentId - Content ID
   * @param {Array} relatedContent - Array of related content
   * @returns {Promise<void>}
   */
  async updateRelatedContentMetadata(contentId, relatedContent) {
    try {
      let metadata = await ContentMetadata.findOne({ contentId });
      
      if (!metadata) {
        // Create new metadata if it doesn't exist
        metadata = new ContentMetadata({ contentId });
      }

      // Clear existing related content
      metadata.relatedContent = [];

      // Add new related content
      for (const related of relatedContent) {
        if (metadata.addRelatedContent) {
          await metadata.addRelatedContent(
            related.content._id,
            related.relationshipType,
            related.similarity
          );
        } else {
          // Fallback for direct manipulation
          metadata.relatedContent.push({
            contentId: related.content._id,
            relationshipType: related.relationshipType,
            strength: related.similarity
          });
        }
      }

      await metadata.save();
    } catch (error) {
      throw new Error(`Failed to update related content metadata: ${error.message}`);
    }
  }

  /**
   * Generate connection visualization data
   * @param {string} contentId - Content ID
   * @param {Object} options - Visualization options
   * @returns {Promise<Object>} - Visualization data
   */
  async generateConnectionVisualization(contentId, options = {}) {
    const {
      maxDepth = 2,
      maxNodes = 50,
      includeMetrics = true
    } = options;

    try {
      const nodes = new Map();
      const edges = [];
      const visited = new Set();

      // Start with the root content
      await this.buildConnectionGraph(contentId, nodes, edges, visited, 0, maxDepth, maxNodes);

      // Convert nodes map to array
      const nodeArray = Array.from(nodes.values());

      // Calculate network metrics if requested
      let metrics = {};
      if (includeMetrics) {
        metrics = this.calculateNetworkMetrics(nodeArray, edges);
      }

      return {
        nodes: nodeArray,
        edges,
        metrics,
        rootId: contentId
      };

    } catch (error) {
      throw new Error(`Failed to generate connection visualization: ${error.message}`);
    }
  }

  /**
   * Build connection graph recursively
   * @param {string} contentId - Current content ID
   * @param {Map} nodes - Nodes map
   * @param {Array} edges - Edges array
   * @param {Set} visited - Visited nodes set
   * @param {number} currentDepth - Current depth
   * @param {number} maxDepth - Maximum depth
   * @param {number} maxNodes - Maximum nodes
   * @returns {Promise<void>}
   */
  async buildConnectionGraph(contentId, nodes, edges, visited, currentDepth, maxDepth, maxNodes) {
    if (visited.has(contentId) || currentDepth > maxDepth || nodes.size >= maxNodes) {
      return;
    }

    visited.add(contentId);

    // Get content and metadata
    const content = await Content.findById(contentId);
    if (!content) return;

    const metadata = await ContentMetadata.findOne({ contentId });

    // Add node
    nodes.set(contentId, {
      id: contentId,
      title: content.title,
      type: content.type,
      author: content.author,
      publishDate: content.publishDate,
      relevanceScore: content.relevanceScore,
      topics: content.topics || [],
      categories: content.categories || [],
      depth: currentDepth,
      nodeSize: this.calculateNodeSize(content, metadata),
      nodeColor: this.getNodeColor(content.type)
    });

    // Get related content
    const relatedContent = await this.findRelatedContent(contentId, {
      limit: 10,
      threshold: 0.2
    });

    // Add edges and recurse
    for (const related of relatedContent) {
      const relatedId = related.content._id.toString();
      
      edges.push({
        source: contentId,
        target: relatedId,
        weight: related.similarity,
        type: related.relationshipType,
        strength: related.similarity
      });

      // Recurse to next depth
      await this.buildConnectionGraph(
        relatedId,
        nodes,
        edges,
        visited,
        currentDepth + 1,
        maxDepth,
        maxNodes
      );
    }
  }

  /**
   * Calculate node size based on content metrics
   * @param {Object} content - Content object
   * @param {Object} metadata - Metadata object
   * @returns {number} - Node size
   */
  calculateNodeSize(content, metadata) {
    let size = 10; // Base size
    
    // Increase size based on engagement
    if (content.readCount) size += Math.min(content.readCount / 10, 20);
    if (content.saveCount) size += Math.min(content.saveCount / 5, 15);
    if (content.shareCount) size += Math.min(content.shareCount / 3, 10);
    
    // Increase size based on quality
    if (content.relevanceScore) size += content.relevanceScore * 10;
    if (metadata?.qualityScore) size += metadata.qualityScore * 10;
    
    return Math.min(size, 50); // Cap at 50
  }

  /**
   * Get node color based on content type
   * @param {string} type - Content type
   * @returns {string} - Color code
   */
  getNodeColor(type) {
    const colors = {
      article: '#3498db',
      paper: '#e74c3c',
      podcast: '#9b59b6',
      video: '#f39c12',
      social: '#2ecc71',
      newsletter: '#34495e',
      book: '#e67e22',
      course: '#1abc9c'
    };
    
    return colors[type] || '#95a5a6';
  }

  /**
   * Calculate network metrics
   * @param {Array} nodes - Array of nodes
   * @param {Array} edges - Array of edges
   * @returns {Object} - Network metrics
   */
  calculateNetworkMetrics(nodes, edges) {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    
    // Calculate density
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
    
    // Calculate degree distribution
    const degrees = new Map();
    nodes.forEach(node => degrees.set(node.id, 0));
    
    edges.forEach(edge => {
      degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
    });
    
    const degreeValues = Array.from(degrees.values());
    const avgDegree = degreeValues.reduce((sum, deg) => sum + deg, 0) / nodeCount;
    const maxDegree = Math.max(...degreeValues);
    
    // Calculate clustering coefficient (simplified)
    const clusteringCoefficient = this.calculateClusteringCoefficient(nodes, edges);
    
    return {
      nodeCount,
      edgeCount,
      density,
      avgDegree,
      maxDegree,
      clusteringCoefficient
    };
  }

  /**
   * Calculate clustering coefficient
   * @param {Array} nodes - Array of nodes
   * @param {Array} edges - Array of edges
   * @returns {number} - Clustering coefficient
   */
  calculateClusteringCoefficient(nodes, edges) {
    // Simplified clustering coefficient calculation
    // In a real implementation, you'd calculate the actual clustering coefficient
    return Math.min(edges.length / (nodes.length * 2), 1);
  }

  /**
   * Batch process related content identification
   * @param {Array} contentIds - Array of content IDs to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing results
   */
  async batchProcessRelatedContent(contentIds, options = {}) {
    const {
      batchSize = 10,
      updateMetadata = true
    } = options;

    const results = {
      processed: 0,
      failed: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < contentIds.length; i += batchSize) {
      const batch = contentIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (contentId) => {
        try {
          const relatedContent = await this.findRelatedContent(contentId);
          
          if (updateMetadata) {
            await this.updateRelatedContentMetadata(contentId, relatedContent);
          }
          
          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            contentId,
            error: error.message
          });
        }
      }));
    }

    return results;
  }
}

module.exports = RelatedContentIdentifier;