# Installation Guide

## Requirements

### System Requirements

- **Operating System**: Windows, Linux, or macOS
- **Node.js**: Version 18 or higher
- **Chrome/Chromium**: Google Chrome or Chromium browser (optional, falls back to bundled Chromium)
- **Memory**: Minimum 512MB RAM (1GB recommended)
- **Disk Space**: 100MB for application and dependencies

### Software Dependencies

- Node.js and npm (comes with Node.js)
- Google Chrome (recommended) or Chromium
- Git (for cloning repository)

## Environment Setup

### 1. Install Node.js

Download and install Node.js from [nodejs.org](https://nodejs.org/). Verify installation:

```bash
node --version
npm --version
```

Both commands should show version 18 or higher.

### 2. Install Google Chrome (Recommended)

While the application can use bundled Chromium, system Chrome is recommended for better compatibility:

**Windows**:
- Download from [google.com/chrome](https://www.google.com/chrome/)
- Install to default location: `C:\Program Files\Google\Chrome\Application\chrome.exe`

**Linux**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Or use Chromium
sudo apt-get install -y chromium-browser
```

**macOS**:
- Download from [google.com/chrome](https://www.google.com/chrome/)
- Install to Applications folder

### 3. Clone Repository

```bash
git clone <repository-url>
cd fornecedorxclientes
```

If you don't have Git, download the repository as a ZIP file and extract it.

## Local Execution Instructions

### 1. Install Dependencies

Navigate to the project directory and install Node.js dependencies:

```bash
npm install
```

This will install:
- `whatsapp-web.js` - WhatsApp Web integration
- `pino` - Structured logging
- `qrcode-terminal` - QR code display
- `dotenv` - Environment variable management
- `pkg` - Build tool (dev dependency)

### 2. Create Environment File

Create a `.env` file in the project root directory:

```bash
# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env
```

If no `.env.example` exists, create `.env` manually with the following content:

```env
# Source community names (comma-separated)
SOURCE_COMMUNITY_NAMES=Community1,Community2

# Announcement group names (comma-separated)
ANNOUNCEMENT_GROUP_NAMES=Announcements,Updates

# Target group name (exact match required)
TARGET_GROUP_NAME=OJ® Streetwear Shop & Sneakers

# Price multiplier (decimal supported)
GLOBAL_PRICE_MULTIPLIER=3

# Deduplication window in seconds
DEDUPE_WINDOW_SECONDS=10

# Delay before sending text after media (milliseconds)
MEDIA_SEND_DELAY_MS=20000

# Log file path
LOG_PATH=./wh_relay.log

# Run browser in headless mode (true/false)
HEADLESS=false
```

### 3. Configure Environment Variables

Edit the `.env` file with your specific configuration:

- **SOURCE_COMMUNITY_NAMES**: Comma-separated list of WhatsApp community names to monitor
- **ANNOUNCEMENT_GROUP_NAMES**: Comma-separated list of announcement channel names within communities
- **TARGET_GROUP_NAME**: Exact name of the target group (must match exactly as shown in WhatsApp)
- **GLOBAL_PRICE_MULTIPLIER**: Price markup multiplier (e.g., 3 for 3x markup)
- **DEDUPE_WINDOW_SECONDS**: Time window for duplicate detection
- **MEDIA_SEND_DELAY_MS**: Delay between sending media and text (20000ms = 20 seconds)
- **LOG_PATH**: Path to log file
- **HEADLESS**: Set to `true` for server deployment, `false` for local development

### 4. Run the Application

Start the bot:

```bash
npm start
```

Or directly:

```bash
node src/index.js
```

### 5. Authenticate with WhatsApp

1. The application will display a QR code in the terminal
2. Open WhatsApp on your mobile device
3. Go to Settings > Linked Devices
4. Tap "Link a Device"
5. Scan the QR code displayed in the terminal
6. Wait for authentication confirmation

### 6. Verify Operation

After authentication, you should see:
- "✅ WhatsApp conectado com sucesso!"
- "🤖 Bot iniciado e monitorando grupos..."
- Log messages indicating groups found and monitoring started

## Build Steps

### Building Executables

To create standalone executables for deployment:

```bash
npm run build
```

This creates platform-specific executables in the `bin/` directory:
- `bin/whatsapp-forwarder-win-x64.exe` (Windows)
- `bin/whatsapp-forwarder-linux-x64` (Linux)

**Note**: Building requires `pkg` package. Install it if missing:

```bash
npm install --save-dev pkg
```

### Building for Specific Platforms

Edit `package.json` to customize build targets:

```json
{
  "scripts": {
    "build": "pkg src/index.js --targets node18-win-x64,node18-linux-x64,node18-macos-x64 --output bin/whatsapp-forwarder"
  }
}
```

Available targets:
- `node18-win-x64` - Windows 64-bit
- `node18-linux-x64` - Linux 64-bit
- `node18-macos-x64` - macOS 64-bit
- `node18-macos-arm64` - macOS Apple Silicon

## Troubleshooting

### Chrome Not Found

If you see "Chrome não encontrado, usando Chromium embutido":
- This is not an error - the application will use bundled Chromium
- For better compatibility, install system Chrome

### Authentication Fails

- Ensure QR code is scanned within 60 seconds
- Check internet connection
- Verify WhatsApp mobile app is connected to internet
- Try closing and restarting the application

### Groups Not Found

If you see "Nenhum Canal de Avisos encontrado":
- Verify group names in `.env` match exactly (including capitalization and special characters)
- Check that announcement channels have `announce=true` setting in WhatsApp
- Review log output for all group names found
- Try leaving `ANNOUNCEMENT_GROUP_NAMES` empty to monitor all announcement channels

### Permission Errors

**Windows**:
- Run terminal as Administrator if file access issues occur
- Check file permissions on log directory

**Linux/macOS**:
- Ensure write permissions on log file directory
- Check `.wwebjs_auth/` directory permissions

### Module Not Found Errors

If you see "Cannot find module" errors:
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then run `npm install`
- Verify Node.js version is 18 or higher

### Port Already in Use

If Puppeteer can't start browser:
- Close other instances of the application
- Check for other Chrome/Chromium processes
- Restart the application

## Development Setup

### Running Tests

Run test files individually:

```bash
# Test price format recognition
node test_price_formats.js

# Test all price formats
node test_all_formats.js

# Test specific use case
node test_specific_case.js
```

### Debug Mode

Enable debug logging by ensuring log level is set to `debug` in `src/index.js` (default).

View logs in real-time:

```bash
# Linux/macOS
tail -f wh_relay.log

# Windows PowerShell
Get-Content wh_relay.log -Wait
```

### Local Development

For local development with visible browser:

1. Set `HEADLESS=false` in `.env`
2. Run `npm start`
3. Browser window will open for debugging
4. Use browser DevTools for troubleshooting

## Next Steps

After successful installation:

1. Verify configuration in `.env` file
2. Test with a sample message from announcement channel
3. Review log file for any issues
4. Proceed to [Deployment Guide](deployment.md) for production setup

## Additional Resources

- [WhatsApp Web.js Documentation](https://wwebjs.dev/)
- [Pino Logger Documentation](https://getpino.io/)
- [Node.js Documentation](https://nodejs.org/docs/)

