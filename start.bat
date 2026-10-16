@echo off
echo 🚀 Starting ReLife Backend Server...
echo 📋 Make sure to:
echo    1. Set up your .env file with MongoDB connection string
echo    2. Run 'npm install' if you haven't already
echo.
echo Starting server in development mode...
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found!
    echo    Please create a .env file with your configuration.
    echo    You can copy .env.example as a starting point.
    echo.
)

REM Start the server
npm run dev
