#!/bin/bash

echo "🚀 Starting ReLife Backend Server..."
echo "📋 Make sure to:"
echo "   1. Set up your .env file with MongoDB connection string"
echo "   2. Run 'npm install' if you haven't already"
echo ""
echo "Starting server in development mode..."
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "   Please create a .env file with your configuration."
    echo "   You can copy .env.example as a starting point."
    echo ""
fi

# Start the server
npm run dev
