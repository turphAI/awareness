/**
 * Default configuration for AI Information Aggregator
 * Environment-specific overrides should be in separate files
 */
module.exports = {
  app: {
    name: 'AI Information Aggregator',
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000
  },
  
  database: {
    mongodb: {
      uri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai-aggregator',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    },
    redis: {
      uri: process.env.REDIS_URI || 'redis://localhost:6379',
      options: {}
    }
  },
  
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET || 'default-jwt-secret-do-not-use-in-production',
      expiration: process.env.JWT_EXPIRATION || '1d'
    }
  },
  
  services: {
    sourceManagement: {
      url: process.env.SOURCE_MANAGEMENT_URL || 'http://source-management-service:3002'
    },
    contentDiscovery: {
      url: process.env.CONTENT_DISCOVERY_URL || 'http://content-discovery-service:3003',
      interval: parseInt(process.env.DISCOVERY_INTERVAL) || 86400000, // 24 hours in ms
      relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD) || 0.7
    },
    podcastExtraction: {
      url: process.env.PODCAST_EXTRACTION_URL || 'http://podcast-extraction-service:3004'
    },
    contentSummarization: {
      url: process.env.CONTENT_SUMMARIZATION_URL || 'http://content-summarization-service:3005'
    },
    personalization: {
      url: process.env.PERSONALIZATION_URL || 'http://personalization-service:3006'
    },
    libraryManagement: {
      url: process.env.LIBRARY_MANAGEMENT_URL || 'http://library-management-service:3007'
    },
    configurationManagement: {
      url: process.env.CONFIGURATION_MANAGEMENT_URL || 'http://configuration-management-service:3008'
    },
    authentication: {
      url: process.env.AUTHENTICATION_URL || 'http://authentication-service:3001'
    }
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4'
    }
  },
  
  email: {
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    },
    from: process.env.EMAIL_FROM || 'noreply@example.com'
  }
};