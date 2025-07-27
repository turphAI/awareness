const autocannon = require('autocannon');
const express = require('express');
const { performance } = require('perf_hooks');

// Import services for testing
const apiGateway = require('../../api-gateway/index');

class PerformanceTestSuite {
  constructor() {
    this.app = null;
    this.server = null;
    this.testResults = {};
  }

  async setup() {
    // Setup test application
    this.app = express();
    this.app.use(express.json());
    this.app.use('/api', apiGateway);
    
    // Start server on random port
    return new Promise((resolve) => {
      this.server = this.app.listen(0, () => {
        const port = this.server.address().port;
        console.log(`Performance test server running on port ${port}`);
        resolve(port);
      });
    });
  }

  async teardown() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }

  async runLoadTest(testName, options) {
    console.log(`\n🚀 Running load test: ${testName}`);
    
    const startTime = performance.now();
    const result = await autocannon(options);
    const endTime = performance.now();
    
    const testResult = {
      testName,
      duration: endTime - startTime,
      requests: result.requests,
      throughput: result.throughput,
      latency: result.latency,
      errors: result.errors,
      timeouts: result.timeouts,
      non2xx: result.non2xx
    };
    
    this.testResults[testName] = testResult;
    this.printResults(testResult);
    
    return testResult;
  }

  printResults(result) {
    console.log(`\n📊 Results for ${result.testName}:`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`   Requests: ${result.requests.total} total, ${result.requests.average} avg/sec`);
    console.log(`   Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s avg`);
    console.log(`   Latency: ${result.latency.average}ms avg, ${result.latency.p99}ms p99`);
    console.log(`   Errors: ${result.errors}`);
    console.log(`   Non-2xx: ${result.non2xx}`);
    console.log(`   Timeouts: ${result.timeouts}`);
  }

  generateReport() {
    console.log('\n📈 Performance Test Summary Report');
    console.log('=====================================');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: Object.keys(this.testResults).length,
      results: this.testResults,
      benchmarks: this.evaluateBenchmarks()
    };
    
    // Print summary
    Object.values(this.testResults).forEach(result => {
      console.log(`\n${result.testName}:`);
      console.log(`  ✓ Avg RPS: ${result.requests.average}`);
      console.log(`  ✓ Avg Latency: ${result.latency.average}ms`);
      console.log(`  ✓ P99 Latency: ${result.latency.p99}ms`);
      console.log(`  ✓ Error Rate: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
    });
    
    return report;
  }

  evaluateBenchmarks() {
    const benchmarks = {};
    
    Object.entries(this.testResults).forEach(([testName, result]) => {
      benchmarks[testName] = {
        rpsTarget: this.getRpsTarget(testName),
        latencyTarget: this.getLatencyTarget(testName),
        rpsActual: result.requests.average,
        latencyActual: result.latency.average,
        rpsPass: result.requests.average >= this.getRpsTarget(testName),
        latencyPass: result.latency.average <= this.getLatencyTarget(testName),
        errorRatePass: (result.errors / result.requests.total) < 0.01 // Less than 1% error rate
      };
    });
    
    return benchmarks;
  }

  getRpsTarget(testName) {
    const targets = {
      'Authentication Load Test': 100,
      'Content Discovery Load Test': 50,
      'Search Load Test': 200,
      'Dashboard Load Test': 150,
      'API Gateway Load Test': 300
    };
    return targets[testName] || 50;
  }

  getLatencyTarget(testName) {
    const targets = {
      'Authentication Load Test': 200,
      'Content Discovery Load Test': 500,
      'Search Load Test': 100,
      'Dashboard Load Test': 300,
      'API Gateway Load Test': 150
    };
    return targets[testName] || 500;
  }
}

async function runPerformanceTests() {
  const testSuite = new PerformanceTestSuite();
  
  try {
    const port = await testSuite.setup();
    const baseUrl = `http://localhost:${port}`;
    
    // Test 1: Authentication endpoint load test
    await testSuite.runLoadTest('Authentication Load Test', {
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      }),
      connections: 10,
      pipelining: 1,
      duration: 30
    });

    // Test 2: Content discovery endpoint
    await testSuite.runLoadTest('Content Discovery Load Test', {
      url: `${baseUrl}/api/content/discover`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        title: 'Test Article',
        url: 'https://example.com/test',
        fullText: 'This is a test article for performance testing.',
        type: 'article'
      }),
      connections: 5,
      pipelining: 1,
      duration: 30
    });

    // Test 3: Search endpoint
    await testSuite.runLoadTest('Search Load Test', {
      url: `${baseUrl}/api/library/search?q=machine+learning`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      },
      connections: 20,
      pipelining: 1,
      duration: 30
    });

    // Test 4: Dashboard endpoint
    await testSuite.runLoadTest('Dashboard Load Test', {
      url: `${baseUrl}/api/library/dashboard`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      },
      connections: 15,
      pipelining: 1,
      duration: 30
    });

    // Test 5: API Gateway health check
    await testSuite.runLoadTest('API Gateway Load Test', {
      url: `${baseUrl}/api/health`,
      method: 'GET',
      connections: 50,
      pipelining: 1,
      duration: 30
    });

    // Generate and save report
    const report = testSuite.generateReport();
    
    // Save report to file
    const fs = require('fs');
    const reportPath = `tests/performance/reports/load-test-${Date.now()}.json`;
    fs.mkdirSync('tests/performance/reports', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    return report;
    
  } catch (error) {
    console.error('Performance test failed:', error);
    throw error;
  } finally {
    await testSuite.teardown();
  }
}

// Memory and CPU monitoring
class ResourceMonitor {
  constructor() {
    this.measurements = [];
    this.interval = null;
  }

  start(intervalMs = 1000) {
    this.interval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.measurements.push({
        timestamp: Date.now(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      });
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getReport() {
    if (this.measurements.length === 0) return null;

    const memoryPeaks = {
      rss: Math.max(...this.measurements.map(m => m.memory.rss)),
      heapTotal: Math.max(...this.measurements.map(m => m.memory.heapTotal)),
      heapUsed: Math.max(...this.measurements.map(m => m.memory.heapUsed))
    };

    const memoryAverages = {
      rss: this.measurements.reduce((sum, m) => sum + m.memory.rss, 0) / this.measurements.length,
      heapTotal: this.measurements.reduce((sum, m) => sum + m.memory.heapTotal, 0) / this.measurements.length,
      heapUsed: this.measurements.reduce((sum, m) => sum + m.memory.heapUsed, 0) / this.measurements.length
    };

    return {
      duration: this.measurements.length,
      memoryPeaks,
      memoryAverages,
      measurements: this.measurements
    };
  }
}

module.exports = {
  PerformanceTestSuite,
  ResourceMonitor,
  runPerformanceTests
};

// Run tests if called directly
if (require.main === module) {
  runPerformanceTests()
    .then(() => {
      console.log('\n✅ Performance tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Performance tests failed:', error);
      process.exit(1);
    });
}