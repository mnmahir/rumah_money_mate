#!/bin/bash

# Rumah Money Mate - Raspberry Pi Deployment Script
# Run this script with sudo on Ubuntu 24.04

set -e

echo "🏠 Rumah Money Mate - Deployment Script"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run this script with sudo${NC}"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}
PROJECT_DIR="/home/$ACTUAL_USER/house_finance"

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}Step 2: Installing Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

echo -e "${YELLOW}Step 3: Installing PM2 globally...${NC}"
npm install -g pm2

echo -e "${YELLOW}Step 4: Installing Nginx...${NC}"
apt install -y nginx

echo -e "${YELLOW}Step 5: Installing project dependencies...${NC}"
cd "$PROJECT_DIR"
sudo -u "$ACTUAL_USER" npm run setup

echo -e "${YELLOW}Step 6: Building the application...${NC}"
sudo -u "$ACTUAL_USER" npm run build

echo -e "${YELLOW}Step 7: Running database setup and seed...${NC}"
cd "$PROJECT_DIR/server"
# Use db push instead of migrate deploy for SQLite (simpler setup)
sudo -u "$ACTUAL_USER" npx prisma db push --skip-generate || true
sudo -u "$ACTUAL_USER" npm run seed || true
cd "$PROJECT_DIR"

echo -e "${YELLOW}Step 8: Creating logs directory...${NC}"
sudo -u "$ACTUAL_USER" mkdir -p "$PROJECT_DIR/logs"

echo -e "${YELLOW}Step 9: Configuring Nginx...${NC}"
cp "$PROJECT_DIR/nginx.conf" /etc/nginx/sites-available/house-finance
ln -sf /etc/nginx/sites-available/house-finance /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

echo -e "${YELLOW}Step 10: Starting application with PM2...${NC}"
cd "$PROJECT_DIR"
sudo -u "$ACTUAL_USER" pm2 delete rumah-money-mate 2>/dev/null || true
sudo -u "$ACTUAL_USER" pm2 start ecosystem.config.js
sudo -u "$ACTUAL_USER" pm2 save

echo -e "${YELLOW}Step 11: Setting up PM2 to start on boot...${NC}"
pm2_startup=$(sudo -u "$ACTUAL_USER" pm2 startup systemd -u "$ACTUAL_USER" --hp "/home/$ACTUAL_USER" | tail -1)
eval "$pm2_startup"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "=========================================="
echo "🏠 Rumah Money Mate is now running!"
echo "=========================================="
echo ""
echo "Access the application at: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Change these credentials immediately!${NC}"
echo ""
echo "Useful commands:"
echo "  - View logs: pm2 logs rumah-money-mate"
echo "  - Restart app: pm2 restart rumah-money-mate"
echo "  - Stop app: pm2 stop rumah-money-mate"
echo "  - Check status: pm2 status"
echo ""
echo "Configuration files:"
echo "  - Environment: $PROJECT_DIR/server/.env"
echo "  - Nginx: /etc/nginx/sites-available/house-finance"
echo "  - PM2: $PROJECT_DIR/ecosystem.config.js"
echo ""
