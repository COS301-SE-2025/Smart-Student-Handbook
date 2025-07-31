#!/bin/bash
# filepath: scripts/test.sh

# Test script for Smart Student Handbook
set -e

echo "🧪 Running all tests..."

echo "📦 Installing dependencies..."
npm ci
cd firebase-basic && npm ci && cd ..
cd functions && npm ci && cd ..

echo "🔍 Running linting..."
cd firebase-basic
npm run lint
cd ..

echo "🃏 Running Jest tests..."
cd firebase-basic
npm test -- --coverage
cd ..

echo "🔥 Testing Firebase Functions..."
cd functions
npm test
cd ..

echo "✅ All tests passed!"