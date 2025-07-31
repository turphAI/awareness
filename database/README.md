# PlanetScale Database Setup

This directory contains the MySQL schema and connection utilities for the AI Information Aggregator application deployed on Vercel with PlanetScale.

## Files

- `schema.sql` - Complete MySQL schema converted from MongoDB models
- `connection.js` - Database connection utility with connection pooling
- `README.md` - This documentation file

## Setup Instructions

### 1. Create PlanetScale Account and Database

1. Go to [PlanetScale](https://planetscale.com) and create an account
2. Create a new database named `ai-information-aggregator`
3. Create a branch (e.g., `main` or `development`)
4. Get your connection credentials from the PlanetScale dashboard

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your PlanetScale credentials:

```bash
cp .env.example .env
```

Update the following variables in `.env`:

```env
DATABASE_HOST=aws.connect.psdb.cloud
DATABASE_USERNAME=your_planetscale_username
DATABASE_PASSWORD=your_planetscale_password
DATABASE_NAME=ai-information-aggregator
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up Database Schema

Run the setup script to create all tables:

```bash
npm run setup-db
```

This will:
- Test the database connection
- Create all required tables with proper indexes
- Verify the schema was created successfully

### 5. Test Database Connection

Verify everything is working:

```bash
npm run test-db
```

This will:
- Test basic connectivity
- Run sample CRUD operations
- Verify all tables exist

## Schema Overview

The MySQL schema includes the following main tables:

### Core Tables
- `users` - User accounts and preferences
- `sources` - Information sources (websites, blogs, etc.)
- `content` - Discovered content items
- `categories` - Source categorization

### Library Management
- `collections` - User-created content collections
- `collection_content` - Many-to-many mapping for collections
- `collection_collaborators` - Collection sharing and permissions
- `interactions` - User interactions with content

### Configuration
- `digest_scheduling` - User digest preferences
- `content_volume_settings` - Content volume limits
- `discovery_settings` - Content discovery preferences
- `summary_preferences` - Summarization preferences
- `topic_preferences` - User topic interests
- `notification_settings` - Notification preferences

### Specialized Tables
- `content_references` - Relationships between content items
- `interest_profiles` - Personalization data
- `credentials` - Encrypted external service credentials
- `podcasts` - Podcast-specific data
- `podcast_episodes` - Individual podcast episodes
- `podcast_transcripts` - Episode transcripts

## Key Features

### JSON Columns
The schema uses JSON columns for flexible data storage where appropriate:
- User preferences and settings
- Content metadata
- Processing history
- Interaction metadata

### Indexes
Comprehensive indexing for optimal query performance:
- Primary keys on all tables
- Foreign key indexes
- Composite indexes for common query patterns
- Text search indexes where needed

### Relationships
Proper foreign key relationships with appropriate cascade rules:
- `CASCADE` for dependent data (e.g., user content)
- `SET NULL` for optional references
- `RESTRICT` for critical relationships

## Connection Management

The `connection.js` utility provides:

- **Connection Pooling**: Efficient connection reuse
- **Error Handling**: Comprehensive error catching and logging
- **Transaction Support**: Multi-query transactions
- **Schema Management**: Table creation and validation
- **Health Checks**: Connection testing utilities

### Usage Example

```javascript
const dbConnection = require('./database/connection');

// Simple query
const users = await dbConnection.query('SELECT * FROM users WHERE active = ?', [true]);

// Transaction
const results = await dbConnection.transaction([
  { sql: 'INSERT INTO users (email, name) VALUES (?, ?)', params: ['test@example.com', 'Test'] },
  { sql: 'INSERT INTO sources (name, url, created_by) VALUES (?, ?, ?)', params: ['Test Source', 'https://example.com', 1] }
]);
```

## Migration from MongoDB

The schema is designed to accommodate all data from the existing MongoDB models:

### Data Type Mappings
- `ObjectId` → `INT AUTO_INCREMENT`
- `String` → `VARCHAR` or `TEXT`
- `Number` → `INT`, `DECIMAL`, or `BIGINT`
- `Boolean` → `BOOLEAN`
- `Date` → `DATETIME` or `TIMESTAMP`
- `Array` → `JSON` column
- `Object` → `JSON` column

### Relationship Handling
- MongoDB references → Foreign keys
- Embedded documents → JSON columns or separate tables
- Arrays of references → Junction tables

## Performance Considerations

### Indexing Strategy
- Primary keys for all tables
- Foreign key indexes for joins
- Composite indexes for common query patterns
- JSON path indexes for frequently queried JSON fields

### Connection Pooling
- Maximum 10 concurrent connections
- Connection reuse to minimize overhead
- Automatic reconnection on failure

### Query Optimization
- Parameterized queries to prevent SQL injection
- Efficient JOIN patterns
- Proper use of LIMIT and pagination

## Security

### Data Protection
- Encrypted credential storage using AES-256
- Parameterized queries prevent SQL injection
- SSL/TLS encryption for all connections

### Access Control
- User-based data isolation
- Role-based permissions in collections
- Audit trail through interaction tracking

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check PlanetScale connection limits
   - Verify network connectivity
   - Increase timeout values if needed

2. **Schema Creation Errors**
   - Ensure database is empty or compatible
   - Check for naming conflicts
   - Verify user permissions

3. **Performance Issues**
   - Review query patterns
   - Check index usage with EXPLAIN
   - Monitor connection pool utilization

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=database:*
```

## Monitoring

### Health Checks
- Connection pool status
- Query performance metrics
- Error rate monitoring
- Schema validation

### Metrics to Track
- Connection pool utilization
- Query execution times
- Error rates by query type
- Database size and growth

## Backup and Recovery

PlanetScale provides:
- Automatic daily backups
- Point-in-time recovery
- Branch-based development workflow
- Schema change management

## Next Steps

After successful setup:

1. **Test API Functions**: Verify serverless functions work with new database
2. **Data Migration**: Import existing data from MongoDB (if applicable)
3. **Performance Testing**: Load test with realistic data volumes
4. **Monitoring Setup**: Configure alerts and monitoring
5. **Production Deployment**: Deploy to Vercel with production database