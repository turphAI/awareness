#!/bin/bash

# Setup development environment script for AI Information Aggregator

# Create necessary directories
mkdir -p logs
mkdir -p docker-volumes

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install service dependencies
echo "Installing service dependencies..."

# API Gateway
cd api-gateway
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# Services
cd services

# Source Management Service
cd source-management
npm install
cd ..

# Add more services as they are implemented
# cd content-discovery
# npm install
# cd ..

cd ..

echo "Setting up environment variables..."
cp .env.example .env

echo "Starting development environment..."
docker-compose up -d

echo "Development environment setup complete!"