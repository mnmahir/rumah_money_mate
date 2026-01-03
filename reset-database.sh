#!/bin/bash

# Rumah Money Mate - Database Reset Script
# ⚠️  WARNING: This will DELETE ALL DATA permanently!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="$PROJECT_DIR/server/prisma/house_finance.db"

clear
echo ""
echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║   ██████╗  █████╗ ███╗   ██╗ ██████╗ ███████╗██████╗ ██╗██╗    ║${NC}"
echo -e "${RED}║   ██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔════╝██╔══██╗██║██║    ║${NC}"
echo -e "${RED}║   ██║  ██║███████║██╔██╗ ██║██║  ███╗█████╗  ██████╔╝██║██║    ║${NC}"
echo -e "${RED}║   ██║  ██║██╔══██║██║╚██╗██║██║   ██║██╔══╝  ██╔══██╗╚═╝╚═╝    ║${NC}"
echo -e "${RED}║   ██████╔╝██║  ██║██║ ╚████║╚██████╔╝███████╗██║  ██║██╗██╗    ║${NC}"
echo -e "${RED}║   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝╚═╝    ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}║              DATABASE RESET SCRIPT                             ║${NC}"
echo -e "${RED}║                                                                ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Warning 1
echo -e "${RED}${BOLD}⚠️  WARNING #1: THIS ACTION IS IRREVERSIBLE!${NC}"
echo ""
echo "This script will permanently delete:"
echo "  • All users and their profiles"
echo "  • All expenses and expense splits"
echo "  • All payments and payment history"
echo "  • All categories (custom and default)"
echo "  • All recurring expenses"
echo "  • All split bills"
echo "  • All settings"
echo "  • All uploaded receipts and images"
echo ""
echo -e "${YELLOW}Database location: $DB_FILE${NC}"
echo ""

read -p "Do you understand this will DELETE ALL DATA? (yes/no): " confirm1
if [ "$confirm1" != "yes" ]; then
    echo -e "${GREEN}✅ Reset cancelled. Your data is safe.${NC}"
    exit 0
fi

echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Warning 2
echo -e "${RED}${BOLD}⚠️  WARNING #2: HAVE YOU MADE A BACKUP?${NC}"
echo ""
echo "Before proceeding, you should backup your data:"
echo "  • Run: ./backup.sh"
echo "  • Or manually copy: server/prisma/house_finance.db"
echo ""
echo -e "${YELLOW}Last modified: $(stat -c '%y' "$DB_FILE" 2>/dev/null || echo 'Database not found')${NC}"
echo ""

read -p "Have you backed up your data or don't need it? (yes/no): " confirm2
if [ "$confirm2" != "yes" ]; then
    echo -e "${GREEN}✅ Reset cancelled. Please backup your data first.${NC}"
    exit 0
fi

echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Warning 3
echo -e "${RED}${BOLD}⚠️  WARNING #3: FINAL CONFIRMATION${NC}"
echo ""
echo "You are about to:"
echo "  1. Delete the database file"
echo "  2. Delete all uploaded files (receipts, avatars, QR codes)"
echo "  3. Recreate empty database with schema"
echo "  4. Seed with default categories and admin user"
echo ""
echo -e "${RED}${BOLD}Type 'DELETE ALL DATA' to proceed:${NC}"
read -p "> " confirm3

if [ "$confirm3" != "DELETE ALL DATA" ]; then
    echo -e "${GREEN}✅ Reset cancelled. Your data is safe.${NC}"
    exit 0
fi

echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Final countdown
echo -e "${YELLOW}${BOLD}Starting database reset in:${NC}"
for i in 5 4 3 2 1; do
    echo -e "${RED}  $i...${NC}"
    sleep 1
done

echo ""
echo -e "${YELLOW}🗑️  Deleting database...${NC}"

# Delete database file
if [ -f "$DB_FILE" ]; then
    rm -f "$DB_FILE"
    rm -f "$DB_FILE-journal" 2>/dev/null || true
    echo "  ✓ Database file deleted"
else
    echo "  ℹ Database file not found (already deleted?)"
fi

# Delete uploaded files
echo -e "${YELLOW}🗑️  Deleting uploaded files...${NC}"
rm -rf "$PROJECT_DIR/server/uploads/receipts/"* 2>/dev/null || true
rm -rf "$PROJECT_DIR/server/uploads/avatars/"* 2>/dev/null || true
rm -rf "$PROJECT_DIR/server/uploads/qrcodes/"* 2>/dev/null || true
echo "  ✓ Upload directories cleared"

# Recreate database
echo -e "${YELLOW}🔄 Recreating database schema...${NC}"
cd "$PROJECT_DIR/server"
npx prisma db push --skip-generate
echo "  ✓ Database schema created"

# Run seed
echo -e "${YELLOW}🌱 Seeding default data...${NC}"
npm run seed
echo "  ✓ Default data seeded"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║   ✅ DATABASE RESET COMPLETE!                                  ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║   Default admin credentials:                                   ║${NC}"
echo -e "${GREEN}║     Username: admin                                            ║${NC}"
echo -e "${GREEN}║     Password: admin123                                         ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║   ⚠️  Remember to change the password!                          ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Restart the server to apply changes:${NC}"
echo "  pm2 restart rumah-money-mate"
echo ""
