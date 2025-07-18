# AI Information Aggregator

An application designed to help UX Designers and professionals stay current with the rapidly evolving AI and LLM space by automatically monitoring, collecting, categorizing, and summarizing relevant information from various sources.

## Project Overview

The AI Information Aggregator addresses the challenge of information overload in the AI/LLM field by providing a comprehensive system that:

- Monitors and discovers relevant content from various sources
- Extracts references from podcasts and academic papers
- Summarizes and categorizes content for easy consumption
- Provides a personalized dashboard of important information
- Organizes content in a searchable, well-structured library

## Architecture

This project follows a microservices architecture with the following components:

- Frontend Application: User interface for interacting with the system
- API Gateway: Routes requests to appropriate microservices
- Microservices:
  - Source Management Service
  - Content Discovery Service
  - Podcast Extraction Service
  - Content Summarization Service
  - Personalization Service
  - Library Management Service
  - Configuration Management Service
  - Authentication & Authorization Service

## Getting Started

### Prerequisites

- Node.js (v14+)
- Docker and Docker Compose
- MongoDB
- Redis

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/ai-information-aggregator.git
cd ai-information-aggregator
```

2. Install dependencies
```
npm install
```

3. Set up environment variables
```
cp .env.example .env
```

4. Start the development environment
```
docker-compose up -d
npm run dev
```

## Development

Each service is contained in its own directory under `/services` with its own package.json and dependencies.

Common code and utilities are shared in the `/common` directory.

## License

[MIT](LICENSE)