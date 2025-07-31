# AI Information Aggregator - Vercel Deployment

This is the Vercel deployment configuration for the AI Information Aggregator application.

## Architecture

- **Frontend**: React app served as static files from `ai-information-aggregator/frontend/build`
- **Backend**: Serverless functions in the `api/` directory
- **Database**: PlanetScale MySQL (to be configured)

## Deployment

The application is automatically deployed to Vercel when changes are pushed to the main branch.

- **Production URL**: https://awareness-[hash].vercel.app
- **Custom Domain**: turph1023.com (to be configured)

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication
- `GET /api/sources` - Get user sources
- `POST /api/sources` - Create new source

## Environment Variables

Configure these in Vercel dashboard:

- `DATABASE_HOST` - PlanetScale database host
- `DATABASE_USERNAME` - Database username
- `DATABASE_PASSWORD` - Database password
- `DATABASE_NAME` - Database name
- `JWT_SECRET` - JWT signing secret

## Local Development

```bash
# Install dependencies
cd ai-information-aggregator
npm install

# Start development server
npm run dev
```

## Frontend Development

```bash
# Install frontend dependencies
cd ai-information-aggregator/frontend
npm install

# Start React development server
npm start
```