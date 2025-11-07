# Architecture Overview

## System Design

The WhatsApp Message Forwarder is a Node.js-based automation service that operates as a bridge between WhatsApp supplier announcement channels and customer groups. The system uses WhatsApp Web's API through browser automation to monitor messages and forward them after processing.

## High-Level Architecture

```
┌─────────────────┐
│  WhatsApp Web   │
│   (Browser)     │
└────────┬────────┘
         │
         │ (Puppeteer)
         │
┌────────▼────────────────────────┐
│   WhatsApp Message Forwarder    │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Message Listener        │  │
│  │  - Event Handlers        │  │
│  │  - Group Filtering       │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Message Processor       │  │
│  │  - Price Transformation  │  │
│  │  - Content Filtering     │  │
│  │  - Deduplication         │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Media Handler           │  │
│  │  - Download              │  │
│  │  - Format Conversion     │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Message Sender          │  │
│  │  - Text Messages         │  │
│  │  - Media Messages        │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
         │
         │ (WhatsApp API)
         │
┌────────▼────────┐
│  Target Group   │
│  (Customers)    │
└─────────────────┘
```

## Data Flow

### Message Reception Flow

1. **WhatsApp Web Connection**: The bot initializes a WhatsApp Web session using Puppeteer
2. **Authentication**: User scans QR code to authenticate the session
3. **Group Discovery**: Bot enumerates all groups and filters announcement channels
4. **Event Registration**: Bot registers event handlers for incoming messages
5. **Message Reception**: When a message arrives, the event handler is triggered

### Message Processing Flow

1. **Origin Validation**: Message is validated against source group IDs
2. **Keyword Filtering**: Messages containing blocked keywords are discarded
3. **Deduplication Check**: Message hash is checked against recent forwarding history
4. **Content Processing**:
   - Text is parsed line by line
   - Lines containing "Varejo" without "Atacado" are removed
   - "Atacado" labels are stripped from lines
   - Prices are detected and multiplied
5. **Media Processing**: If media is present, it's downloaded and prepared for forwarding
6. **Message Delivery**: Processed content is sent to the target group

### Price Transformation Flow

```
Original Message Line
    │
    ├─► Price Detection (Regex)
    │       │
    │       ├─► Multiple Format Support
    │       │   - R$ 90,00
    │       │   - $90,00
    │       │   - 90,00
    │       │   - etc.
    │       │
    │       └─► Price Extraction
    │               │
    │               └─► Price Multiplication
    │                       │
    │                       └─► Format Standardization
    │                               │
    │                               └─► R$ 270,00 (example)
    │
    └─► Final Processed Line
```

## Components and Interactions

### Core Components

1. **WhatsApp Client**
   - Manages connection to WhatsApp Web
   - Handles authentication and session management
   - Provides event-driven message interface
   - Uses LocalAuth for persistent sessions

2. **Message Processor**
   - Filters messages by origin and keywords
   - Processes text content (price transformation, line filtering)
   - Manages deduplication logic
   - Coordinates media and text forwarding

3. **Media Handler**
   - Downloads media from messages
   - Converts media to appropriate formats
   - Manages media sequencing (media first, then text)

4. **Logger**
   - Structured logging with Pino
   - Logs all message operations
   - Tracks errors and warnings
   - Outputs to file and console

5. **Configuration Manager**
   - Loads environment variables
   - Validates configuration
   - Provides default values
   - Manages group name normalization

### Component Interactions

```
Client Initialization
    │
    ├─► Load Configuration (.env)
    │       │
    │       └─► Validate & Set Defaults
    │
    ├─► Initialize Logger
    │
    ├─► Initialize WhatsApp Client
    │       │
    │       ├─► Set Up Puppeteer
    │       │       │
    │       │       └─► Configure Chrome Path
    │       │
    │       └─► Register Event Handlers
    │               │
    │               ├─► QR Code Handler
    │               ├─► Ready Handler
    │               ├─► Message Handler
    │               ├─► Auth Failure Handler
    │               └─► Disconnect Handler
    │
    └─► Start Client
```

## Technologies Used and Rationale

### Node.js
- **Rationale**: Non-blocking I/O model suits event-driven WhatsApp message handling. Large ecosystem and mature tooling.

### whatsapp-web.js
- **Rationale**: Stable library for WhatsApp Web integration. Provides event-based API and media handling. Actively maintained.

### Puppeteer
- **Rationale**: Embedded in whatsapp-web.js for browser automation. Handles WhatsApp Web's web interface reliably.

### Pino
- **Rationale**: High-performance structured logger. Low overhead important for continuous message processing. JSON format enables log analysis.

### dotenv
- **Rationale**: Standard approach for environment-based configuration. Separates configuration from code. Easy deployment management.

### qrcode-terminal
- **Rationale**: Lightweight QR code display for authentication. No external dependencies. Works across terminals.

### pkg
- **Rationale**: Package Node.js applications as standalone executables. Simplifies deployment without Node.js installation requirements.

## Design Decisions

### Event-Driven Architecture
Messages arrive asynchronously, so event-driven design fits naturally. Avoids polling and reduces resource usage.

### Deduplication Window
Time-based deduplication prevents duplicate forwards from rapid message replication. Configurable window balances freshness and duplicate prevention.

### Media-First Sending
Media is sent before text to maintain visual context. Delay between media and text prevents WhatsApp from merging messages incorrectly.

### Price Regex Pattern
Comprehensive regex pattern supports multiple price formats found in real supplier messages. Single pass processing maintains performance.

### Normalization Strategy
Text normalization (lowercase, diacritic removal) enables flexible group name matching. Handles variations in naming without strict matching.

### LocalAuth Strategy
Persistent session storage avoids repeated QR code scans. Session data stored locally in `.wwebjs_auth/` directory.

### Headless Mode Support
Headless operation enables server deployment. Browser automation works without display server requirements.

## Scalability Considerations

### Current Limitations
- Single target group support
- Sequential message processing
- No horizontal scaling capability
- Session tied to single WhatsApp account

### Potential Improvements
- Multi-target group routing
- Parallel message processing queue
- Database-backed deduplication
- Webhook-based architecture for scaling
- Multiple session management

## Security Considerations

### Session Security
- LocalAuth data stored locally (not in version control)
- QR code authentication prevents credential storage
- Session data should be protected with file permissions

### Message Privacy
- All message content logged to files
- Log files should be secured and rotated
- Consider encryption for sensitive deployments

### Environment Variables
- Sensitive configuration in `.env` file
- `.env` excluded from version control
- Production secrets should use secure secret management

## Error Handling

### Connection Errors
- Automatic reconnection attempts on disconnect
- Auth failure logging with clear error messages
- Graceful shutdown on critical errors

### Message Processing Errors
- Individual message errors don't stop the bot
- Comprehensive error logging with context
- Failed messages logged for manual review

### Media Handling Errors
- Media download failures logged but don't block text forwarding
- Fallback to text-only forwarding on media errors
- Error details included in structured logs

