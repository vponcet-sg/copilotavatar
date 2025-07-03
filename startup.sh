#!/bin/bash

# Azure App Service startup script for React TypeScript App
echo "Starting Azure App Service deployment..."

# Change to the app directory
cd /home/site/wwwroot

# Install dependencies if node_modules doesn't exist or is incomplete
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.installed" ]; then
    echo "Installing dependencies..."
    npm ci --only=production
    touch node_modules/.installed
fi

# Build the application if dist doesn't exist or is empty
if [ ! -d "dist" ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
    echo "Building application..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "Build failed! Trying to install all dependencies..."
        npm ci
        npm run build
        if [ $? -ne 0 ]; then
            echo "Build still failed!"
            exit 1
        fi
    fi
    echo "Build completed successfully!"
else
    echo "Build artifacts found, skipping build..."
fi

# Check if server.js exists
if [ ! -f "server.js" ]; then
    echo "Error: server.js not found!"
    exit 1
fi

# Start the server
echo "Starting server on port ${PORT:-8080}..."
exec node server.js
