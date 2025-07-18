const nodemailer = require('nodemailer');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('email-service');

/**
 * Email Service for sending authentication-related emails
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.from = process.env.EMAIL_FROM || 'noreply@ai-aggregator.com';
  }

  /**
   * Initialize email transporter
   * @returns {boolean} - Whether initialization was successful
   */
  initialize() {
    try {
      // Check if already initialized
      if (this.initialized) {
        return true;
      }

      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      this.initialized = true;
      logger.info('Email service initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      return false;
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @returns {Promise<boolean>} - Whether email was sent successfully
   */
  async sendEmail(options) {
    try {
      // Initialize if not already
      if (!this.initialized) {
        const initialized = this.initialize();
        if (!initialized) {
          logger.error('Email service not initialized');
          return false;
        }
      }

      // Send email
      const info = await this.transporter.sendMail({
        from: options.from || this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      });

      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send verification email
   * @param {Object} user - User object
   * @param {string} token - Verification token
   * @param {string} baseUrl - Base URL for verification link
   * @returns {Promise<boolean>} - Whether email was sent successfully
   */
  async sendVerificationEmail(user, token, baseUrl) {
    const verificationUrl = `${baseUrl}/verify-email/${token}`;

    const html = `
      <h1>Email Verification</h1>
      <p>Hello ${user.name},</p>
      <p>Thank you for registering with AI Information Aggregator. Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>If you did not register for an account, please ignore this email.</p>
      <p>This link will expire in 24 hours.</p>
      <p>Regards,<br>AI Information Aggregator Team</p>
    `;

    const text = `
      Email Verification
      
      Hello ${user.name},
      
      Thank you for registering with AI Information Aggregator. Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      If you did not register for an account, please ignore this email.
      
      This link will expire in 24 hours.
      
      Regards,
      AI Information Aggregator Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Email Verification - AI Information Aggregator',
      html,
      text
    });
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} token - Reset token
   * @param {string} baseUrl - Base URL for reset link
   * @returns {Promise<boolean>} - Whether email was sent successfully
   */
  async sendPasswordResetEmail(user, token, baseUrl) {
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    const html = `
      <h1>Password Reset</h1>
      <p>Hello ${user.name},</p>
      <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
      <p>Please click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <p>This link will expire in 10 minutes.</p>
      <p>Regards,<br>AI Information Aggregator Team</p>
    `;

    const text = `
      Password Reset
      
      Hello ${user.name},
      
      You are receiving this email because you (or someone else) has requested a password reset for your account.
      
      Please click the link below to reset your password:
      
      ${resetUrl}
      
      If you did not request this, please ignore this email and your password will remain unchanged.
      
      This link will expire in 10 minutes.
      
      Regards,
      AI Information Aggregator Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Password Reset - AI Information Aggregator',
      html,
      text
    });
  }

  /**
   * Send welcome email
   * @param {Object} user - User object
   * @returns {Promise<boolean>} - Whether email was sent successfully
   */
  async sendWelcomeEmail(user) {
    const html = `
      <h1>Welcome to AI Information Aggregator!</h1>
      <p>Hello ${user.name},</p>
      <p>Thank you for joining AI Information Aggregator. We're excited to have you on board!</p>
      <p>With your account, you can:</p>
      <ul>
        <li>Stay updated with the latest AI and LLM developments</li>
        <li>Discover relevant content from various sources</li>
        <li>Create personalized collections of content</li>
        <li>Get summaries and insights from articles and papers</li>
      </ul>
      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      <p>Regards,<br>AI Information Aggregator Team</p>
    `;

    const text = `
      Welcome to AI Information Aggregator!
      
      Hello ${user.name},
      
      Thank you for joining AI Information Aggregator. We're excited to have you on board!
      
      With your account, you can:
      - Stay updated with the latest AI and LLM developments
      - Discover relevant content from various sources
      - Create personalized collections of content
      - Get summaries and insights from articles and papers
      
      If you have any questions or need assistance, please don't hesitate to contact our support team.
      
      Regards,
      AI Information Aggregator Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to AI Information Aggregator',
      html,
      text
    });
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;