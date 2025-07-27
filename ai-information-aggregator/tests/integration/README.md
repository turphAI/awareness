# Integration Test Suite

This directory contains comprehensive end-to-end integration tests for the AI Information Aggregator system.

## Test Structure

### 1. User Journey Tests (`userJourney.test.js`)
Tests complete user workflows from registration to content consumption:
- User registration and authentication
- Source management workflow
- Content discovery and processing
- Content library and search functionality
- Collection management
- User preferences and personalization
- Data export and privacy features
- Cross-service integration scenarios
- Error handling and resilience testing

### 2. Service Interaction Tests (`serviceInteraction.test.js`)
Tests specific service-to-service interactions:
- Content Discovery → Summarization pipeline
- User Interactions → Personalization pipeline
- Configuration → Service behavior changes
- Library Management → Search integration
- Error propagation and recovery

## Key Test Scenarios

### Authentication & Authorization
- User registration and login flows
- JWT token validation across services
- Role-based access control
- Secure credential storage and retrieval

### Content Processing Pipeline
- Source validation and storage
- Automated content discovery
- Content summarization and analysis
- Reference extraction and linking
- Metadata extraction and indexing

### Personalization Engine
- User interest profile building
- Content relevance scoring
- Interaction-based learning
- Personalized recommendations

### Search & Library Management
- Full-text search functionality
- Metadata-based filtering
- Related content identification
- Collection management
- Content aging and updates

### Configuration Management
- User preference updates
- System behavior modifications
- Notification settings
- Content volume controls

## Running Tests

### Prerequisites
- MongoDB (for testing database)
- Redis (for caching and sessions)
- Node.js and npm dependencies

### Commands
```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npx jest tests/integration/userJourney.test.js

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:integration -- --watch
```

### Environment Setup
Tests use in-memory MongoDB and Redis instances for isolation. The setup is handled automatically in `setup.js`.

## Test Data Management

### Database Cleanup
- Each test starts with a clean database state
- Collections are cleared between tests
- Redis cache is flushed between tests

### Test User Creation
- Fresh test users are created for each test suite
- Authentication tokens are generated for API calls
- User data is isolated between tests

## Coverage Requirements

Integration tests should maintain:
- **Service Integration**: 100% of service-to-service interactions
- **API Endpoints**: 90% of public API endpoints
- **User Journeys**: 100% of critical user workflows
- **Error Scenarios**: 80% of error handling paths

## Debugging Integration Tests

### Common Issues
1. **Database Connection**: Ensure MongoDB is running or in-memory server starts
2. **Service Dependencies**: Check that all required services are properly mocked
3. **Async Operations**: Use proper async/await patterns for database operations
4. **Test Isolation**: Ensure tests don't depend on each other's state

### Debugging Tips
```bash
# Run with verbose output
npm run test:integration -- --verbose

# Run single test with debugging
node --inspect-brk node_modules/.bin/jest tests/integration/userJourney.test.js

# Check test coverage
npm run test:integration -- --coverage --coverageReporters=text
```

## Performance Considerations

### Test Execution Time
- Individual tests should complete within 10 seconds
- Full suite should complete within 5 minutes
- Use `testTimeout` configuration for longer operations

### Resource Usage
- Monitor memory usage during test execution
- Clean up resources properly in teardown
- Use connection pooling for database operations

## Continuous Integration

### CI/CD Pipeline Integration
```yaml
# Example GitHub Actions configuration
- name: Run Integration Tests
  run: |
    npm install
    npm run test:integration
  env:
    NODE_ENV: test
    MONGODB_URI: mongodb://localhost:27017/test
    REDIS_URL: redis://localhost:6379
```

### Test Reporting
- JUnit XML reports for CI systems
- Coverage reports in multiple formats
- Test result artifacts for debugging

## Maintenance

### Adding New Tests
1. Follow existing test structure and naming conventions
2. Include proper setup and teardown
3. Test both success and failure scenarios
4. Document any special requirements

### Updating Tests
1. Keep tests in sync with API changes
2. Update test data when models change
3. Maintain backward compatibility where possible
4. Review and update documentation

### Performance Monitoring
- Track test execution times
- Monitor resource usage trends
- Identify and optimize slow tests
- Regular review of test effectiveness