#!/bin/bash
# ==============================================================================
# JECRC UNIVERSITY COMMUNICATION PORTAL - AUTOMATED DEPLOYMENT SCRIPT
# Target Host: 172.16.2.48 (ai.jecrcuniversity.edu.in)
# Subpath: /Communication
# Non-breaking deployment for existing JU Bot, HR, Calling, etc.
# ==============================================================================

set -e

echo "=========================================================="
echo "🚀 Deploying JECRC Communication Portal..."
echo "=========================================================="

APP_DIR="/var/www/communication-portal"
NGINX_CONF="/etc/nginx/sites-available/ai-jecrc"

# 1. Create directory and set permissions
echo "📁 Setting up application directory: $APP_DIR"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# 2. Clone or pull repository
if [ -d "$APP_DIR/.git" ]; then
    echo "🔄 Pulling latest code from GitHub..."
    cd $APP_DIR
    git pull origin main
else
    echo "📥 Cloning repository from GitHub..."
    git clone https://github.com/pachoritarun/emailer-and-whatspp.git $APP_DIR
    cd $APP_DIR
fi

# 3. Build Client (React + Vite)
echo "📦 Building Frontend Client..."
cd $APP_DIR/client
npm install
npm run build
sudo chmod -R 755 $APP_DIR/client/dist

# 4. Build Server (Node.js API)
echo "📦 Building Backend Server..."
cd $APP_DIR/server
npm install
npm run build

# 5. Create .env if not exists
if [ ! -f "$APP_DIR/server/.env" ]; then
    echo "⚙️ Creating server production .env..."
    cat << 'EOF' > $APP_DIR/server/.env
PORT=4010
NODE_ENV=production
WORKER_CONCURRENCY=2

# MySQL 8.x Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=Mysqlserver469
MYSQL_DATABASE=Communication_DB
MYSQL_POOL_LIMIT=20

# WhatsApp Cloud API
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v19.0
WHATSAPP_PHONE_ID=1133153459884742
WHATSAPP_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=uni_webhook_verify_secret_token_9981

# Queue & Storage
QUEUE_MAX_RETRIES=3
QUEUE_BASE_BACKOFF_SECONDS=5
QUEUE_LOCK_TIMEOUT_SECONDS=300
UPLOAD_STORAGE_DIR=/var/www/communication-portal/server/data/uploads
EOF
fi

# 6. Start or Restart PM2 Service
echo "⚡ Managing PM2 Process (communication-api on port 4010)..."
if command -v pm2 &> /dev/null; then
    cd $APP_DIR/server
    if pm2 list | grep -q "communication-api"; then
        pm2 restart communication-api
    else
        pm2 start dist/index.js --name "communication-api"
    fi
    pm2 save
else
    echo "⚠️ PM2 not found. Installing PM2 globally..."
    sudo npm install -g pm2
    cd $APP_DIR/server
    pm2 start dist/index.js --name "communication-api"
    pm2 save
fi

# 7. Backup Nginx Configuration
if [ -f "$NGINX_CONF" ]; then
    echo "🛡️ Creating safety backup of Nginx configuration..."
    sudo cp $NGINX_CONF "${NGINX_CONF}.backup_$(date +%Y%m%d_%H%M%S)"
fi

echo "=========================================================="
echo "✅ Backend & Frontend build completed successfully!"
echo "👉 Next Step: Ensure Nginx has the /Communication block"
echo "   Test with: sudo nginx -t"
echo "   Reload with: sudo systemctl reload nginx"
echo "=========================================================="
