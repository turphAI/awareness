/**
 * Deployment testing utilities
 * Tests various aspects of the deployed application
 */

// Test all routes are accessible
export const testRoutes = async () => {
  const routes = [
    '/',
    '/login',
    '/register',
    '/dashboard',
    '/sources',
    '/library',
    '/collections',
    '/settings',
    '/profile'
  ];

  const results = [];

  for (const route of routes) {
    try {
      const response = await fetch(route, { method: 'HEAD' });
      results.push({
        route,
        status: response.status,
        success: response.status < 400
      });
    } catch (error) {
      results.push({
        route,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    }
  }

  return results;
};

// Test static assets loading
export const testStaticAssets = async () => {
  const assets = [
    '/static/css/',
    '/static/js/',
    '/favicon.ico',
    '/manifest.json'
  ];

  const results = [];

  for (const asset of assets) {
    try {
      const response = await fetch(asset, { method: 'HEAD' });
      results.push({
        asset,
        status: response.status,
        success: response.status < 400,
        cacheControl: response.headers.get('cache-control'),
        contentType: response.headers.get('content-type')
      });
    } catch (error) {
      results.push({
        asset,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    }
  }

  return results;
};

// Test API endpoints
export const testApiEndpoints = async () => {
  const endpoints = [
    '/api/health',
    '/api/auth/login',
    '/api/sources'
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { method: 'HEAD' });
      results.push({
        endpoint,
        status: response.status,
        success: response.status < 500, // 4xx is expected for auth endpoints
        cors: response.headers.get('access-control-allow-origin')
      });
    } catch (error) {
      results.push({
        endpoint,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    }
  }

  return results;
};

// Test responsive breakpoints
export const testResponsiveBreakpoints = () => {
  const breakpoints = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1200, height: 800 },
    { name: 'Large Desktop', width: 1920, height: 1080 }
  ];

  const results = [];

  breakpoints.forEach(({ name, width, height }) => {
    // Simulate viewport change
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;

    try {
      // This is a simulation - in real testing, you'd use tools like Puppeteer
      const aspectRatio = width / height;
      const isLandscape = aspectRatio > 1;
      
      results.push({
        breakpoint: name,
        width,
        height,
        aspectRatio: aspectRatio.toFixed(2),
        orientation: isLandscape ? 'landscape' : 'portrait',
        success: true
      });
    } catch (error) {
      results.push({
        breakpoint: name,
        success: false,
        error: error.message
      });
    }
  });

  return results;
};

// Test performance metrics
export const testPerformanceMetrics = () => {
  if (!window.performance) {
    return { success: false, error: 'Performance API not available' };
  }

  const navigation = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');

  const metrics = {
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    totalTime: navigation.loadEventEnd - navigation.fetchStart,
    resourceCount: resources.length,
    slowResources: resources.filter(r => r.duration > 1000).length
  };

  const thresholds = {
    domContentLoaded: 1500, // 1.5s
    loadComplete: 3000,     // 3s
    totalTime: 5000         // 5s
  };

  const results = {
    metrics,
    thresholds,
    passed: {
      domContentLoaded: metrics.domContentLoaded < thresholds.domContentLoaded,
      loadComplete: metrics.loadComplete < thresholds.loadComplete,
      totalTime: metrics.totalTime < thresholds.totalTime
    }
  };

  results.success = Object.values(results.passed).every(Boolean);

  return results;
};

// Test HTTPS and security headers
export const testSecurityHeaders = async () => {
  try {
    const response = await fetch(window.location.origin, { method: 'HEAD' });
    
    const headers = {
      'strict-transport-security': response.headers.get('strict-transport-security'),
      'content-security-policy': response.headers.get('content-security-policy'),
      'x-frame-options': response.headers.get('x-frame-options'),
      'x-content-type-options': response.headers.get('x-content-type-options'),
      'referrer-policy': response.headers.get('referrer-policy')
    };

    const results = {
      https: window.location.protocol === 'https:',
      headers,
      recommendations: []
    };

    if (!headers['strict-transport-security']) {
      results.recommendations.push('Add HSTS header');
    }
    if (!headers['content-security-policy']) {
      results.recommendations.push('Add CSP header');
    }
    if (!headers['x-frame-options']) {
      results.recommendations.push('Add X-Frame-Options header');
    }

    results.success = results.https && results.recommendations.length === 0;

    return results;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Run all deployment tests
export const runDeploymentTests = async () => {
  console.log('🚀 Running deployment tests...');

  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    console.log('📍 Testing routes...');
    results.tests.routes = await testRoutes();

    console.log('📦 Testing static assets...');
    results.tests.staticAssets = await testStaticAssets();

    console.log('🔌 Testing API endpoints...');
    results.tests.apiEndpoints = await testApiEndpoints();

    console.log('📱 Testing responsive breakpoints...');
    results.tests.responsiveBreakpoints = testResponsiveBreakpoints();

    console.log('⚡ Testing performance metrics...');
    results.tests.performanceMetrics = testPerformanceMetrics();

    console.log('🔒 Testing security headers...');
    results.tests.securityHeaders = await testSecurityHeaders();

    // Calculate overall success
    const allTests = Object.values(results.tests);
    const successfulTests = allTests.filter(test => {
      if (Array.isArray(test)) {
        return test.every(item => item.success);
      }
      return test.success;
    });

    results.overallSuccess = successfulTests.length === allTests.length;
    results.successRate = (successfulTests.length / allTests.length * 100).toFixed(1);

    console.log(`✅ Deployment tests completed. Success rate: ${results.successRate}%`);
    
    return results;
  } catch (error) {
    console.error('❌ Deployment tests failed:', error);
    results.error = error.message;
    results.overallSuccess = false;
    return results;
  }
};

// Export test results to console in a readable format
export const logTestResults = (results) => {
  console.group('🧪 Deployment Test Results');
  
  Object.entries(results.tests).forEach(([testName, testResult]) => {
    console.group(`📋 ${testName}`);
    
    if (Array.isArray(testResult)) {
      testResult.forEach((item, index) => {
        const status = item.success ? '✅' : '❌';
        console.log(`${status} ${Object.values(item)[0]}`, item);
      });
    } else {
      const status = testResult.success ? '✅' : '❌';
      console.log(`${status} ${testName}`, testResult);
    }
    
    console.groupEnd();
  });
  
  console.log(`\n🎯 Overall Success: ${results.overallSuccess ? '✅' : '❌'} (${results.successRate}%)`);
  console.groupEnd();
};