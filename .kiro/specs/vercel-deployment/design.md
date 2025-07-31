# Vercel Deployment Design

## Overview

This design outlines the architecture for deploying the AI Information Aggregator to Vercel with PlanetScale MySQL database. This solution provides automatic scaling, global CDN distribution, and serverless architecture while maintaining the lowest possible costs through usage-based pricing.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel Platform                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   React App     │  │  API Functions  │  │   Edge Network  │ │
│  │   (Static)      │  │  (Serverless)   │  │     (CDN)       │ │
│  │                 │  │                 │  │                 │ │
│  │ • Components    │  │ • /api/auth     │  │ • Global Cache  │ │
│  │ • Routes        │  │ • /api/sources  │  │ • Auto HTTPS    │ │
│  │ • Assets        │  │ • /api/content  │  │ • Custom Domain │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Database Connection
                              ▼
                    ┌─────────────────────┐
                    │    PlanetScale      │
                    │   MySQL Database    │
                    │                     │
                    │ • Connection Pool   │
                    │ • Auto Scaling      │
                    │ • Branching         │
                    │ • Backup/Recovery   │
                    └─────────────────────┘
```

### Request Flow

```
User Request (turph1023.com)
         │
         ▼
┌─────────────────┐
│  Vercel Edge    │ ──── Static Assets (React App)
│    Network      │
└─────────────────┘
         │
         ▼ (API Requests)
┌─────────────────┐
│ Serverless      │ ──── Database Queries
│ Functions       │      
│ (/api/*)        │ ──── PlanetScale MySQL
└─────────────────┘
```

## Components and Interfaces

### 1. Frontend Architecture

**React Application Structure:**
```
frontend/
├── src/
│   ├── components/          # React components
│   ├── services/           # API service calls
│   ├── utils/              # Utility functions
│   └── App.js              # Main application
├── public/                 # Static assets
├── package.json           # Dependencies
└── vercel.json           # Vercel configuration
```

**Build Configuration:**
```json
{
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ]
}
```

### 2. Serverless Functions Architecture

**API Functions Structure:**
```
api/
├── auth/
│   ├── login.js           # POST /api/auth/login
│   ├── register.js        # POST /api/auth/register
│   └── profile.js         # GET/PUT /api/auth/profile
├── sources/
│   ├── index.js           # GET/POST /api/sources
│   ├── [id].js           # GET/PUT/DELETE /api/sources/[id]
│   └── categories.js      # GET/POST /api/sources/categories
├── content/
│   ├── discover.js        # POST /api/content/discover
│   ├── summarize.js       # POST /api/content/summarize
│   └── search.js          # GET /api/content/search
└── library/
    ├── collections.js     # GET/POST /api/library/collections
    └── interactions.js    # POST /api/library/interactions
```

**Function Template:**
```javascript
// api/sources/index.js
import { connectToDatabase } from '../../lib/database';
import { authenticate } from '../../lib/auth';

export default async function handler(req, res) {
  try {
    // Authentication
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Database connection
    const db = await connectToDatabase();

    if (req.method === 'GET') {
      const sources = await db.query(
        'SELECT * FROM sources WHERE user_id = ?',
        [user.id]
      );
      return res.json(sources);
    }

    if (req.method === 'POST') {
      const { name, url, category } = req.body;
      const result = await db.query(
        'INSERT INTO sources (user_id, name, url, category) VALUES (?, ?, ?, ?)',
        [user.id, name, url, category]
      );
      return res.json({ id: result.insertId, name, url, category });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 3. Database Design

**PlanetScale Configuration:**
```javascript
// lib/database.js
import mysql from 'mysql2/promise';

let connection;

export async function connectToDatabase() {
  if (connection) {
    return connection;
  }

  connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: {
      rejectUnauthorized: true
    }
  });

  return connection;
}
```

**Database Schema:**
```sql
-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sources table
CREATE TABLE sources (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Content table
CREATE TABLE content (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  content_type VARCHAR(50),
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Collections table
CREATE TABLE collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 4. Authentication System

**JWT-based Authentication:**
```javascript
// lib/auth.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export async function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
```

## Data Models

### Environment Variables

**Production Environment Configuration:**
```bash
# Database (PlanetScale)
DATABASE_HOST=aws.connect.psdb.cloud
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=ai_aggregator

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key_here

# External APIs (if needed)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Application
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://turph1023.com
```

### API Response Models

**Standard API Response:**
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface Source {
  id: number;
  name: string;
  url: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

interface Content {
  id: number;
  source_id: number;
  title: string;
  url: string;
  summary: string;
  content_type: string;
  discovered_at: string;
}
```

## Error Handling

### Function-Level Error Handling

**Standardized Error Responses:**
```javascript
// lib/errors.js
export class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function handleApiError(error, res) {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}
```

### Database Error Handling

**Connection and Query Error Management:**
```javascript
// lib/database.js
export async function executeQuery(query, params = []) {
  try {
    const db = await connectToDatabase();
    const [results] = await db.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database Error:', error);
    throw new ApiError('Database operation failed', 500);
  }
}
```

## Testing Strategy

### API Function Testing

**Jest Test Configuration:**
```javascript
// __tests__/api/sources.test.js
import handler from '../../api/sources/index';
import { createMocks } from 'node-mocks-http';

describe('/api/sources', () => {
  test('GET returns user sources', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### Frontend Testing

**React Component Testing:**
```javascript
// frontend/src/components/__tests__/SourceList.test.js
import { render, screen } from '@testing-library/react';
import SourceList from '../SourceList';

test('renders source list', () => {
  const sources = [
    { id: 1, name: 'Test Source', url: 'https://example.com' }
  ];

  render(<SourceList sources={sources} />);
  
  expect(screen.getByText('Test Source')).toBeInTheDocument();
});
```

## Security Considerations

### Function Security

**Input Validation:**
```javascript
// lib/validation.js
import Joi from 'joi';

export const sourceSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  url: Joi.string().uri().required(),
  category: Joi.string().max(100).optional()
});

export function validateInput(data, schema) {
  const { error, value } = schema.validate(data);
  if (error) {
    throw new ApiError(error.details[0].message, 400);
  }
  return value;
}
```

### Database Security

**SQL Injection Prevention:**
- All queries use parameterized statements
- Input validation on all user data
- Connection encryption with SSL

### Authentication Security

**JWT Security:**
- Secure secret key (256-bit minimum)
- Short token expiration (7 days)
- HTTPS-only token transmission

## Performance Optimization

### Function Optimization

**Cold Start Minimization:**
```javascript
// Shared database connection
let cachedConnection = null;

export async function connectToDatabase() {
  if (cachedConnection) {
    return cachedConnection;
  }
  
  cachedConnection = await mysql.createConnection(config);
  return cachedConnection;
}
```

### Frontend Optimization

**Build Optimization:**
- Code splitting with React.lazy()
- Image optimization with Next.js Image component
- Bundle analysis and tree shaking

## Deployment Configuration

### Vercel Configuration

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

### GitHub Actions (Optional)

**Automated Testing:**
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
```

## Cost Analysis

### Vercel Pricing

**Free Tier Limits:**
- 100GB bandwidth/month
- 100 serverless function invocations/day
- Unlimited static deployments

**Pro Tier ($20/month):**
- 1TB bandwidth/month
- 1000 serverless function invocations/day
- Advanced analytics and monitoring

### PlanetScale Pricing

**Free Tier:**
- 1 database
- 1 billion row reads/month
- 10 million row writes/month
- 5GB storage

**Scaler Plan ($29/month):**
- Unlimited databases
- 100 billion row reads/month
- 50 million row writes/month
- 50GB storage

### Total Cost Scenarios

**Development/Low Traffic:**
- Vercel: $20/month (Pro account - already paid)
- PlanetScale: $0/month (free tier)
- **Total: $20/month**

**Production/Medium Traffic:**
- Vercel: $20/month (Pro account - already paid)
- PlanetScale: $0/month (free tier sufficient)
- **Total: $20/month**

**High Traffic:**
- Vercel: $20/month (Pro account - already paid)
- PlanetScale: $29/month (Scaler tier)
- **Total: $49/month**

**Note:** Since you already have Vercel Pro, you're getting maximum value from day one with advanced analytics, better performance limits, and priority support.

## Migration Strategy

### From Current Architecture

**Phase 1: Frontend Migration**
1. Move React app to Vercel
2. Update API endpoints to point to new functions
3. Test frontend functionality

**Phase 2: API Migration**
1. Convert Express routes to Vercel functions
2. Migrate authentication system
3. Update database connections

**Phase 3: Database Migration**
1. Export data from current MongoDB
2. Transform data for MySQL schema
3. Import to PlanetScale
4. Update all database queries

**Phase 4: Domain and DNS**
1. Configure custom domain in Vercel
2. Update DNS records
3. Test SSL certificate
4. Monitor for issues