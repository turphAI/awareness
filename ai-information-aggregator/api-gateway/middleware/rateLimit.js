/**
 * Rate limiting middleware for API Gateway
 * Implements configurable rate limiting with different strategies
 */

const logger = require('../utils/logger');

/**
 * In-memory storage for rate limiting
 * In production, this should be replaced with Redis or similar
 */
class RateLimitStore {
  constructor() {
    this.store = new Map();
    this.cleanupInterval = 60000; // 1 minute
    this.startCleanup();
  }

  /**
   * Get current count for a key
   */
  get(key) {
    const data = this.store.get(key);
    if (!data) return { count: 0, resetTime: Date.now() };
    return data;
  }

  /**
   * Increment count for a key
   */
  increment(key, windowMs) {
    const now = Date.now();
    const data = this.get(key);
    
    // Reset if window has expired
    if (now >= data.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return { count: 1, resetTime: now + windowMs };
    }
    
    // Increment existing count
    const newData = {
      count: data.count + 1,
      resetTime: data.resetTime
    };
    this.store.set(key, newData);
    return newData;
  }

  /**
   * Reset count for a key
   */
  reset(key) {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now >= data.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Global rate limit store
const globalStore = new RateLimitStore();

/**
 * Create rate limiting middleware
 */
const createRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests, please try again later',
    standardHeaders = true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders = false, // Disable the `X-RateLimit-*` headers
    store = globalStore,
    keyGenerator = (req) => req.ip,
    skip = () => false,
    onLimitReached = null
  } = options;

  return (req, res, next) => {
    // Skip rate limiting if skip function returns true
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const data = store.increment(key, windowMs);
    
    // Add rate limit headers
    if (standardHeaders) {
      res.set({
        'RateLimit-Limit': max,
        'RateLimit-Remaining': Math.max(0, max - data.count),
        'RateLimit-Reset': new Date(data.resetTime).toISOString()
      });
    }

    if (legacyHeaders) {
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - data.count),
        'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000)
      });
    }

    // Check if limit exceeded
    if (data.count > max) {
      logger.warn('Rate limit exceeded', {
        key: key,
        count: data.count,
        max: max,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      // Call onLimitReached callback if provided
      if (onLimitReached) {
        onLimitReached(req, res);
      }

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: message,
        retryAfter: Math.ceil((data.resetTime - Date.now()) / 1000)
      });
    }

    // Log rate limit info for monitoring
    if (data.count > max * 0.8) { // Log when approaching limit
      logger.info('Rate limit warning', {
        key: key,
        count: data.count,
        max: max,
        remaining: max - data.count,
        path: req.path
      });
    }

    next();
  };
};

/**
 * IP-based rate limiting
 */
const ipRateLimit = (max = 100, windowMs = 15 * 60 * 1000) => {
  return createRateLimit({
    max,
    windowMs,
    keyGenerator: (req) => req.ip,
    message: 'Too many requests from this IP, please try again later'
  });
};

/**
 * User-based rate limiting (requires authentication)
 */
const userRateLimit = (max = 1000, windowMs = 15 * 60 * 1000) => {
  return createRateLimit({
    max,
    windowMs,
    keyGenerator: (req) => req.user ? `user:${req.user.id}` : req.ip,
    message: 'Too many requests from this user, please try again later',
    skip: (req) => !req.user // Skip if user is not authenticated
  });
};

/**
 * API endpoint specific rate limiting
 */
const endpointRateLimit = (max = 50, windowMs = 15 * 60 * 1000) => {
  return createRateLimit({
    max,
    windowMs,
    keyGenerator: (req) => `${req.ip}:${req.path}`,
    message: 'Too many requests to this endpoint, please try again later'
  });
};

/**
 * Strict rate limiting for sensitive endpoints
 */
const strictRateLimit = (max = 5, windowMs = 15 * 60 * 1000) => {
  return createRateLimit({
    max,
    windowMs,
    keyGenerator: (req) => req.user ? `strict:${req.user.id}` : `strict:${req.ip}`,
    message: 'Rate limit exceeded for sensitive operation',
    onLimitReached: (req, res) => {
      logger.error('Strict rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.id,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });
    }
  });
};

/**
 * Sliding window rate limiter
 */
class SlidingWindowRateLimit {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000;
    this.max = options.max || 100;
    this.store = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    
    const requests = this.store.get(key);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    this.store.set(key, recentRequests);
    
    // Check if limit exceeded
    if (recentRequests.length >= this.max) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.store.set(key, recentRequests);
    
    return true;
  }

  getRemainingRequests(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.store.has(key)) {
      return this.max;
    }
    
    const requests = this.store.get(key);
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, this.max - recentRequests.length);
  }
}

/**
 * Create sliding window rate limiter middleware
 */
const createSlidingWindowRateLimit = (options = {}) => {
  const limiter = new SlidingWindowRateLimit(options);
  const keyGenerator = options.keyGenerator || ((req) => req.ip);
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    
    if (!limiter.isAllowed(key)) {
      logger.warn('Sliding window rate limit exceeded', {
        key: key,
        path: req.path,
        method: req.method
      });
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests in sliding window',
        remaining: limiter.getRemainingRequests(key)
      });
    }
    
    // Add headers
    res.set({
      'RateLimit-Remaining': limiter.getRemainingRequests(key),
      'RateLimit-Limit': limiter.max
    });
    
    next();
  };
};

/**
 * Cleanup function for graceful shutdown
 */
const cleanup = () => {
  globalStore.stopCleanup();
};

module.exports = {
  createRateLimit,
  ipRateLimit,
  userRateLimit,
  endpointRateLimit,
  strictRateLimit,
  createSlidingWindowRateLimit,
  RateLimitStore,
  SlidingWindowRateLimit,
  cleanup
};