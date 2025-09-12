#!/bin/bash

# Integration helper script for adding memory to MCP filesystem server
# Run this from /Users/kevinbrown/servers/src/filesystem/

echo "🚀 MCP Memory Integration Helper"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "index.ts" ]; then
    echo "❌ Please run this script from /Users/kevinbrown/servers/src/filesystem/"
    exit 1
fi

echo "✓ Found filesystem server directory"

# Install ChromaDB if not already installed
if ! npm list chromadb &> /dev/null; then
    echo "📦 Installing ChromaDB..."
    npm install chromadb
else
    echo "✓ ChromaDB already installed"
fi

# Check if memory files exist
if [ ! -f "memory-extension.ts" ] || [ ! -f "memory-tools.ts" ]; then
    echo "❌ Memory extension files not found. Please ensure memory-extension.ts and memory-tools.ts are in this directory."
    exit 1
fi

echo "✓ Memory extension files found"

# Create backup of index.ts
if [ -f "index.ts" ] && [ ! -f "index.ts.backup" ]; then
    echo "💾 Creating backup of index.ts..."
    cp index.ts index.ts.backup
    echo "✓ Backup created as index.ts.backup"
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Build successful"
else
    echo "❌ Build failed. Please check for TypeScript errors."
    exit 1
fi

# Check if Chroma is running
echo "🔍 Checking for ChromaDB..."
if curl -s http://localhost:8000/api/v1/heartbeat &> /dev/null; then
    echo "✓ ChromaDB is running on port 8000"
else
    echo "⚠️  ChromaDB not detected. Memory system will use JSON fallback."
    echo "   To enable vector search, run:"
    echo "   docker run -p 8000:8000 chromadb/chroma"
fi

# Create memory directory
MEMORY_DIR="../../../.mcp-memory"
if [ ! -d "$MEMORY_DIR" ]; then
    mkdir -p "$MEMORY_DIR"
    echo "✓ Created memory directory: $MEMORY_DIR"
else
    echo "✓ Memory directory exists: $MEMORY_DIR"
fi

echo ""
echo "🎉 Integration Complete!"
echo "======================="
echo ""
echo "Next steps:"
echo "1. Modify your index.ts file following the integration instructions"
echo "2. Test with: npm run start:http [your-directories]"
echo "3. Configure LM Studio to use the enhanced MCP server"
echo ""
echo "Memory tools now available:"
echo "• store_conversation_memory"
echo "• search_conversation_memory" 
echo "• build_context_prompt"
echo "• get_session_context"
echo "• list_memory_sessions"
echo "• delete_memory_session"
echo "• memory_status"
echo ""
echo "Happy chatting with memory! 🧠✨"
