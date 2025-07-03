#!/bin/bash

# Azure App Service deployment script
echo "Starting deployment for React TypeScript App..."

# Install dependencies
echo "Installing Node.js dependencies..."
npm ci --only=production

# Build the application
echo "Building the application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build completed successfully!"
    echo "Deployment ready!"
else
    echo "Build failed!"
    exit 1
fi
