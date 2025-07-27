/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: System health check
 *     description: Check the health status of the API Gateway and all connected services
 *     security: []
 *     responses:
 *       200:
 *         description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 *             example:
 *               status: healthy
 *               timestamp: '2023-12-01T10:00:00Z'
 *               services:
 *                 healthy: ['authentication', 'sourceManagement', 'contentDiscovery']
 *                 unhealthy: []
 *                 details:
 *                   authentication:
 *                     healthy: true
 *                     lastCheck: '2023-12-01T09:59:30Z'
 *                     error: null
 *                     consecutiveFailures: 0
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /api/status:
 *   get:
 *     tags: [System]
 *     summary: Detailed system status
 *     description: Get detailed status information about the API Gateway and all services
 *     security: []
 *     responses:
 *       200:
 *         description: Detailed system status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gateway:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     uptime:
 *                       type: number
 *                       description: Gateway uptime in seconds
 *                     memory:
 *                       type: object
 *                       properties:
 *                         rss:
 *                           type: number
 *                         heapTotal:
 *                           type: number
 *                         heapUsed:
 *                           type: number
 *                         external:
 *                           type: number
 *                     version:
 *                       type: string
 *                       description: Gateway version
 *                 services:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       healthy:
 *                         type: boolean
 *                       lastCheck:
 *                         type: string
 *                         format: date-time
 *                       error:
 *                         type: string
 *                       consecutiveFailures:
 *                         type: integer
 *             example:
 *               gateway:
 *                 status: healthy
 *                 uptime: 3600
 *                 memory:
 *                   rss: 52428800
 *                   heapTotal: 29360128
 *                   heapUsed: 18874368
 *                   external: 1089024
 *                 version: '1.0.0'
 *               services:
 *                 authentication:
 *                   healthy: true
 *                   lastCheck: '2023-12-01T09:59:30Z'
 *                   error: null
 *                   consecutiveFailures: 0
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /api/versions:
 *   get:
 *     tags: [System]
 *     summary: API version information
 *     description: Get information about available API versions and endpoints
 *     security: []
 *     responses:
 *       200:
 *         description: API version information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 versions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available API versions
 *                 current:
 *                   type: string
 *                   description: Current default API version
 *                 endpoints:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *                   description: Version endpoint mappings
 *             example:
 *               versions: ['v1', 'v2']
 *               current: 'v1'
 *               endpoints:
 *                 v1: '/api/v1'
 *                 v2: '/api/v2'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */