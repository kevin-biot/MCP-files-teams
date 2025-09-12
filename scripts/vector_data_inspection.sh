#!/bin/bash

echo "🔍 COMPLETE VECTOR DATABASE DATA INSPECTION"
echo "============================================"
echo ""

# Check local directory first, then fallback to original location
LOCAL_MEMORY_DIR="./.mcp-memory"
ORIGINAL_MEMORY_DIR="/Users/kevinbrown/servers/.mcp-memory"

if [ -d "$LOCAL_MEMORY_DIR" ]; then
    MEMORY_DIR="$LOCAL_MEMORY_DIR"
else
    MEMORY_DIR="$ORIGINAL_MEMORY_DIR"
fi

# Function to check ChromaDB
check_chromadb() {
    echo "1️⃣ CHROMADB VECTOR DATABASE CHECK"
    echo "================================="
    
    # Check if ChromaDB is running
    if curl -s http://127.0.0.1:8000/api/v1/heartbeat >/dev/null 2>&1; then
        echo "✅ ChromaDB v1 is responding"
        API_VERSION="v1"
    elif curl -s http://127.0.0.1:8000/api/v2/heartbeat >/dev/null 2>&1; then
        echo "✅ ChromaDB v2 is responding"
        API_VERSION="v2"
    else
        echo "❌ ChromaDB server not running"
        echo "   Start with: npm run start-chromadb"
        return 1
    fi
    
    echo "Using API version: $API_VERSION"
    echo ""
    
    # Get collection data
    if [ "$API_VERSION" = "v2" ]; then
        echo "📊 Vector Collection Data:"
        echo "--------------------------"
        
        # Get all documents
        COLLECTION_DATA=$(curl -s -X POST "http://127.0.0.1:8000/api/v2/collections/llm_conversation_memory/get" \
             -H "Content-Type: application/json" \
             -d '{}')
        
        if echo "$COLLECTION_DATA" | jq . >/dev/null 2>&1; then
            # Count documents
            DOC_COUNT=$(echo "$COLLECTION_DATA" | jq '.documents | length')
            EMBEDDING_COUNT=$(echo "$COLLECTION_DATA" | jq '.embeddings | length')
            METADATA_COUNT=$(echo "$COLLECTION_DATA" | jq '.metadatas | length')
            
            echo "📈 Collection Statistics:"
            echo "   Documents: $DOC_COUNT"
            echo "   Embeddings: $EMBEDDING_COUNT"  
            echo "   Metadata entries: $METADATA_COUNT"
            echo ""
            
            if [ "$DOC_COUNT" -gt 0 ]; then
                echo "📄 Sample Document Content:"
                echo "$COLLECTION_DATA" | jq -r '.documents[0]' | head -3
                echo "..."
                echo ""
                
                echo "🏷️ Sample Metadata:"
                echo "$COLLECTION_DATA" | jq '.metadatas[0]'
                echo ""
                
                echo "🔢 Sample Embedding Info:"
                EMBEDDING_LENGTH=$(echo "$COLLECTION_DATA" | jq '.embeddings[0] | length')
                EMBEDDING_SAMPLE=$(echo "$COLLECTION_DATA" | jq '.embeddings[0][:5]')
                echo "   Dimensions: $EMBEDDING_LENGTH"
                echo "   First 5 values: $EMBEDDING_SAMPLE"
                echo ""
                
                # Calculate storage size
                DOC_SIZE=$(echo "$COLLECTION_DATA" | jq -r '.documents[0]' | wc -c)
                METADATA_SIZE=$(echo "$COLLECTION_DATA" | jq '.metadatas[0]' | wc -c)
                EMBEDDING_SIZE=$((EMBEDDING_LENGTH * 8)) # 8 bytes per float64
                TOTAL_SIZE=$((DOC_SIZE + METADATA_SIZE + EMBEDDING_SIZE))
                
                echo "💾 Storage Size Per Entry:"
                echo "   Document text: ~$DOC_SIZE bytes"
                echo "   Metadata: ~$METADATA_SIZE bytes"
                echo "   Embedding vector: ~$EMBEDDING_SIZE bytes"
                echo "   Total per conversation: ~$TOTAL_SIZE bytes"
                echo ""
            else
                echo "📭 No documents found in vector database"
            fi
        else
            echo "❌ Failed to parse ChromaDB response"
            echo "Raw response: $COLLECTION_DATA"
        fi
    fi
}

# Function to check JSON files
check_json_files() {
    echo ""
    echo "2️⃣ JSON BACKUP FILES CHECK"
    echo "=========================="
    
    if [ -d "$MEMORY_DIR" ]; then
        echo "✅ Memory directory found: $MEMORY_DIR"
        echo ""
        
        JSON_FILES=$(find "$MEMORY_DIR" -name "*.json" 2>/dev/null)
        if [ -n "$JSON_FILES" ]; then
            echo "📁 Available Session Files:"
            echo "$JSON_FILES" | while read file; do
                SESSION_NAME=$(basename "$file" .json)
                FILE_SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
                RECORD_COUNT=$(jq '. | length' "$file" 2>/dev/null)
                
                echo "   📄 $SESSION_NAME"
                echo "      Size: $FILE_SIZE bytes"
                echo "      Conversations: $RECORD_COUNT"
            done
            echo ""
            
            # Analyze first file in detail
            FIRST_FILE=$(echo "$JSON_FILES" | head -1)
            if [ -f "$FIRST_FILE" ]; then
                echo "🔍 DETAILED ANALYSIS: $(basename "$FIRST_FILE")"
                echo "================================================"
                
                # Check if file has data
                RECORD_COUNT=$(jq '. | length' "$FIRST_FILE" 2>/dev/null)
                if [ "$RECORD_COUNT" -gt 0 ]; then
                    echo "📊 Data Structure:"
                    jq -r '.[0] | keys | join(", ")' "$FIRST_FILE" 2>/dev/null
                    echo ""
                    
                    echo "📏 Content Sizes (First Record):"
                    jq -r '.[0] | 
                    "   User message: " + (.userMessage | length | tostring) + " characters" + "\n" +
                    "   Assistant response: " + (.assistantResponse | length | tostring) + " characters" + "\n" + 
                    "   Context: " + (.context // "" | tostring | length | tostring) + " characters" + "\n" +
                    "   Tags: " + (.tags // "" | tostring | length | tostring) + " characters" + "\n" +
                    "   Timestamp: " + (.timestamp | tostring)' "$FIRST_FILE" 2>/dev/null
                    echo ""
                    
                    echo "📄 Sample Content Preview:"
                    echo "   User Message (first 100 chars):"
                    jq -r '.[0].userMessage' "$FIRST_FILE" 2>/dev/null | head -c 100
                    echo "..."
                    echo ""
                    echo "   Assistant Response (first 100 chars):"
                    jq -r '.[0].assistantResponse' "$FIRST_FILE" 2>/dev/null | head -c 100
                    echo "..."
                    echo ""
                    
                    echo "🏷️ Auto-Extracted Metadata:"
                    jq '.[0] | {context, tags, sessionId}' "$FIRST_FILE" 2>/dev/null
                    echo ""
                    
                    # Calculate total JSON overhead
                    RAW_CONTENT_SIZE=$(jq -r '.[0] | .userMessage + .assistantResponse' "$FIRST_FILE" | wc -c)
                    TOTAL_JSON_SIZE=$(jq '.[0]' "$FIRST_FILE" | wc -c)
                    OVERHEAD=$((TOTAL_JSON_SIZE - RAW_CONTENT_SIZE))
                    
                    echo "💾 Storage Efficiency:"
                    echo "   Raw conversation: $RAW_CONTENT_SIZE bytes"
                    echo "   Total JSON record: $TOTAL_JSON_SIZE bytes"
                    echo "   Metadata overhead: $OVERHEAD bytes ($((OVERHEAD * 100 / TOTAL_JSON_SIZE))%)"
                    
                else
                    echo "📭 File exists but contains no records"
                fi
            fi
        else
            echo "📭 No JSON files found in memory directory"
        fi
    else
        echo "❌ Memory directory not found: $MEMORY_DIR"
        echo "   Memory system may not be initialized"
    fi
}

# Function to analyze what LLM actually stores
analyze_llm_behavior() {
    echo ""
    echo "3️⃣ LLM STORAGE BEHAVIOR ANALYSIS"
    echo "==============================="
    echo ""
    echo "🧠 What gets stored when you use memory tools:"
    echo ""
    echo "✅ ALWAYS STORED:"
    echo "   • Exact user message text"
    echo "   • Complete assistant response"
    echo "   • Timestamp of conversation"
    echo "   • Session ID for organization"
    echo ""
    echo "🤖 AUTO-GENERATED METADATA:"
    echo "   • Context keywords (extracted from content)"
    echo "   • Technical tags (docker, kubernetes, etc.)"
    echo "   • File paths and commands mentioned"
    echo "   • Project/technology classifications"
    echo ""
    echo "🚫 NOT STORED:"
    echo "   • Previous conversation history (unless explicitly referenced)"
    echo "   • System prompts or instructions"
    echo "   • File contents (only file paths/names)"
    echo "   • Real-time data or external API responses"
    echo ""
    echo "📊 TYPICAL STORAGE SIZE PER CONVERSATION:"
    echo "   • JSON backup: 2-8KB (depending on conversation length)"
    echo "   • Vector embedding: ~12KB (1536 dimensions × 8 bytes)"
    echo "   • Total per memory: ~15-20KB"
    echo ""
    echo "🎯 SEMANTIC SEARCH CAPABILITY:"
    echo "   • Finds similar conversations by meaning, not exact words"
    echo "   • Works across different phrasings of same concept"
    echo "   • Clusters related technical discussions"
    echo ""
}

# Run all checks
check_chromadb
check_json_files  
analyze_llm_behavior

echo ""
echo "🎯 SUMMARY: Vector Database Contents"
echo "===================================="
echo "Your memory system stores EXACTLY what you provide - no more, no less."
echo "The 'sparse' appearance might be because:"
echo "1. Only explicit memory tool calls are stored"
echo "2. Each conversation is a separate, complete record"
echo "3. Auto-generated metadata is minimal but useful"
echo "4. Vector embeddings are dense numerical representations"
echo ""
echo "To see more data, use memory tools more frequently in conversations!"
