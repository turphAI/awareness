/**
 * Unit tests for rate limiting middleware
 */

const {
  createRateLimit,
  ipRateLimit,
  userRateLimit,
  endpointRateLimit,
  strictRateLimit,
  createSlidingWindowRateLimit,
  RateLimitStore,
  SlidingWindowRateLimit
} = require('../middleware/rateLimit');

// Mock dependencies
jest.mock('../utils/logger');

describe('Rate Limiting Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET',
      user: { id: 'user123' },
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RateLimitStore', () => {
    let store;

    beforeEach(() => {
      store = new RateLimitStore();
    });

    afterEach(() => {
      store.stopCleanup();
    });

    test('should initialize with empty store', () => {
      const data = store.get('test-key');
      expect(data.count).toBe(0);
      expect(data.resetTime).toBeGreaterThan(Date.now() - 1000);
    });

    test('should increment count correctly', () => {
      const windowMs = 60000;
      const data1 = store.increment('test-key', windowMs);
      const data2 = store.increment('test-key', windowMs);

      expect(data1.count).toBe(1);
      expect(data2.count).toBe(2);
      expect(data2.resetTime).toBe(data1.resetTime);
    });

    test('should reset count after window expires', (done) => {
      const windowMs = 100; // Very short window
      const data1 = store.increment('test-key', windowMs);
      
      // Wait for window to expire
      setTimeout(() => {
        const data2 = store.increment('test-key', windowMs);
        expect(data2.count).toBe(1);
        expect(data2.resetTime).toBeGreaterThan(data1.resetTime);
        done();
      }, 150);
    });

    test('should reset specific key', () => {
      store.increment('test-key', 60000);
      store.reset('test-key');
      
      const data = store.get('test-key');
      expect(data.count).toBe(0);
    });

    test('should cleanup expired entries', (done) => {
      const windowMs = 100;
      store.increment('test-key', windowMs);
      
      setTimeout(() => {
        store.cleanup();
        const data = store.get('test-key');
        expect(data.count).toBe(0);
        done();
      }, 150);
    });
  });

  describe('createRateLimit', () => {
    test('should allow requests within limit', () => {
      const store = new RateLimitStore();
      const middleware = createRateLimit({ max: 5, windowMs: 60000, store });

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block requests exceeding limit', () => {
      const store = new RateLimitStore();
      const middleware = createRateLimit({ max: 2, windowMs: 60000, store });

      // Make 3 requests (exceeding limit of 2)
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded'
        })
      );
    });

    test('should set rate limit headers', () => {
      const store = new RateLimitStore();
      const middleware = createRateLimit({ 
        max: 5, 
        windowMs: 60000, 
        store,
        standardHeaders: true 
      });

      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'RateLimit-Limit': 5,
          'RateLimit-Remaining': 4
        })
      );
    });

    test('should set legacy headers when enabled', () => {
      const store = new RateLimitStore();
      const middleware = createRateLimit({ 
        max: 5, 
        windowMs: 60000, 
        store,
        legacyHeaders: true 
      });

      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': 5,
          'X-RateLimit-Remaining': 4
        })
      );
    });

    test('should skip rate limiting when skip function returns true', () => {
      const store = new RateLimitStore();
      const middleware = createRateLimit({ 
        max: 1, 
        windowMs: 60000, 
        store,
        skip: () => true 
      });

      // Make multiple requests that would normally be blocked
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should use custom key generator', () => {
      const store = new RateLimitStore();
      const middleware = createRateLimit({ 
        max: 2, 
        windowMs: 60000, 
        store,
        keyGenerator: (req) => `custom:${req.user.id}`
      });

      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    test('should call onLimitReached callback', () => {
      const store = new RateLimitStore();
      const onLimitReached = jest.fn();
      const middleware = createRateLimit({ 
        max: 1, 
        windowMs: 60000, 
        store,
        onLimitReached
      });

      middleware(req, res, next);
      middleware(req, res, next);

      expect(onLimitReached).toHaveBeenCalledWith(req, res);
    });
  });

  describe('ipRateLimit', () => {
    test('should create IP-based rate limiter', () => {
      const middleware = ipRateLimit(5, 60000);
      
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalled();
    });

    test('should use IP address as key', () => {
      const middleware = ipRateLimit(1, 60000);
      
      req.ip = '192.168.1.1';
      middleware(req, res, next);
      
      req.ip = '192.168.1.2';
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('userRateLimit', () => {
    test('should create user-based rate limiter', () => {
      const middleware = userRateLimit(5, 60000);
      
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should skip when user is not authenticated', () => {
      delete req.user;
      const middleware = userRateLimit(1, 60000);
      
      // Should not apply rate limiting
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('endpointRateLimit', () => {
    test('should create endpoint-specific rate limiter', () => {
      const middleware = endpointRateLimit(2, 60000);
      
      req.path = '/api/test';
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    test('should allow different limits for different endpoints', () => {
      const middleware = endpointRateLimit(1, 60000);
      
      req.path = '/api/endpoint1';
      middleware(req, res, next);
      
      req.path = '/api/endpoint2';
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('strictRateLimit', () => {
    test('should create strict rate limiter with low limits', () => {
      const middleware = strictRateLimit(2, 60000);
      
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('SlidingWindowRateLimit', () => {
    let limiter;

    beforeEach(() => {
      limiter = new SlidingWindowRateLimit({ max: 3, windowMs: 1000 });
    });

    test('should allow requests within limit', () => {
      expect(limiter.isAllowed('test-key')).toBe(true);
      expect(limiter.isAllowed('test-key')).toBe(true);
      expect(limiter.isAllowed('test-key')).toBe(true);
    });

    test('should block requests exceeding limit', () => {
      limiter.isAllowed('test-key');
      limiter.isAllowed('test-key');
      limiter.isAllowed('test-key');
      
      expect(limiter.isAllowed('test-key')).toBe(false);
    });

    test('should return correct remaining requests', () => {
      expect(limiter.getRemainingRequests('test-key')).toBe(3);
      
      limiter.isAllowed('test-key');
      expect(limiter.getRemainingRequests('test-key')).toBe(2);
      
      limiter.isAllowed('test-key');
      expect(limiter.getRemainingRequests('test-key')).toBe(1);
    });

    test('should reset after window expires', (done) => {
      limiter.isAllowed('test-key');
      limiter.isAllowed('test-key');
      limiter.isAllowed('test-key');
      
      expect(limiter.isAllowed('test-key')).toBe(false);
      
      setTimeout(() => {
        expect(limiter.isAllowed('test-key')).toBe(true);
        done();
      }, 1100);
    });
  });

  describe('createSlidingWindowRateLimit', () => {
    test('should create sliding window middleware', () => {
      const middleware = createSlidingWindowRateLimit({ max: 3, windowMs: 1000 });
      
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(3);
    });

    test('should block requests exceeding sliding window limit', () => {
      const middleware = createSlidingWindowRateLimit({ max: 2, windowMs: 1000 });
      
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    test('should set remaining requests header', () => {
      const middleware = createSlidingWindowRateLimit({ max: 5, windowMs: 1000 });
      
      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'RateLimit-Remaining': 4,
          'RateLimit-Limit': 5
        })
      );
    });
  });
});