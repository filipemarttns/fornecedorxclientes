# WhatsApp Message Forwarder

Automated message forwarding bot for WhatsApp that relays announcements from supplier groups to customer groups with intelligent price processing and media handling.

## Features

- **Multi-group monitoring**: Monitors multiple announcement channels within WhatsApp communities
- **Price transformation**: Automatically detects and multiplies prices in messages according to configurable markup rules
- **Content filtering**: Filters out retail prices and keeps only wholesale (atacado) pricing information
- **Media support**: Handles images, videos, and documents with proper sequencing
- **Deduplication**: Prevents duplicate message forwarding within configurable time windows
- **Keyword filtering**: Ignores messages containing specific keywords (e.g., greetings)
- **Flexible configuration**: Environment-based configuration for all operational parameters
- **Structured logging**: Comprehensive logging with Pino for debugging and monitoring

## Architecture

The bot operates as a Node.js service that connects to WhatsApp Web via Puppeteer. It listens for messages from configured announcement channels and forwards them to a target customer group after processing:

1. **Message Reception**: Receives messages from monitored announcement channels
2. **Content Processing**: Applies price transformations and content filters
3. **Deduplication Check**: Verifies message hasn't been forwarded recently
4. **Media Handling**: Downloads and forwards media separately from text
5. **Message Delivery**: Sends processed content to target group

See [docs/architecture.md](docs/architecture.md) for detailed system design.

## Installation

### Prerequisites

- Node.js 18 or higher
- Google Chrome or Chromium browser
- WhatsApp account with access to source and target groups

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd fornecedorxclientes
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
SOURCE_COMMUNITY_NAMES=Community1,Community2
ANNOUNCEMENT_GROUP_NAMES=Announcements,Updates
TARGET_GROUP_NAME=Customer Group Name
GLOBAL_PRICE_MULTIPLIER=3
DEDUPE_WINDOW_SECONDS=10
MEDIA_SEND_DELAY_MS=20000
LOG_PATH=./wh_relay.log
HEADLESS=false
```

4. Run the application:
```bash
npm start
```

5. Scan the QR code displayed in the terminal with your WhatsApp mobile app.

See [docs/installation.md](docs/installation.md) for detailed installation instructions.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOURCE_COMMUNITY_NAMES` | Comma-separated list of community names to monitor | `""` |
| `ANNOUNCEMENT_GROUP_NAMES` | Comma-separated list of announcement channel names | `"Avisos"` |
| `TARGET_GROUP_NAME` | Name of the target group for forwarded messages | `"OJ® Streetwear Shop & Sneakers"` |
| `GLOBAL_PRICE_MULTIPLIER` | Multiplier for price transformation | `3` |
| `DEDUPE_WINDOW_SECONDS` | Time window for duplicate detection (seconds) | `10` |
| `MEDIA_SEND_DELAY_MS` | Delay before sending text after media (milliseconds) | `20000` |
| `LOG_PATH` | Path to log file | `./wh_relay.log` |
| `HEADLESS` | Run browser in headless mode | `false` |

## Running Locally

```bash
# Start the bot
npm start

# Run tests
npm test
```

The bot will display a QR code for authentication. Scan it with WhatsApp to establish the connection.

## Deployment

The application can be deployed as a standalone executable or as a Node.js service:

### Building Executables

```bash
npm run build
```

This creates platform-specific executables in the `bin/` directory.

### Production Deployment

1. Set `HEADLESS=true` in your `.env` file
2. Configure a process manager (PM2, systemd, etc.)
3. Set up log rotation for the log file
4. Ensure Chrome/Chromium is installed on the server

See [docs/deployment.md](docs/deployment.md) for detailed deployment instructions.

## Screenshots

<!-- Add screenshots here -->
- QR code authentication flow
- Message forwarding in action
- Price transformation examples

## Tech Stack

- **Runtime**: Node.js 18+
- **WhatsApp Integration**: whatsapp-web.js
- **Browser Automation**: Puppeteer (via whatsapp-web.js)
- **Logging**: Pino
- **Environment Management**: dotenv
- **QR Code Display**: qrcode-terminal
- **Build Tool**: pkg (for executables)

## Module Documentation

- [Architecture Overview](docs/architecture.md)
- [Module Documentation](docs/modules.md)
- [Installation Guide](docs/installation.md)
- [Deployment Guide](docs/deployment.md)
- [Contributing Guide](docs/contributing.md)

## Roadmap

- [ ] Support for multiple target groups
- [ ] Webhook integration for external notifications
- [ ] Database-backed message history
- [ ] Advanced price parsing with ML models
- [ ] REST API for configuration management
- [ ] Docker containerization

## License

ISC

## Notes

- The bot requires an active WhatsApp Web session. Keep the device connected to maintain the session.
- Price transformation supports multiple formats: R$, $, $$, and decimal numbers
- Media messages are sent first, followed by text after a configurable delay
- The bot filters out messages containing "bom dia" and similar greetings
- Only messages from announcement channels (announce=true) are processed

