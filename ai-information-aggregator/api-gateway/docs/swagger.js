/**
 * Swagger/OpenAPI documentation configuration
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Information Aggregator API',
      version: '1.0.0',
      description: 'API Gateway for the AI Information Aggregator system that helps UX Designers and professionals stay current with AI/LLM developments.',
      contact: {
        name: 'API Support',
        email: 'support@ai-aggregator.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.ai-aggregator.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp'
            }
          },
          required: ['error', 'message']
        },
        RateLimitError: {
          allOf: [
            { $ref: '#/components/schemas/Error' },
            {
              type: 'object',
              properties: {
                retryAfter: {
                  type: 'integer',
                  description: 'Seconds to wait before retrying'
                }
              }
            }
          ]
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            name: {
              type: 'string',
              description: 'User display name'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'super_admin'],
              description: 'User role'
            },
            created: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          },
          required: ['id', 'email', 'name', 'role']
        },
        Source: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique source identifier'
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Source URL'
            },
            name: {
              type: 'string',
              description: 'Source display name'
            },
            type: {
              type: 'string',
              enum: ['website', 'blog', 'academic', 'podcast', 'social'],
              description: 'Source type'
            },
            categories: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Source categories'
            },
            relevanceScore: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Source relevance score'
            },
            active: {
              type: 'boolean',
              description: 'Whether source is actively monitored'
            }
          },
          required: ['id', 'url', 'name', 'type']
        },
        Content: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique content identifier'
            },
            sourceId: {
              type: 'string',
              description: 'Source identifier'
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Content URL'
            },
            title: {
              type: 'string',
              description: 'Content title'
            },
            author: {
              type: 'string',
              description: 'Content author'
            },
            publishDate: {
              type: 'string',
              format: 'date-time',
              description: 'Publication date'
            },
            type: {
              type: 'string',
              enum: ['article', 'paper', 'podcast', 'video', 'social'],
              description: 'Content type'
            },
            categories: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Content categories'
            },
            summary: {
              type: 'string',
              description: 'AI-generated summary'
            },
            keyInsights: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Key insights extracted from content'
            },
            relevanceScore: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Content relevance score'
            }
          },
          required: ['id', 'sourceId', 'title', 'type']
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
              description: 'Overall system health'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Health check timestamp'
            },
            services: {
              type: 'object',
              properties: {
                healthy: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'List of healthy services'
                },
                unhealthy: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'List of unhealthy services'
                },
                details: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      healthy: {
                        type: 'boolean'
                      },
                      lastCheck: {
                        type: 'string',
                        format: 'date-time'
                      },
                      error: {
                        type: 'string'
                      },
                      consecutiveFailures: {
                        type: 'integer'
                      }
                    }
                  }
                }
              }
            }
          },
          required: ['status', 'timestamp']
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Authentication required',
                message: 'Authorization header is missing'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Access denied',
                message: 'Insufficient permissions to access this resource'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RateLimitError'
              },
              example: {
                error: 'Rate limit exceeded',
                message: 'Too many requests, please try again later',
                retryAfter: 300
              }
            }
          },
          headers: {
            'RateLimit-Limit': {
              description: 'Request limit per window',
              schema: {
                type: 'integer'
              }
            },
            'RateLimit-Remaining': {
              description: 'Remaining requests in current window',
              schema: {
                type: 'integer'
              }
            },
            'RateLimit-Reset': {
              description: 'Window reset time',
              schema: {
                type: 'string',
                format: 'date-time'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Not found',
                message: 'The requested resource was not found'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Internal server error',
                message: 'An unexpected error occurred'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Sources',
        description: 'Information source management'
      },
      {
        name: 'Content',
        description: 'Content discovery and management'
      },
      {
        name: 'Podcasts',
        description: 'Podcast processing and reference extraction'
      },
      {
        name: 'Summarization',
        description: 'Content summarization and analysis'
      },
      {
        name: 'Personalization',
        description: 'User personalization and recommendations'
      },
      {
        name: 'Library',
        description: 'Content library and organization'
      },
      {
        name: 'Configuration',
        description: 'System configuration and preferences'
      },
      {
        name: 'System',
        description: 'System health and monitoring'
      }
    ]
  },
  apis: [
    './docs/paths/*.js',
    './routes/*.js',
    './middleware/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
  options
};