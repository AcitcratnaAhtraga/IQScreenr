#!/bin/bash
# Script to package the extension as a ZIP file for distribution

echo "📦 Packaging IqScreenr extension..."

# Function to increment version by 0.0.1 (patch version)
increment_version() {
    local version=$1
    IFS='.' read -ra VERSION_PARTS <<< "$version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    # Increment patch version
    patch=$((patch + 1))
    
    echo "${major}.${minor}.${patch}"
}

# Read current version from manifest.json
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
echo "Current version: $CURRENT_VERSION"

# Increment version
NEW_VERSION=$(increment_version "$CURRENT_VERSION")
echo "New version: $NEW_VERSION"

# Update manifest.json
echo "Updating manifest.json..."
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" manifest.json

# Update popup/popup.html
echo "Updating popup/popup.html..."
sed -i "s/Version $CURRENT_VERSION/Version $NEW_VERSION/g" popup/popup.html

# Update index.html (both JSON-LD and footer)
echo "Updating index.html..."
sed -i "s/\"softwareVersion\": \"$CURRENT_VERSION\"/\"softwareVersion\": \"$NEW_VERSION\"/" index.html
sed -i "s/Version $CURRENT_VERSION/Version $NEW_VERSION/g" index.html

echo "✅ Version updated to $NEW_VERSION"
echo ""

# Create a temporary directory
TEMP_DIR="iqscreenr-package"
ZIP_FILE="IqScreenr.zip"

# Remove old package if exists
if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi

if [ -f "$ZIP_FILE" ]; then
    echo "Removing existing $ZIP_FILE..."
    rm -f "$ZIP_FILE"
fi

# Create package directory
mkdir "$TEMP_DIR"

# Copy necessary files (exclude development files)
echo "Copying files..."

# Copy manifest
cp manifest.json "$TEMP_DIR/"

# Copy icons
mkdir -p "$TEMP_DIR/icons"
cp -r icons/* "$TEMP_DIR/icons/" 2>/dev/null || true

# Copy popup
mkdir -p "$TEMP_DIR/popup"
cp popup/* "$TEMP_DIR/popup/"

# Copy content scripts
mkdir -p "$TEMP_DIR/content"
cp -r content/* "$TEMP_DIR/content/"

# Copy styles
mkdir -p "$TEMP_DIR/styles"
cp styles/* "$TEMP_DIR/styles/"

# Exclude unnecessary files
find "$TEMP_DIR" -name "*.backup" -delete
find "$TEMP_DIR" -name "*.py" -delete
find "$TEMP_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TEMP_DIR" -name "*.md" -not -name "README.md" -delete 2>/dev/null || true

# Create ZIP file (will overwrite if exists)
echo "Creating ZIP file..."
cd "$TEMP_DIR"
rm -f "../$ZIP_FILE"  # Ensure it's removed before creating
zip -r "../$ZIP_FILE" . -q
cd ..

# Clean up
rm -rf "$TEMP_DIR"

echo "✅ Package created: $ZIP_FILE"
echo "📁 Size: $(du -h $ZIP_FILE | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Upload $ZIP_FILE to your web server"
echo "2. Update the download link in index.js"
echo "3. Test the download on your landing page"

