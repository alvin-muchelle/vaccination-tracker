#!/bin/bash

# Set the root directory
ROOT_DIR="app/payments"

# Create the directory structure
mkdir -p "$ROOT_DIR"

# Create the files
touch "$ROOT_DIR/columns.tsx"
touch "$ROOT_DIR/data-table.tsx"
touch "$ROOT_DIR/page.tsx"

echo "Directory structure and files created successfully in: $ROOT_DIR"
