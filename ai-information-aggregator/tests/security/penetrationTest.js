const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Security Penetration Testing Suite
 * Tests for common security vulnerabilities and attack vectors
 */

class SecurityTestSuite {
  constructor(app) {
    this.app = app;
    this.vulnerabilities = [];
    this.testResults = {};
  }

  async runAllTests() {
    console.log('🔒 Starting Security Penetration Tests');
    console.log('=====================================\n');

    const testSuites = [
      { name: 'Authentication Security', test: () => this.testAuthenticationSecurity() },
      { name: 'Authorization Bypass', test: () => this.testAuthorizationBypass() },
      { name: 'Input Validation', test: () => this.testInputValidation() },
      { name: 'SQL Injection', test: () => this.testSQLInjection() },
      { name: 'XSS Vulnerabilities', test: () => this.testXSSVulnerabilities() },
      { name: 'CSRF Protection', test: () => this.testCSRFProtection() },
      { name: 'Rate Limiting', test: () => this.testRateLimiting() },
      { name: 'Data Exposure', test: () => this.testDataExposure() },
      { name: 'Session Security', test: () => this.testSessionSecurity() },
      { name: 'API Security', test: () => this.testAPISecurity() }
    ];

    for (const suite of testSuites) {
      console.log(`🔍 Testing: ${suite.name}`);
      try {
        const results = await suite.test();
        this.testResults[suite.name] = {
          status: 'passed',
          results,
          vulnerabilities: results.vulnerabilities || []
        };
        console.log(`✅ ${suite.name}: ${results.vulnerabilities?.length || 0} vulnerabilities found`);
      } catch (error) {
        this.testResults[suite.name] = {
          status: 'failed',
          error: error.message
        };
        console.log(`❌ ${suite.name}: Test failed - ${error.message}`);
      }
    }

    return this.generateSecurityReport();
  }

  async testAuthenticationSecurity() {
    const vulnerabilities = [];

    // Test 1: Weak password acceptance
    try {
      const weakPasswords = ['123', 'password', 'admin', ''];
      for (const password of weakPasswords) {
        const response = await request(this.app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: password,
            name: 'Test User'
          });

        if (response.status === 201) {
          vulnerabilities.push({
            type: 'Weak Password Policy',
            severity: 'high',
            description: `System accepts weak password: "${password}"`,
            endpoint: '/api/auth/register'
          });
        }
      }
    } catch (error) {
      // Expected behavior - weak passwords should be rejected
    }

    // Test 2: Brute force protection
    const bruteForceAttempts = [];
    for (let i = 0; i < 10; i++) {
      const response = await request(this.app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: `wrongpassword${i}`
        });
      bruteForceAttempts.push(response.status);
    }

    const successfulAttempts = bruteForceAttempts.filter(status => status === 200).length;
    if (successfulAttempts > 0 || !bruteForceAttempts.includes(429)) {
      vulnerabilities.push({
        type: 'Insufficient Brute Force Protection',
        severity: 'high',
        description: 'System does not properly rate limit login attempts',
        endpoint: '/api/auth/login'
      });
    }

    // Test 3: JWT token security
    try {
      const weakSecret = 'secret';
      const maliciousToken = jwt.sign({ userId: 'admin', role: 'admin' }, weakSecret);
      
      const response = await request(this.app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${maliciousToken}`);

      if (response.status === 200) {
        vulnerabilities.push({
          type: 'Weak JWT Secret',
          severity: 'critical',
          description: 'JWT tokens can be forged with weak secrets',
          endpoint: '/api/auth/profile'
        });
      }
    } catch (error) {
      // Expected - should reject forged tokens
    }

    return { vulnerabilities };
  }

  async testAuthorizationBypass() {
    const vulnerabilities = [];

    // Test 1: Direct object reference
    const testEndpoints = [
      '/api/sources/1',
      '/api/library/content/1',
      '/api/library/collections/1',
      '/api/config/preferences'
    ];

    for (const endpoint of testEndpoints) {
      // Try accessing without authentication
      const noAuthResponse = await request(this.app)
        .get(endpoint);

      if (noAuthResponse.status === 200) {
        vulnerabilities.push({
          type: 'Missing Authentication',
          severity: 'high',
          description: `Endpoint accessible without authentication: ${endpoint}`,
          endpoint
        });
      }

      // Try accessing with invalid token
      const invalidTokenResponse = await request(this.app)
        .get(endpoint)
        .set('Authorization', 'Bearer invalid-token');

      if (invalidTokenResponse.status === 200) {
        vulnerabilities.push({
          type: 'Invalid Token Acceptance',
          severity: 'high',
          description: `Endpoint accepts invalid tokens: ${endpoint}`,
          endpoint
        });
      }
    }

    // Test 2: Privilege escalation
    try {
      const userToken = jwt.sign({ userId: 'user123', role: 'user' }, 'test-secret');
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/system',
        '/api/admin/logs'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(this.app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 200) {
          vulnerabilities.push({
            type: 'Privilege Escalation',
            severity: 'critical',
            description: `Regular user can access admin endpoint: ${endpoint}`,
            endpoint
          });
        }
      }
    } catch (error) {
      // Expected - should reject unauthorized access
    }

    return { vulnerabilities };
  }

  async testInputValidation() {
    const vulnerabilities = [];

    // Test 1: SQL Injection payloads
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --"
    ];

    const inputEndpoints = [
      { endpoint: '/api/library/search', param: 'q' },
      { endpoint: '/api/sources', param: 'url' },
      { endpoint: '/api/auth/login', param: 'email' }
    ];

    for (const { endpoint, param } of inputEndpoints) {
      for (const payload of sqlPayloads) {
        try {
          const response = await request(this.app)
            .post(endpoint)
            .send({ [param]: payload });

          // Check if the response indicates successful injection
          if (response.status === 200 && response.text.includes('users')) {
            vulnerabilities.push({
              type: 'SQL Injection',
              severity: 'critical',
              description: `SQL injection possible in ${endpoint} parameter ${param}`,
              endpoint,
              payload
            });
          }
        } catch (error) {
          // Expected - should reject malicious input
        }
      }
    }

    // Test 2: NoSQL Injection
    const noSqlPayloads = [
      { $ne: null },
      { $gt: '' },
      { $regex: '.*' },
      { $where: 'this.password.length > 0' }
    ];

    for (const payload of noSqlPayloads) {
      try {
        const response = await request(this.app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: payload
          });

        if (response.status === 200) {
          vulnerabilities.push({
            type: 'NoSQL Injection',
            severity: 'critical',
            description: 'NoSQL injection possible in login endpoint',
            endpoint: '/api/auth/login',
            payload: JSON.stringify(payload)
          });
        }
      } catch (error) {
        // Expected - should reject malicious input
      }
    }

    // Test 3: Command Injection
    const commandPayloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '&& rm -rf /',
      '`whoami`'
    ];

    for (const payload of commandPayloads) {
      try {
        const response = await request(this.app)
          .post('/api/sources')
          .send({
            url: `https://example.com${payload}`,
            name: 'Test Source'
          });

        // Check response for signs of command execution
        if (response.text && (response.text.includes('root:') || response.text.includes('bin/bash'))) {
          vulnerabilities.push({
            type: 'Command Injection',
            severity: 'critical',
            description: 'Command injection possible in source URL processing',
            endpoint: '/api/sources',
            payload
          });
        }
      } catch (error) {
        // Expected - should reject malicious input
      }
    }

    return { vulnerabilities };
  }

  async testXSSVulnerabilities() {
    const vulnerabilities = [];

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")',
      '<svg onload="alert(1)">',
      '"><script>alert("XSS")</script>'
    ];

    const endpoints = [
      { endpoint: '/api/sources', field: 'name' },
      { endpoint: '/api/library/collections', field: 'name' },
      { endpoint: '/api/auth/register', field: 'name' }
    ];

    for (const { endpoint, field } of endpoints) {
      for (const payload of xssPayloads) {
        try {
          const response = await request(this.app)
            .post(endpoint)
            .send({ [field]: payload });

          // Check if the payload is reflected without encoding
          if (response.text && response.text.includes(payload)) {
            vulnerabilities.push({
              type: 'Cross-Site Scripting (XSS)',
              severity: 'high',
              description: `XSS vulnerability in ${endpoint} field ${field}`,
              endpoint,
              payload
            });
          }
        } catch (error) {
          // Expected - should sanitize input
        }
      }
    }

    return { vulnerabilities };
  }

  async testCSRFProtection() {
    const vulnerabilities = [];

    // Test state-changing operations without CSRF tokens
    const stateChangingEndpoints = [
      { method: 'POST', endpoint: '/api/sources', data: { url: 'https://test.com', name: 'Test' } },
      { method: 'DELETE', endpoint: '/api/sources/1' },
      { method: 'PUT', endpoint: '/api/auth/profile', data: { name: 'Hacker' } },
      { method: 'POST', endpoint: '/api/library/collections', data: { name: 'Malicious Collection' } }
    ];

    for (const { method, endpoint, data } of stateChangingEndpoints) {
      try {
        const response = await request(this.app)
          [method.toLowerCase()](endpoint)
          .send(data || {});

        // Check if the operation succeeded without CSRF protection
        if (response.status >= 200 && response.status < 300) {
          vulnerabilities.push({
            type: 'Missing CSRF Protection',
            severity: 'medium',
            description: `State-changing operation possible without CSRF token: ${method} ${endpoint}`,
            endpoint
          });
        }
      } catch (error) {
        // Expected - should require CSRF protection
      }
    }

    return { vulnerabilities };
  }

  async testRateLimiting() {
    const vulnerabilities = [];

    // Test rate limiting on various endpoints
    const endpoints = [
      '/api/auth/login',
      '/api/library/search',
      '/api/sources',
      '/api/content/discover'
    ];

    for (const endpoint of endpoints) {
      const requests = [];
      const startTime = Date.now();

      // Make rapid requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(this.app)
            .get(endpoint)
            .catch(() => ({ status: 429 })) // Handle rate limit responses
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const successCount = responses.filter(r => r.status === 200).length;
      const duration = Date.now() - startTime;

      if (rateLimitedCount === 0 && successCount > 30) {
        vulnerabilities.push({
          type: 'Insufficient Rate Limiting',
          severity: 'medium',
          description: `Endpoint allows too many requests: ${successCount}/50 succeeded in ${duration}ms`,
          endpoint
        });
      }
    }

    return { vulnerabilities };
  }

  async testDataExposure() {
    const vulnerabilities = [];

    // Test for sensitive data in responses
    const endpoints = [
      '/api/auth/profile',
      '/api/sources',
      '/api/library/content/1',
      '/api/config/preferences'
    ];

    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
      /hash/i
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request(this.app)
          .get(endpoint);

        if (response.status === 200 && response.text) {
          for (const pattern of sensitivePatterns) {
            if (pattern.test(response.text)) {
              vulnerabilities.push({
                type: 'Sensitive Data Exposure',
                severity: 'high',
                description: `Sensitive data potentially exposed in ${endpoint}`,
                endpoint,
                pattern: pattern.toString()
              });
            }
          }
        }
      } catch (error) {
        // Expected for protected endpoints
      }
    }

    // Test for stack traces in error responses
    try {
      const response = await request(this.app)
        .get('/api/nonexistent/endpoint');

      if (response.text && (response.text.includes('at ') || response.text.includes('Error:'))) {
        vulnerabilities.push({
          type: 'Information Disclosure',
          severity: 'low',
          description: 'Stack traces exposed in error responses',
          endpoint: '/api/nonexistent/endpoint'
        });
      }
    } catch (error) {
      // Expected
    }

    return { vulnerabilities };
  }

  async testSessionSecurity() {
    const vulnerabilities = [];

    // Test session fixation
    try {
      const response1 = await request(this.app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const sessionId1 = response1.headers['set-cookie']?.[0];

      const response2 = await request(this.app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const sessionId2 = response2.headers['set-cookie']?.[0];

      if (sessionId1 && sessionId2 && sessionId1 === sessionId2) {
        vulnerabilities.push({
          type: 'Session Fixation',
          severity: 'medium',
          description: 'Session ID not regenerated after login',
          endpoint: '/api/auth/login'
        });
      }
    } catch (error) {
      // Expected if sessions are properly managed
    }

    // Test session timeout
    // This would require more complex testing with time manipulation

    return { vulnerabilities };
  }

  async testAPISecurity() {
    const vulnerabilities = [];

    // Test for missing security headers
    const response = await request(this.app)
      .get('/api/health');

    const securityHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security',
      'Content-Security-Policy'
    ];

    for (const header of securityHeaders) {
      if (!response.headers[header.toLowerCase()]) {
        vulnerabilities.push({
          type: 'Missing Security Header',
          severity: 'low',
          description: `Missing security header: ${header}`,
          endpoint: '/api/health'
        });
      }
    }

    // Test for verbose error messages
    const malformedResponse = await request(this.app)
      .post('/api/sources')
      .send('invalid json');

    if (malformedResponse.text && malformedResponse.text.includes('SyntaxError')) {
      vulnerabilities.push({
        type: 'Verbose Error Messages',
        severity: 'low',
        description: 'Detailed error messages may leak information',
        endpoint: '/api/sources'
      });
    }

    return { vulnerabilities };
  }

  generateSecurityReport() {
    const allVulnerabilities = [];
    let totalTests = 0;
    let passedTests = 0;

    Object.values(this.testResults).forEach(result => {
      totalTests++;
      if (result.status === 'passed') {
        passedTests++;
        if (result.vulnerabilities) {
          allVulnerabilities.push(...result.vulnerabilities);
        }
      }
    });

    const severityCounts = {
      critical: allVulnerabilities.filter(v => v.severity === 'critical').length,
      high: allVulnerabilities.filter(v => v.severity === 'high').length,
      medium: allVulnerabilities.filter(v => v.severity === 'medium').length,
      low: allVulnerabilities.filter(v => v.severity === 'low').length
    };

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        totalVulnerabilities: allVulnerabilities.length,
        severityCounts
      },
      testResults: this.testResults,
      vulnerabilities: allVulnerabilities,
      riskScore: this.calculateRiskScore(severityCounts),
      recommendations: this.generateRecommendations(allVulnerabilities)
    };

    return report;
  }

  calculateRiskScore(severityCounts) {
    const weights = { critical: 10, high: 7, medium: 4, low: 1 };
    const score = Object.entries(severityCounts)
      .reduce((total, [severity, count]) => total + (weights[severity] * count), 0);
    
    return {
      score,
      level: score === 0 ? 'Low' : score < 20 ? 'Medium' : score < 50 ? 'High' : 'Critical'
    };
  }

  generateRecommendations(vulnerabilities) {
    const recommendations = [];

    if (vulnerabilities.some(v => v.type.includes('SQL Injection'))) {
      recommendations.push('Implement parameterized queries and input sanitization');
    }

    if (vulnerabilities.some(v => v.type.includes('XSS'))) {
      recommendations.push('Implement proper output encoding and Content Security Policy');
    }

    if (vulnerabilities.some(v => v.type.includes('Authentication'))) {
      recommendations.push('Strengthen authentication mechanisms and password policies');
    }

    if (vulnerabilities.some(v => v.type.includes('Rate Limiting'))) {
      recommendations.push('Implement proper rate limiting and DDoS protection');
    }

    if (vulnerabilities.some(v => v.type.includes('Security Header'))) {
      recommendations.push('Add missing security headers to all responses');
    }

    recommendations.push('Conduct regular security audits and penetration testing');
    recommendations.push('Implement security monitoring and alerting');

    return recommendations;
  }
}

module.exports = SecurityTestSuite;