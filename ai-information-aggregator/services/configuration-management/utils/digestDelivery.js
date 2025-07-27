const createLogger = require('../../../common/utils/logger');
const logger = createLogger('digest-delivery');

class DigestDelivery {
  constructor() {
    this.emailService = null; // Will be injected
    this.notificationService = null; // Will be injected
  }

  // Set service dependencies (for testing and modularity)
  setServices({ emailService, notificationService }) {
    this.emailService = emailService;
    this.notificationService = notificationService;
  }

  /**
   * Deliver digest to user based on their delivery preferences
   * @param {Object} digest - Generated digest content
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {Object} Delivery result
   */
  async deliverDigest(digest, scheduling) {
    try {
      logger.info(`Delivering digest to user ${scheduling.userId}`);

      const deliveryResults = {
        userId: scheduling.userId,
        digestId: digest.metadata?.id || `digest_${Date.now()}`,
        deliveredAt: new Date(),
        methods: [],
        success: true,
        errors: []
      };

      // Deliver via email if enabled
      if (scheduling.deliveryMethod.email.enabled) {
        try {
          const emailResult = await this.deliverViaEmail(digest, scheduling);
          deliveryResults.methods.push({
            method: 'email',
            success: emailResult.success,
            details: emailResult
          });
        } catch (error) {
          logger.error(`Email delivery failed for user ${scheduling.userId}:`, error);
          deliveryResults.errors.push({
            method: 'email',
            error: error.message
          });
          deliveryResults.success = false;
        }
      }

      // Deliver via in-app notification if enabled
      if (scheduling.deliveryMethod.inApp.enabled) {
        try {
          const inAppResult = await this.deliverViaInApp(digest, scheduling);
          deliveryResults.methods.push({
            method: 'inApp',
            success: inAppResult.success,
            details: inAppResult
          });
        } catch (error) {
          logger.error(`In-app delivery failed for user ${scheduling.userId}:`, error);
          deliveryResults.errors.push({
            method: 'inApp',
            error: error.message
          });
          deliveryResults.success = false;
        }
      }

      // Log delivery results
      if (deliveryResults.success) {
        logger.info(`Successfully delivered digest to user ${scheduling.userId} via ${deliveryResults.methods.map(m => m.method).join(', ')}`);
      } else {
        logger.warn(`Partial delivery failure for user ${scheduling.userId}:`, deliveryResults.errors);
      }

      return deliveryResults;

    } catch (error) {
      logger.error(`Error delivering digest to user ${scheduling.userId}:`, error);
      throw error;
    }
  }

  /**
   * Deliver digest via email
   * @param {Object} digest - Generated digest content
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {Object} Email delivery result
   */
  async deliverViaEmail(digest, scheduling) {
    try {
      const emailContent = this.formatEmailContent(digest, scheduling);
      
      // Mock email service call - in real system would use actual email service
      const emailResult = await this.sendEmail({
        to: scheduling.deliveryMethod.email.address,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      return {
        success: true,
        method: 'email',
        recipient: scheduling.deliveryMethod.email.address,
        messageId: emailResult.messageId,
        sentAt: new Date()
      };

    } catch (error) {
      logger.error('Email delivery error:', error);
      throw error;
    }
  }

  /**
   * Deliver digest via in-app notification
   * @param {Object} digest - Generated digest content
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {Object} In-app delivery result
   */
  async deliverViaInApp(digest, scheduling) {
    try {
      const notification = this.formatInAppNotification(digest, scheduling);
      
      // Mock notification service call - in real system would use actual notification service
      const notificationResult = await this.sendInAppNotification({
        userId: scheduling.userId,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        type: 'digest'
      });

      return {
        success: true,
        method: 'inApp',
        userId: scheduling.userId,
        notificationId: notificationResult.notificationId,
        sentAt: new Date()
      };

    } catch (error) {
      logger.error('In-app delivery error:', error);
      throw error;
    }
  }

  /**
   * Format digest content for email delivery
   * @param {Object} digest - Generated digest content
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {Object} Formatted email content
   */
  formatEmailContent(digest, scheduling) {
    const subject = digest.title || 'Your AI Information Digest';
    
    // Generate HTML content
    const html = this.generateEmailHTML(digest, scheduling);
    
    // Generate plain text content
    const text = this.generateEmailText(digest, scheduling);

    return { subject, html, text };
  }

  /**
   * Generate HTML email content
   * @param {Object} digest - Generated digest content
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {string} HTML content
   */
  generateEmailHTML(digest, scheduling) {
    const formatting = scheduling.getFormattingPreferences();
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${digest.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .summary { background: #e9ecef; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
          .content-item { border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-bottom: 15px; }
          .content-title { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
          .content-meta { color: #6c757d; font-size: 14px; margin-bottom: 10px; }
          .content-summary { margin-bottom: 10px; }
          .content-insights { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; }
          .topic-group { margin-bottom: 25px; }
          .topic-title { font-size: 20px; font-weight: bold; color: #495057; margin-bottom: 15px; border-bottom: 2px solid #dee2e6; padding-bottom: 5px; }
          .reading-time { color: #6c757d; font-size: 12px; }
          .thumbnail { float: right; margin-left: 15px; border-radius: 4px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${digest.title}</h1>
          <p>${digest.summary}</p>
        </div>
    `;

    // Add content based on grouping preference
    if (formatting.groupByTopic && typeof digest.content === 'object' && !Array.isArray(digest.content)) {
      // Grouped content
      for (const [topic, items] of Object.entries(digest.content)) {
        html += `<div class="topic-group">`;
        html += `<h2 class="topic-title">${topic}</h2>`;
        
        items.forEach(item => {
          html += this.generateContentItemHTML(item, formatting);
        });
        
        html += `</div>`;
      }
    } else {
      // Ungrouped content
      const items = Array.isArray(digest.content) ? digest.content : [];
      items.forEach(item => {
        html += this.generateContentItemHTML(item, formatting);
      });
    }

    html += `
        <div class="footer">
          <p>This digest was generated on ${digest.generatedAt.toLocaleString()} based on your preferences.</p>
          <p>Frequency: ${scheduling.frequency} | Items: ${digest.totalItems}</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Generate HTML for individual content item
   * @param {Object} item - Content item
   * @param {Object} formatting - Formatting preferences
   * @returns {string} HTML for content item
   */
  generateContentItemHTML(item, formatting) {
    let html = `<div class="content-item">`;
    
    // Add thumbnail if enabled and available
    if (formatting.includeThumbnails && item.thumbnail) {
      html += `<img src="${item.thumbnail}" alt="Thumbnail" class="thumbnail" width="100" height="60">`;
    }
    
    html += `<div class="content-title"><a href="${item.url}" target="_blank">${item.title}</a></div>`;
    
    // Add metadata
    let meta = [];
    if (item.author) meta.push(`By ${item.author}`);
    if (item.publishDate) meta.push(new Date(item.publishDate).toLocaleDateString());
    if (formatting.includeReadingTime && item.readingTime) meta.push(`${item.readingTime} min read`);
    if (item.type) meta.push(item.type.charAt(0).toUpperCase() + item.type.slice(1));
    
    if (meta.length > 0) {
      html += `<div class="content-meta">${meta.join(' • ')}</div>`;
    }
    
    // Add summary if available
    if (item.summary) {
      html += `<div class="content-summary">${item.summary}</div>`;
    }
    
    // Add key insights if available
    if (item.keyInsights && item.keyInsights.length > 0) {
      html += `<div class="content-insights">`;
      html += `<strong>Key Insights:</strong> ${item.keyInsights.join(' • ')}`;
      html += `</div>`;
    }
    
    // Add topics if available
    if (item.topics && item.topics.length > 0) {
      html += `<div style="margin-top: 10px; font-size: 12px; color: #6c757d;">`;
      html += `Topics: ${item.topics.join(', ')}`;
      html += `</div>`;
    }
    
    html += `</div>`;
    return html;
  }

  /**
   * Generate plain text email content
   * @param {Object} digest - Generated digest content
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {string} Plain text content
   */
  generateEmailText(digest, scheduling) {
    const formatting = scheduling.getFormattingPreferences();
    
    let text = `${digest.title}\n${'='.repeat(digest.title.length)}\n\n`;
    text += `${digest.summary}\n\n`;

    // Add content based on grouping preference
    if (formatting.groupByTopic && typeof digest.content === 'object' && !Array.isArray(digest.content)) {
      // Grouped content
      for (const [topic, items] of Object.entries(digest.content)) {
        text += `${topic.toUpperCase()}\n${'-'.repeat(topic.length)}\n\n`;
        
        items.forEach((item, index) => {
          text += this.generateContentItemText(item, formatting, index + 1);
          text += '\n';
        });
        
        text += '\n';
      }
    } else {
      // Ungrouped content
      const items = Array.isArray(digest.content) ? digest.content : [];
      items.forEach((item, index) => {
        text += this.generateContentItemText(item, formatting, index + 1);
        text += '\n';
      });
    }

    text += `\n${'='.repeat(50)}\n`;
    text += `Generated: ${digest.generatedAt.toLocaleString()}\n`;
    text += `Frequency: ${scheduling.frequency} | Items: ${digest.totalItems}\n`;

    return text;
  }

  /**
   * Generate plain text for individual content item
   * @param {Object} item - Content item
   * @param {Object} formatting - Formatting preferences
   * @param {number} index - Item index
   * @returns {string} Plain text for content item
   */
  generateContentItemText(item, formatting, index) {
    let text = `${index}. ${item.title}\n`;
    text += `   ${item.url}\n`;
    
    // Add metadata
    let meta = [];
    if (item.author) meta.push(`By ${item.author}`);
    if (item.publishDate) meta.push(new Date(item.publishDate).toLocaleDateString());
    if (formatting.includeReadingTime && item.readingTime) meta.push(`${item.readingTime} min read`);
    if (item.type) meta.push(item.type.charAt(0).toUpperCase() + item.type.slice(1));
    
    if (meta.length > 0) {
      text += `   ${meta.join(' • ')}\n`;
    }
    
    // Add summary if available
    if (item.summary) {
      text += `   ${item.summary}\n`;
    }
    
    // Add key insights if available
    if (item.keyInsights && item.keyInsights.length > 0) {
      text += `   Key Insights: ${item.keyInsights.join(' • ')}\n`;
    }
    
    // Add topics if available
    if (item.topics && item.topics.length > 0) {
      text += `   Topics: ${item.topics.join(', ')}\n`;
    }
    
    return text;
  }

  /**
   * Format digest content for in-app notification
   * @param {Object} digest - Generated digest content
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {Object} Formatted notification content
   */
  formatInAppNotification(digest, scheduling) {
    return {
      title: 'New Digest Available',
      message: `Your ${scheduling.frequency} digest is ready with ${digest.totalItems} new items`,
      data: {
        digestId: digest.metadata?.id,
        itemCount: digest.totalItems,
        frequency: scheduling.frequency,
        generatedAt: digest.generatedAt,
        preview: digest.summary
      }
    };
  }

  /**
   * Mock email sending service
   * @param {Object} emailData - Email data
   * @returns {Object} Email result
   */
  async sendEmail(emailData) {
    // Mock implementation - in real system would use actual email service
    logger.info(`Sending email to ${emailData.to}: ${emailData.subject}`);
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent',
      recipient: emailData.to
    };
  }

  /**
   * Mock in-app notification service
   * @param {Object} notificationData - Notification data
   * @returns {Object} Notification result
   */
  async sendInAppNotification(notificationData) {
    // Mock implementation - in real system would use actual notification service
    logger.info(`Sending in-app notification to user ${notificationData.userId}: ${notificationData.title}`);
    
    // Simulate notification sending delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'delivered',
      userId: notificationData.userId
    };
  }

  /**
   * Get delivery statistics for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Delivery statistics
   */
  async getDeliveryStats(userId, options = {}) {
    // Mock implementation - in real system would query delivery logs
    return {
      userId,
      totalDeliveries: 45,
      successfulDeliveries: 43,
      failedDeliveries: 2,
      lastDelivery: new Date(Date.now() - 86400000), // 1 day ago
      deliveryMethods: {
        email: { count: 25, successRate: 96 },
        inApp: { count: 43, successRate: 100 }
      },
      averageItemsPerDigest: 18.5,
      period: options.period || '30d'
    };
  }
}

module.exports = DigestDelivery;