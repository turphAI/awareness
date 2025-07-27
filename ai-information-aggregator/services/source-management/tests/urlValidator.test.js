const UrlValidator = require('../utils/urlValidator');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('UrlValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidFormat', () => {
    it('should return true for valid URLs', () => {
      expect(UrlValidator.isValidFormat('https://example.com')).toBe(true);
      expect(UrlValidator.isValidFormat('http://example.com')).toBe(true);
      expect(UrlValidator.isValidFormat('https://example.com/path')).toBe(true);
      expect(UrlValidator.isValidFormat('https://subdomain.example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(UrlValidator.isValidFormat('not-a-url')).toBe(false);
      expect(UrlValidator.isValidFormat('http:/example.com')).toBe(false);
      expect(UrlValidator.isValidFormat('https://')).toBe(false);
    });
  });

  describe('isReachable', () => {
    it('should return true for reachable URLs', async () => {
      axios.head.mockResolvedValue({ status: 200 });
      const result = await UrlValidator.isReachable('https://example.com');
      expect(result).toBe(true);
      expect(axios.head).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should add protocol if missing', async () => {
      axios.head.mockResolvedValue({ status: 200 });
      await UrlValidator.isReachable('example.com');
      expect(axios.head).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should return true for 3xx status codes', async () => {
      axios.head.mockResolvedValue({ status: 301 });
      const result = await UrlValidator.isReachable('https://example.com');
      expect(result).toBe(true);
    });

    it('should return false for 4xx status codes', async () => {
      axios.head.mockResolvedValue({ status: 404 });
      const result = await UrlValidator.isReachable('https://example.com');
      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      axios.head.mockRejectedValue(new Error('Network error'));
      const result = await UrlValidator.isReachable('https://example.com');
      expect(result).toBe(false);
    });
  });

  describe('detectType', () => {
    it('should detect RSS feeds', async () => {
      axios.get.mockResolvedValue({ data: '', headers: {} });
      expect(await UrlValidator.detectType('https://example.com/feed')).toBe('rss');
      expect(await UrlValidator.detectType('https://example.com/rss')).toBe('rss');
      expect(await UrlValidator.detectType('https://example.com/atom.xml')).toBe('rss');
    });

    it('should detect podcasts', async () => {
      axios.get.mockResolvedValue({ data: '', headers: {} });
      expect(await UrlValidator.detectType('https://podcast.example.com')).toBe('podcast');
      expect(await UrlValidator.detectType('https://anchor.fm/show')).toBe('podcast');
      expect(await UrlValidator.detectType('https://spotify.com/show/123')).toBe('podcast');
    });

    it('should detect academic sources', async () => {
      axios.get.mockResolvedValue({ data: '', headers: {} });
      expect(await UrlValidator.detectType('https://arxiv.org/abs/123')).toBe('academic');
      expect(await UrlValidator.detectType('https://scholar.google.com/citation')).toBe('academic');
      expect(await UrlValidator.detectType('https://ieee.org/paper')).toBe('academic');
    });

    it('should detect social media', async () => {
      axios.get.mockResolvedValue({ data: '', headers: {} });
      expect(await UrlValidator.detectType('https://twitter.com/user')).toBe('social');
      expect(await UrlValidator.detectType('https://facebook.com/page')).toBe('social');
      expect(await UrlValidator.detectType('https://linkedin.com/in/user')).toBe('social');
    });

    it('should detect blogs based on content', async () => {
      axios.get.mockResolvedValue({ 
        data: '<html><body>This is a blog post with author and comments</body></html>', 
        headers: {} 
      });
      expect(await UrlValidator.detectType('https://example.com/post')).toBe('blog');
    });

    it('should default to website for unknown types', async () => {
      axios.get.mockResolvedValue({ data: '<html><body>Regular website</body></html>', headers: {} });
      expect(await UrlValidator.detectType('https://example.com')).toBe('website');
    });

    it('should handle errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));
      expect(await UrlValidator.detectType('https://example.com')).toBe('website');
    });
  });

  describe('validateAndExtractSourceInfo', () => {
    it('should return invalid result for invalid URL format', async () => {
      const result = await UrlValidator.validateAndExtractSourceInfo('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should return invalid result for unreachable URL', async () => {
      jest.spyOn(UrlValidator, 'isValidFormat').mockReturnValue(true);
      jest.spyOn(UrlValidator, 'isReachable').mockResolvedValue(false);
      
      const result = await UrlValidator.validateAndExtractSourceInfo('https://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL is not reachable');
    });

    it('should return valid result with source info for valid URL', async () => {
      jest.spyOn(UrlValidator, 'isValidFormat').mockReturnValue(true);
      jest.spyOn(UrlValidator, 'isReachable').mockResolvedValue(true);
      jest.spyOn(UrlValidator, 'getMetadata').mockResolvedValue({
        title: 'Example Website',
        description: 'This is an example website',
        author: 'John Doe'
      });
      jest.spyOn(UrlValidator, 'detectType').mockResolvedValue('website');
      jest.spyOn(UrlValidator, 'findRssFeed').mockResolvedValue('https://example.com/feed');
      
      const result = await UrlValidator.validateAndExtractSourceInfo('https://example.com');
      expect(result.valid).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(result.name).toBe('Example Website');
      expect(result.description).toBe('This is an example website');
      expect(result.type).toBe('website');
      expect(result.rssUrl).toBe('https://example.com/feed');
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(UrlValidator, 'isValidFormat').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await UrlValidator.validateAndExtractSourceInfo('https://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });
});