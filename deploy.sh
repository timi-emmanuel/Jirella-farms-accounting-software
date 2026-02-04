#!/usr/bin/env bash

set -e  # Exit on any error

echo "Starting deployment..."

# Change to correct directory
cd ~/jirella-farm

# Load environment variables
if [ -f .env.local ]; then
    echo "Loading .env.local"
    set -a  # automatically export all variables
    source .env.local
    set +a  # stop automatically exporting
elif [ -f .env ]; then
    echo "Loading .env"
    set -a  # automatically export all variables
    source .env
    set +a  # stop automatically exporting
else
    echo "Warning: No .env file found"
fi

# Create network if it doesn't exist
echo "Creating Docker network..."
docker network create jnet 2>/dev/null || echo "Network jnet already exists"

# Stop existing containers
echo "Stopping existing containers..."
docker compose down 2>/dev/null || echo "No containers to stop"

# Build and start services
echo "Building and starting services..."
docker compose up -d --build

# Show running containers
echo "Running containers:"
docker ps

# Show container logs
echo "Container logs:"
docker compose logs --tail=50

echo "Deployment completed successfully"