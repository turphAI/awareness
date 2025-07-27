const { PerformanceBenchmark, MemoryProfiler, createPerformanceReport } = require('./benchmarks');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Import services for testing
const ContentSummarizer = require('../../services/content-summarization/utils/textSummarizer');
const ContentCategorizer = require('../../services/content-summarization/utils/contentCategorizer');
const SearchEngine = require('../../services/library-management/utils/searchEngine');

describe('Content Processing Performance Tests', () => {
  let mongoServer;
  let memoryProfiler;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    memoryProfiler = new MemoryProfiler();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Text Summarization Performance', () => {
    test('should handle large text summarization efficiently', async () => {
      const summarizer = new ContentSummarizer();
      const benchmark = new PerformanceBenchmark('Large Text Summarization');
      
      // Generate large text content
      const largeText = Array(1000).fill().map((_, i) => 
        `This is sentence ${i} about artificial intelligence and machine learning. ` +
        `It discusses various aspects of neural networks, deep learning, and natural language processing. ` +
        `The content includes technical details about transformer architectures and attention mechanisms.`
      ).join(' ');

      memoryProfiler.start();

      // Test summarization performance
      const iterations = 10;
      for (let i = 0; i < iterations; i++) {
        benchmark.start();
        await summarizer.summarize(largeText, { maxLength: 200 });
        benchmark.end();
      }

      memoryProfiler.stop();

      const stats = benchmark.getStats();
      const memoryReport = memoryProfiler.getReport();

      // Performance assertions
      expect(stats.average).toBeLessThan(5000); // Should complete within 5 seconds
      expect(stats.p95).toBeLessThan(8000); // 95th percentile under 8 seconds
      expect(memoryReport.metrics.heapUsed.growth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth

      console.log('Text Summarization Performance:', stats);
      console.log('Memory Usage:', memoryReport);
    });

    test('should handle concurrent summarization requests', async () => {
      const summarizer = new ContentSummarizer();
      const benchmark = new PerformanceBenchmark('Concurrent Summarization');
      
      const testTexts = Array(20).fill().map((_, i) => 
        `Article ${i}: This is a comprehensive article about AI research and development. ` +
        `It covers topics such as machine learning algorithms, neural network architectures, ` +
        `and practical applications in various industries. The content is designed to test ` +
        `the performance of our summarization system under concurrent load.`
      );

      memoryProfiler.start();

      // Test concurrent summarization
      benchmark.start();
      const promises = testTexts.map(text => 
        summarizer.summarize(text, { maxLength: 100 })
      );
      await Promise.all(promises);
      benchmark.end();

      memoryProfiler.stop();

      const duration = benchmark.measurements[0];
      const memoryReport = memoryProfiler.getReport();

      // Should handle 20 concurrent requests efficiently
      expect(duration).toBeLessThan(10000); // Within 10 seconds
      expect(memoryReport.metrics.heapUsed.max).toBeLessThan(200 * 1024 * 1024); // Under 200MB peak

      console.log('Concurrent Summarization Duration:', duration);
      console.log('Peak Memory Usage:', memoryReport.metrics.heapUsed.max);
    });
  });

  describe('Content Categorization Performance', () => {
    test('should categorize content efficiently', async () => {
      const categorizer = new ContentCategorizer();
      const benchmark = new PerformanceBenchmark('Content Categorization');
      
      const testContents = Array(100).fill().map((_, i) => ({
        title: `AI Research Paper ${i}`,
        content: `This paper discusses ${i % 2 === 0 ? 'machine learning' : 'natural language processing'} ` +
                `techniques and their applications in real-world scenarios. The research focuses on ` +
                `improving model performance and efficiency through novel architectural innovations.`,
        type: 'paper'
      }));

      memoryProfiler.start();

      // Test categorization performance
      for (const content of testContents) {
        benchmark.start();
        await categorizer.categorize(content);
        benchmark.end();
      }

      memoryProfiler.stop();

      const stats = benchmark.getStats();
      const memoryReport = memoryProfiler.getReport();

      // Performance assertions
      expect(stats.average).toBeLessThan(500); // Should complete within 500ms
      expect(stats.p99).toBeLessThan(1000); // 99th percentile under 1 second
      expect(memoryReport.metrics.heapUsed.growth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB growth

      console.log('Content Categorization Performance:', stats);
    });
  });

  describe('Search Engine Performance', () => {
    test('should handle search queries efficiently', async () => {
      const searchEngine = new SearchEngine();
      const benchmark = new PerformanceBenchmark('Search Query Performance');
      
      // Index test documents
      const testDocuments = Array(1000).fill().map((_, i) => ({
        id: `doc_${i}`,
        title: `Document ${i} about ${i % 3 === 0 ? 'machine learning' : i % 3 === 1 ? 'artificial intelligence' : 'deep learning'}`,
        content: `This is the content of document ${i}. It contains information about various AI topics ` +
                `including neural networks, natural language processing, computer vision, and robotics. ` +
                `The document discusses both theoretical concepts and practical applications.`,
        categories: [`category_${i % 10}`],
        tags: [`tag_${i % 5}`, `tag_${(i + 1) % 5}`]
      }));

      // Index documents
      await searchEngine.indexDocuments(testDocuments);

      const searchQueries = [
        'machine learning',
        'artificial intelligence',
        'neural networks',
        'deep learning',
        'natural language processing'
      ];

      memoryProfiler.start();

      // Test search performance
      for (const query of searchQueries) {
        for (let i = 0; i < 20; i++) {
          benchmark.start();
          await searchEngine.search(query, { limit: 10 });
          benchmark.end();
        }
      }

      memoryProfiler.stop();

      const stats = benchmark.getStats();
      const memoryReport = memoryProfiler.getReport();

      // Performance assertions
      expect(stats.average).toBeLessThan(100); // Should complete within 100ms
      expect(stats.p95).toBeLessThan(200); // 95th percentile under 200ms
      expect(memoryReport.metrics.heapUsed.growth).toBeLessThan(30 * 1024 * 1024); // Less than 30MB growth

      console.log('Search Performance:', stats);
    });

    test('should handle complex aggregation queries', async () => {
      const searchEngine = new SearchEngine();
      const benchmark = new PerformanceBenchmark('Complex Search Aggregation');
      
      // Create test data with various attributes
      const testDocuments = Array(5000).fill().map((_, i) => ({
        id: `doc_${i}`,
        title: `Document ${i}`,
        content: `Content for document ${i}`,
        category: `category_${i % 20}`,
        publishDate: new Date(Date.now() - Math.random() * 86400000 * 365), // Random date within a year
        author: `author_${i % 50}`,
        tags: [`tag_${i % 10}`, `tag_${(i + 1) % 10}`],
        relevanceScore: Math.random() * 100
      }));

      await searchEngine.indexDocuments(testDocuments);

      const complexQueries = [
        {
          query: 'machine learning',
          filters: { category: 'category_1' },
          sort: { relevanceScore: -1 },
          facets: ['author', 'tags']
        },
        {
          query: 'artificial intelligence',
          filters: { publishDate: { $gte: new Date(Date.now() - 86400000 * 30) } },
          sort: { publishDate: -1 },
          facets: ['category']
        }
      ];

      memoryProfiler.start();

      // Test complex query performance
      for (const queryConfig of complexQueries) {
        for (let i = 0; i < 10; i++) {
          benchmark.start();
          await searchEngine.complexSearch(queryConfig);
          benchmark.end();
        }
      }

      memoryProfiler.stop();

      const stats = benchmark.getStats();
      const memoryReport = memoryProfiler.getReport();

      // Performance assertions for complex queries
      expect(stats.average).toBeLessThan(500); // Should complete within 500ms
      expect(stats.p99).toBeLessThan(1000); // 99th percentile under 1 second

      console.log('Complex Search Performance:', stats);
    });
  });

  describe('Database Operations Performance', () => {
    test('should handle bulk content insertion efficiently', async () => {
      const Content = mongoose.model('Content', new mongoose.Schema({
        title: String,
        url: String,
        content: String,
        summary: String,
        categories: [String],
        publishDate: Date,
        processed: Boolean
      }));

      const benchmark = new PerformanceBenchmark('Bulk Content Insertion');
      
      const bulkData = Array(1000).fill().map((_, i) => ({
        title: `Bulk Content ${i}`,
        url: `https://example.com/content/${i}`,
        content: `This is the content for bulk item ${i}. It contains substantial text to simulate real content.`,
        summary: `Summary for content ${i}`,
        categories: [`category_${i % 10}`],
        publishDate: new Date(),
        processed: true
      }));

      memoryProfiler.start();

      // Test bulk insertion performance
      const iterations = 5;
      for (let i = 0; i < iterations; i++) {
        benchmark.start();
        await Content.insertMany(bulkData);
        benchmark.end();
        
        // Clean up for next iteration
        await Content.deleteMany({});
      }

      memoryProfiler.stop();

      const stats = benchmark.getStats();
      const memoryReport = memoryProfiler.getReport();

      // Performance assertions
      expect(stats.average).toBeLessThan(2000); // Should complete within 2 seconds
      expect(memoryReport.metrics.heapUsed.growth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth

      console.log('Bulk Insertion Performance:', stats);
    });

    test('should handle complex queries with aggregation', async () => {
      const Content = mongoose.model('Content');
      const benchmark = new PerformanceBenchmark('Complex Database Aggregation');
      
      // Setup test data
      const testData = Array(2000).fill().map((_, i) => ({
        title: `Content ${i}`,
        categories: [`category_${i % 15}`],
        publishDate: new Date(Date.now() - Math.random() * 86400000 * 180),
        relevanceScore: Math.random() * 100,
        processed: true
      }));

      await Content.insertMany(testData);

      const aggregationPipeline = [
        { $match: { processed: true } },
        { $group: {
          _id: '$categories',
          count: { $sum: 1 },
          avgRelevance: { $avg: '$relevanceScore' },
          latestDate: { $max: '$publishDate' }
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];

      memoryProfiler.start();

      // Test aggregation performance
      const iterations = 20;
      for (let i = 0; i < iterations; i++) {
        benchmark.start();
        await Content.aggregate(aggregationPipeline);
        benchmark.end();
      }

      memoryProfiler.stop();

      const stats = benchmark.getStats();
      const memoryReport = memoryProfiler.getReport();

      // Clean up
      await Content.deleteMany({});

      // Performance assertions
      expect(stats.average).toBeLessThan(300); // Should complete within 300ms
      expect(stats.p95).toBeLessThan(500); // 95th percentile under 500ms

      console.log('Database Aggregation Performance:', stats);
    });
  });

  afterEach(() => {
    // Generate performance report after each test
    const report = createPerformanceReport(
      { testName: expect.getState().currentTestName },
      memoryProfiler.getReport()
    );
    
    // Save report if needed
    // fs.writeFileSync(`performance-${Date.now()}.json`, JSON.stringify(report, null, 2));
  });
});