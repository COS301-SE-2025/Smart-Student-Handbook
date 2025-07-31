#!/bin/bash
# filepath: scripts/deploy.sh

# Deployment script for Smart Student Handbook
set -e

echo "🚀 Starting deployment process..."

# Check if environment is provided
if [ -z "$1" ]; then
    echo "❌ Please specify environment: staging or production"
    exit 1
fi

ENVIRONMENT=$1

echo "📦 Installing dependencies..."
npm ci
cd firebase-basic && npm ci && cd ..
cd functions && npm ci && cd ..

echo "🧪 Running tests..."
cd firebase-basic
npm test -- --passWithNoTests
cd ..

echo "🔨 Building application..."
cd firebase-basic
npm run build
npm run export
cd ..

echo "📁 Copying files to public directory..."
rm -rf public/*
cp -r firebase-basic/out/* public/

echo "🔥 Deploying to Firebase ($ENVIRONMENT)..."
firebase use $ENVIRONMENT
firebase deploy

echo "✅ Deployment complete!"