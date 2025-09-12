#!/bin/bash

echo "🚀 Starting MCP-files Server (HTTP Mode)"

# Check if directories were provided
if [ $# -eq 0 ]; then
    echo "❌ Error: No directories specified"
    echo "Usage: $0 <directory1> [directory2] [directory3] ..."
    echo "Example: $0 ~/Documents ~/Projects"
    exit 1
fi

# Display configuration
echo "📡 Port: ${PORT:-8080}"
echo "📁 Allowed directories: $@"
echo ""
echo "🌐 Server will be available at: http://localhost:${PORT:-8080}/mcp"
echo "🛑 Press Ctrl+C to stop"
echo ""

# Start the server
node dist/index.js --http --port=${PORT:-8080} "$@"
