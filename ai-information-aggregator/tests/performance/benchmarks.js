const { performance } = require('perf_hooks');

/**
 * Performance benchmarking utilities for the AI Information Aggregator
 */

class PerformanceBenchmark {
  constructor(name) {
    this.name = name;
    this.measurements = [];
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = performance.now();
    return this;
  }

  end() {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getStats() {
    if (this.measurements.length === 0) return null;

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const sum = this.measurements.reduce((a, b) => a + b, 0);

    return {
      name: this.name,
      count: this.measurements.length,
      min: Math.min(...this.measurements),
      max: Math.max(...this.measurements),
      average: sum / this.measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      measurements: this.measurements
    };
  }

  reset() {
    this.measurements = [];
    this.startTime = null;
    this.endTime = null;
  }
}

class DatabasePerformanceTest {
  constructor(dbConnection) {
    this.db = dbConnection;
    this.benchmarks = new Map();
  }

  async testInsertPerformance(collectionName, documents, iterations = 100) {
    const benchmark = new PerformanceBenchmark(`Insert ${collectionName}`);
    const collection = this.db.collection(collectionName);

    for (let i = 0; i < iterations; i++) {
      benchmark.start();
      await collection.insertMany(documents);
      benchmark.end();
      
      // Clean up for next iteration
      await collection.deleteMany({});
    }

    this.benchmarks.set(`insert_${collectionName}`, benchmark.getStats());
    return benchmark.getStats();
  }

  async testQueryPerformance(collectionName, query, iterations = 100) {
    const benchmark = new PerformanceBenchmark(`Query ${collectionName}`);
    const collection = this.db.collection(collectionName);

    // Setup test data
    const testDocs = Array(1000).fill().map((_, i) => ({
      id: i,
      title: `Test Document ${i}`,
      content: `This is test content for document ${i}`,
      category: `category_${i % 10}`,
      tags: [`tag_${i % 5}`, `tag_${(i + 1) % 5}`],
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 30) // Random date within 30 days
    }));

    await collection.insertMany(testDocs);

    for (let i = 0; i < iterations; i++) {
      benchmark.start();
      await collection.find(query).toArray();
      benchmark.end();
    }

    // Clean up
    await collection.deleteMany({});

    this.benchmarks.set(`query_${collectionName}`, benchmark.getStats());
    return benchmark.getStats();
  }

  async testAggregationPerformance(collectionName, pipeline, iterations = 50) {
    const benchmark = new PerformanceBenchmark(`Aggregation ${collectionName}`);
    const collection = this.db.collection(collectionName);

    // Setup test data
    const testDocs = Array(5000).fill().map((_, i) => ({
      id: i,
      category: `category_${i % 20}`,
      score: Math.random() * 100,
      tags: [`tag_${i % 10}`, `tag_${(i + 1) % 10}`],
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 90)
    }));

    await collection.insertMany(testDocs);

    for (let i = 0; i < iterations; i++) {
      benchmark.start();
      await collection.aggregate(pipeline).toArray();
      benchmark.end();
    }

    // Clean up
    await collection.deleteMany({});

    this.benchmarks.set(`aggregation_${collectionName}`, benchmark.getStats());
    return benchmark.getStats();
  }

  getAllBenchmarks() {
    return Object.fromEntries(this.benchmarks);
  }
}

class APIPerformanceTest {
  constructor() {
    this.benchmarks = new Map();
  }

  async testEndpointPerformance(name, testFunction, iterations = 100) {
    const benchmark = new PerformanceBenchmark(name);

    for (let i = 0; i < iterations; i++) {
      benchmark.start();
      await testFunction();
      benchmark.end();
    }

    this.benchmarks.set(name, benchmark.getStats());
    return benchmark.getStats();
  }

  async testConcurrentRequests(name, testFunction, concurrency = 10, iterations = 100) {
    const benchmark = new PerformanceBenchmark(`${name} (Concurrent)`);
    
    const batches = Math.ceil(iterations / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, iterations - batch * concurrency);
      const promises = Array(batchSize).fill().map(() => {
        benchmark.start();
        return testFunction().then(() => benchmark.end());
      });

      await Promise.all(promises);
    }

    this.benchmarks.set(`${name}_concurrent`, benchmark.getStats());
    return benchmark.getStats();
  }

  getAllBenchmarks() {
    return Object.fromEntries(this.benchmarks);
  }
}

class MemoryProfiler {
  constructor() {
    this.snapshots = [];
    this.isRunning = false;
    this.interval = null;
  }

  start(intervalMs = 1000) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.snapshots = [];

    this.interval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.snapshots.push({
        timestamp: Date.now(),
        ...memUsage
      });
    }, intervalMs);
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getReport() {
    if (this.snapshots.length === 0) return null;

    const metrics = ['rss', 'heapTotal', 'heapUsed', 'external'];
    const report = {
      duration: this.snapshots.length,
      snapshots: this.snapshots.length,
      metrics: {}
    };

    metrics.forEach(metric => {
      const values = this.snapshots.map(s => s[metric]);
      report.metrics[metric] = {
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((a, b) => a + b, 0) / values.length,
        final: values[values.length - 1],
        growth: values[values.length - 1] - values[0]
      };
    });

    return report;
  }

  detectMemoryLeaks() {
    if (this.snapshots.length < 10) return null;

    const heapUsedValues = this.snapshots.map(s => s.heapUsed);
    const firstHalf = heapUsedValues.slice(0, Math.floor(heapUsedValues.length / 2));
    const secondHalf = heapUsedValues.slice(Math.floor(heapUsedValues.length / 2));

    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const growthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

    return {
      suspiciousGrowth: growthRate > 0.1, // More than 10% growth
      growthRate,
      firstHalfAverage: firstHalfAvg,
      secondHalfAverage: secondHalfAvg,
      recommendation: growthRate > 0.1 ? 'Potential memory leak detected' : 'Memory usage appears stable'
    };
  }
}

// Utility functions for performance testing
function measureAsyncFunction(fn) {
  return async function(...args) {
    const start = performance.now();
    const result = await fn.apply(this, args);
    const end = performance.now();
    
    return {
      result,
      duration: end - start
    };
  };
}

function createPerformanceReport(benchmarks, memoryReport = null) {
  const report = {
    timestamp: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem()
    },
    benchmarks,
    memory: memoryReport
  };

  return report;
}

module.exports = {
  PerformanceBenchmark,
  DatabasePerformanceTest,
  APIPerformanceTest,
  MemoryProfiler,
  measureAsyncFunction,
  createPerformanceReport
};