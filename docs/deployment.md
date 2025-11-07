# Deployment Guide

## Production Setup

This guide covers deploying the WhatsApp Message Forwarder to production environments, including server configuration, process management, and monitoring.

## Pre-Deployment Checklist

- [ ] Node.js 18+ installed on server
- [ ] Chrome/Chromium installed on server
- [ ] Environment variables configured
- [ ] Log directory created with write permissions
- [ ] Process manager installed (PM2, systemd, etc.)
- [ ] Firewall rules configured (if applicable)
- [ ] SSL/TLS configured (if using reverse proxy)
- [ ] Backup strategy defined
- [ ] Monitoring setup configured

## Environment Variables

### Production Configuration

Create a `.env` file with production settings:

```env
# Source community names
SOURCE_COMMUNITY_NAMES=ProductionCommunity

# Announcement group names
ANNOUNCEMENT_GROUP_NAMES=Announcements

# Target group name
TARGET_GROUP_NAME=Customer Group Name

# Price multiplier
GLOBAL_PRICE_MULTIPLIER=3

# Deduplication window (seconds)
DEDUPE_WINDOW_SECONDS=10

# Media send delay (milliseconds)
MEDIA_SEND_DELAY_MS=20000

# Log file path (use absolute path in production)
LOG_PATH=/var/log/whatsapp-forwarder/wh_relay.log

# Headless mode (required for servers)
HEADLESS=true
```

### Environment Variable Security

- Store `.env` file outside version control
- Use secure secret management in cloud environments (AWS Secrets Manager, Azure Key Vault, etc.)
- Restrict file permissions: `chmod 600 .env`
- Rotate credentials regularly
- Never commit `.env` to version control

## Build Commands

### Option 1: Standalone Executable

Build platform-specific executable:

```bash
npm run build
```

Deploy the executable from `bin/` directory:

```bash
# Copy executable to server
scp bin/whatsapp-forwarder-linux-x64 user@server:/opt/whatsapp-forwarder/

# Make executable
chmod +x /opt/whatsapp-forwarder/whatsapp-forwarder-linux-x64
```

### Option 2: Node.js Application

Deploy as Node.js application:

```bash
# Copy project files
scp -r . user@server:/opt/whatsapp-forwarder/

# Install dependencies
cd /opt/whatsapp-forwarder
npm install --production
```

## Hosting Configuration

### Linux Server Deployment

#### Using PM2 (Recommended)

1. **Install PM2**:
```bash
npm install -g pm2
```

2. **Create PM2 ecosystem file** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-forwarder',
    script: 'src/index.js',
    cwd: '/opt/whatsapp-forwarder',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/whatsapp-forwarder/error.log',
    out_file: '/var/log/whatsapp-forwarder/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

3. **Start application**:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

4. **Useful PM2 commands**:
```bash
pm2 status
pm2 logs whatsapp-forwarder
pm2 restart whatsapp-forwarder
pm2 stop whatsapp-forwarder
```

#### Using systemd

1. **Create systemd service file** (`/etc/systemd/system/whatsapp-forwarder.service`):
```ini
[Unit]
Description=WhatsApp Message Forwarder
After=network.target

[Service]
Type=simple
User=whatsapp
WorkingDirectory=/opt/whatsapp-forwarder
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/whatsapp-forwarder/src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

2. **Enable and start service**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-forwarder
sudo systemctl start whatsapp-forwarder
sudo systemctl status whatsapp-forwarder
```

### Docker Deployment

1. **Create Dockerfile**:
```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create log directory
RUN mkdir -p /var/log/whatsapp-forwarder

VOLUME ["/var/log/whatsapp-forwarder", "/app/.wwebjs_auth"]

CMD ["node", "src/index.js"]
```

2. **Create docker-compose.yml**:
```yaml
version: '3.8'

services:
  whatsapp-forwarder:
    build: .
    container_name: whatsapp-forwarder
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./logs:/var/log/whatsapp-forwarder
      - ./auth:/app/.wwebjs_auth
    network_mode: host
```

3. **Build and run**:
```bash
docker-compose build
docker-compose up -d
```

### Windows Server Deployment

#### Using NSSM (Non-Sucking Service Manager)

1. **Download NSSM** from [nssm.cc](https://nssm.cc/download)

2. **Install service**:
```cmd
nssm install WhatsAppForwarder "C:\Program Files\nodejs\node.exe" "C:\opt\whatsapp-forwarder\src\index.js"
nssm set WhatsAppForwarder AppDirectory "C:\opt\whatsapp-forwarder"
nssm set WhatsAppForwarder AppStdout "C:\opt\whatsapp-forwarder\logs\output.log"
nssm set WhatsAppForwarder AppStderr "C:\opt\whatsapp-forwarder\logs\error.log"
nssm start WhatsAppForwarder
```

#### Using Task Scheduler

1. Create a scheduled task that runs at system startup
2. Set action to run: `node.exe C:\opt\whatsapp-forwarder\src\index.js`
3. Set working directory: `C:\opt\whatsapp-forwarder`
4. Configure to run whether user is logged on or not

## Log Management

### Log Rotation

#### Linux (logrotate)

Create `/etc/logrotate.d/whatsapp-forwarder`:
```
/var/log/whatsapp-forwarder/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    missingok
    create 0644 whatsapp whatsapp
    sharedscripts
    postrotate
        systemctl reload whatsapp-forwarder > /dev/null 2>&1 || true
    endscript
}
```

#### Windows (PowerShell Script)

Create log rotation script:
```powershell
$logPath = "C:\opt\whatsapp-forwarder\logs"
$maxAge = 7 # days

Get-ChildItem "$logPath\*.log" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$maxAge)
} | Remove-Item
```

## Monitoring

### Health Checks

Create a simple health check script:

```bash
#!/bin/bash
# healthcheck.sh

LOG_FILE="/var/log/whatsapp-forwarder/wh_relay.log"
MAX_AGE=300 # 5 minutes

if [ -f "$LOG_FILE" ]; then
    LAST_MODIFIED=$(stat -c %Y "$LOG_FILE")
    CURRENT_TIME=$(date +%s)
    AGE=$((CURRENT_TIME - LAST_MODIFIED))
    
    if [ $AGE -gt $MAX_AGE ]; then
        echo "ERROR: Log file not updated in $AGE seconds"
        exit 1
    fi
fi

exit 0
```

### Monitoring Tools

- **PM2 Monitoring**: Built-in monitoring with `pm2 monit`
- **System Metrics**: Use tools like Grafana + Prometheus
- **Log Aggregation**: Use ELK stack or similar
- **Uptime Monitoring**: Use external services like UptimeRobot

## Backup Strategy

### What to Backup

1. **Session Data**: `.wwebjs_auth/` directory (contains authentication tokens)
2. **Configuration**: `.env` file (securely, with encryption)
3. **Logs**: Log files for auditing
4. **Application Code**: Source code and dependencies

### Backup Schedule

- **Session Data**: Daily (critical - losing this requires re-authentication)
- **Configuration**: Weekly or on changes
- **Logs**: Weekly (retain for 30 days)
- **Application Code**: On version updates

### Backup Script Example

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/whatsapp-forwarder"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR/$DATE"

# Backup auth data
cp -r /opt/whatsapp-forwarder/.wwebjs_auth "$BACKUP_DIR/$DATE/"

# Backup configuration (encrypted)
gpg -c /opt/whatsapp-forwarder/.env > "$BACKUP_DIR/$DATE/.env.gpg"

# Backup logs
tar -czf "$BACKUP_DIR/$DATE/logs.tar.gz" /var/log/whatsapp-forwarder/

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -type d -mtime +30 -exec rm -rf {} \;
```

## Security Considerations

### File Permissions

```bash
# Restrict .env file
chmod 600 .env
chown whatsapp:whatsapp .env

# Restrict auth directory
chmod 700 .wwebjs_auth
chown whatsapp:whatsapp .wwebjs_auth

# Log directory
chmod 755 /var/log/whatsapp-forwarder
chown whatsapp:whatsapp /var/log/whatsapp-forwarder
```

### Firewall Configuration

If running on a server with firewall:

```bash
# Allow outbound connections (WhatsApp Web)
# No inbound ports needed for basic operation
```

### Network Security

- Run behind VPN if possible
- Use secure network connections
- Monitor for unusual activity
- Implement rate limiting if exposed via API

## Troubleshooting Production Issues

### Application Won't Start

1. Check Node.js version: `node --version`
2. Verify dependencies: `npm install`
3. Check file permissions
4. Review error logs

### Authentication Issues

1. Verify QR code can be scanned (if headless=false for initial setup)
2. Check `.wwebjs_auth/` directory permissions
3. Clear auth data and re-authenticate if needed
4. Verify internet connectivity

### High Memory Usage

1. Monitor with `pm2 monit` or similar
2. Adjust `max_memory_restart` in PM2 config
3. Review log file size (rotate if needed)
4. Check for memory leaks in message processing

### Message Forwarding Not Working

1. Verify groups are found (check logs)
2. Confirm group names match exactly
3. Check announcement channel settings
4. Review deduplication window settings
5. Verify target group exists and bot has permissions

## Maintenance

### Regular Tasks

- **Weekly**: Review logs for errors
- **Monthly**: Update dependencies (`npm update`)
- **Quarterly**: Review and update configuration
- **As needed**: Clear old log files

### Update Procedure

1. Backup current installation
2. Pull latest code: `git pull` (or copy new files)
3. Install dependencies: `npm install`
4. Test in staging environment
5. Deploy to production
6. Restart service: `pm2 restart whatsapp-forwarder`
7. Monitor logs for issues

## Performance Optimization

### Resource Limits

- **Memory**: 512MB - 1GB recommended
- **CPU**: 1 core sufficient for most workloads
- **Disk**: 1GB for application + logs

### Optimization Tips

- Use headless mode in production
- Implement log rotation
- Monitor and optimize price regex performance
- Consider database-backed deduplication for high volume

## Support and Maintenance

For issues and support:
- Check logs first: `/var/log/whatsapp-forwarder/wh_relay.log`
- Review [Installation Guide](installation.md) for setup issues
- Check [Architecture Documentation](architecture.md) for system understanding

