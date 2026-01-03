#!/bin/bash

# Rumah Money Mate - Backup Script
# Run this regularly to backup your data

BACKUP_DIR="/home/fam/house_finance/backups"
DB_PATH="/home/fam/house_finance/server/prisma/house_finance.db"
UPLOADS_PATH="/home/fam/house_finance/server/uploads"
ENV_PATH="/home/fam/house_finance/server/.env"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR/house_finance_$TIMESTAMP.db"
    echo "✅ Database backed up: house_finance_$TIMESTAMP.db"
else
    echo "❌ Database not found at $DB_PATH"
fi

# Backup uploads (if exists and not empty)
if [ -d "$UPLOADS_PATH" ] && [ "$(ls -A $UPLOADS_PATH 2>/dev/null)" ]; then
    tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C "$(dirname $UPLOADS_PATH)" "$(basename $UPLOADS_PATH)"
    echo "✅ Uploads backed up: uploads_$TIMESTAMP.tar.gz"
else
    echo "ℹ️  No uploads to backup"
fi

# Backup .env
if [ -f "$ENV_PATH" ]; then
    cp "$ENV_PATH" "$BACKUP_DIR/env_$TIMESTAMP.txt"
    echo "✅ Environment backed up: env_$TIMESTAMP.txt"
fi

# Keep only last 10 backups (per type)
echo ""
echo "🧹 Cleaning old backups (keeping last 10)..."
cd "$BACKUP_DIR"
ls -t house_finance_*.db 2>/dev/null | tail -n +11 | xargs -r rm
ls -t uploads_*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm
ls -t env_*.txt 2>/dev/null | tail -n +11 | xargs -r rm

echo ""
echo "📁 Current backups:"
ls -lh "$BACKUP_DIR"
echo ""
echo "💡 To restore, copy files back to their original locations"
