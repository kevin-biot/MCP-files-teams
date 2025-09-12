#!/bin/bash

echo "🚀 Starting MCP-files Server (Stdio Mode)"

# Check if directories were provided
if [ $# -eq 0 ]; then
    echo "❌ Error: No directories specified"
    echo "Usage: $0 <directory1> [directory2] [directory3] ..."
    echo "Example: $0 ~/Documents ~/Projects"
    exit 1
fi

# Display configuration
echo "📁 Allowed directories: $@" >&2
echo "🔗 Starting stdio mode for Claude Desktop integration" >&2
echo "" >&2

# Start the server in stdio mode
node dist/index.js "$@"
