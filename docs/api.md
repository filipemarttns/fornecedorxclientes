# API Documentation

## Overview

The WhatsApp Message Forwarder does not expose a traditional REST API. Instead, it operates as an event-driven service that integrates with WhatsApp Web through the whatsapp-web.js library. This document describes the internal interfaces, event handlers, and integration points.

## Internal Interfaces

### WhatsApp Client Interface

The application uses the whatsapp-web.js client which provides the following interfaces:

#### Event Handlers

**QR Code Event**
- **Event**: `qr`
- **Purpose**: Authentication QR code generation
- **Handler**: Displays QR code in terminal
- **Payload**: QR code string

**Ready Event**
- **Event**: `ready`
- **Purpose**: Client authentication complete
- **Handler**: Initializes group discovery and monitoring
- **Payload**: None

**Message Event**
- **Event**: `message`
- **Purpose**: Incoming message reception
- **Handler**: Processes and forwards messages
- **Payload**: Message object

**Authentication Failure Event**
- **Event**: `auth_failure`
- **Purpose**: Authentication error handling
- **Handler**: Logs error and exits
- **Payload**: Error message string

**Disconnect Event**
- **Event**: `disconnected`
- **Purpose**: Connection loss handling
- **Handler**: Logs disconnect reason
- **Payload**: Disconnect reason string

### Message Object Structure

Messages from WhatsApp Web have the following structure:

```javascript
{
  id: {
    id: string,           // Message ID
    _serialized: string   // Serialized message ID
  },
  body: string,          // Message text content
  hasMedia: boolean,     // Whether message contains media
  from: string,          // Sender ID
  fromMe: boolean,       // Whether message is from bot
  author: string,        // Author ID (for group messages)
  type: string,          // Message type (text, image, video, etc.)
  timestamp: number,     // Message timestamp
  // ... additional properties
}
```

### Message Processing Interface

#### Input: Raw Message

```javascript
{
  id: { id: string },
  body: string,
  hasMedia: boolean,
  from: string,
  fromMe: boolean,
  author: string,
  type: string
}
```

#### Output: Processed Message

**Text Message**:
```javascript
{
  text: string,          // Processed text with price transformations
  media: null
}
```

**Media Message**:
```javascript
{
  text: string,          // Processed text (sent after media)
  media: {
    mimetype: string,    // Media MIME type
    data: string,        // Base64-encoded media data
    filename: string     // Generated filename
  }
}
```

## Configuration Interface

### Environment Variables

The application reads configuration from environment variables (loaded via dotenv):

| Variable | Type | Description | Default |
|----------|------|-------------|---------|
| `SOURCE_COMMUNITY_NAMES` | string | Comma-separated community names | `""` |
| `ANNOUNCEMENT_GROUP_NAMES` | string | Comma-separated announcement channels | `"Avisos"` |
| `ANNOUNCEMENT_GROUP_NAME` | string | Single announcement channel (fallback) | `"Avisos"` |
| `TARGET_GROUP_NAME` | string | Target group name | `"OJ® Streetwear Shop & Sneakers"` |
| `GLOBAL_PRICE_MULTIPLIER` | number | Price markup multiplier | `3` |
| `DEDUPE_WINDOW_SECONDS` | number | Deduplication time window | `10` |
| `MEDIA_SEND_DELAY_MS` | number | Delay before sending text after media | `20000` |
| `LOG_PATH` | string | Log file path | `./wh_relay.log` |
| `HEADLESS` | boolean | Headless browser mode | `false` |

### Configuration Loading

Configuration is loaded at application startup:

```javascript
require('dotenv').config();

const SOURCE_COMMUNITY_NAMES = (process.env.SOURCE_COMMUNITY_NAMES || "")
  .split(',')
  .map(name => name.trim())
  .filter(n => n);
```

## Message Processing Pipeline

### Processing Steps

1. **Origin Validation**
   - Input: Message object
   - Validation: Check if message from monitored group
   - Output: Boolean (proceed/ignore)

2. **Keyword Filtering**
   - Input: Message body text
   - Filter: Blocked keywords (e.g., "bom dia")
   - Output: Boolean (proceed/ignore)

3. **Deduplication**
   - Input: Message ID or hash
   - Check: Recent forwarding history
   - Output: Boolean (proceed/ignore)

4. **Text Processing**
   - Input: Raw message text
   - Processing:
     - Line filtering (remove "Varejo" lines)
     - Label removal (remove "Atacado" labels)
     - Price detection and transformation
   - Output: Processed text

5. **Media Processing** (if applicable)
   - Input: Message with media
   - Processing:
     - Download media
     - Convert to MessageMedia object
   - Output: MessageMedia object

6. **Message Sending**
   - Input: Processed content
   - Action: Send to target group
   - Output: Success/error status

## Price Transformation Interface

### Price Detection

**Regex Pattern**:
```javascript
/(?:?:\s*)?(R\$|\$\$?)\s*(\d+(?:[.,]\d{2})?)|\b(\d+(?:[.,]\d{2})?)\s*(R\$|\$\$?)|\b(\d+[.,]\d{2})\b/gi
```

**Supported Formats**:
- `R$ 90,00` or `R$90,00` or `R$90`
- `$90,00` or `$90`
- `$$90,00` or `$$90`
- `90,00$` or `90$`
- `90,00$$` or `90$$`
- `90,00` or `90.00` (decimal format)

### Price Transformation

**Input**: Price string (e.g., "R$ 90,00")

**Process**:
1. Extract numeric value
2. Normalize decimal separator (comma to dot)
3. Parse as float
4. Multiply by `GLOBAL_PRICE_MULTIPLIER`
5. Format as `R$XX,XX`

**Output**: Transformed price string (e.g., "R$270,00")

### Example Transformation

```javascript
// Input
"Atacado: R$ 90,00"

// After label removal
"R$ 90,00"

// After price transformation (multiplier: 3)
"R$270,00"
```

## Logging Interface

### Log Structure

All logs use structured JSON format via Pino:

```javascript
{
  "level": number,        // Log level (10=debug, 30=info, 40=warn, 50=error)
  "time": number,         // Timestamp
  "msg": string,          // Log message
  // Additional context fields
}
```

### Log Events

**Message Received**:
```javascript
{
  level: 30,
  time: 1234567890,
  msg: "Nova mensagem recebida de um Grupo de Avisos monitorado.",
  timestamp: "2024-01-01T12:00:00.000Z",
  source_message_id: "msg123",
  author: "user@c.us",
  source_group: "Announcements",
  original_text: "Product: R$ 90,00",
  media_filenames: [],
  status: "received",
  error_message: null
}
```

**Message Forwarded**:
```javascript
{
  level: 30,
  time: 1234567890,
  msg: "Message fully processed and forwarded.",
  timestamp: "2024-01-01T12:00:00.000Z",
  source_message_id: "msg123",
  author: "user@c.us",
  source_group: "Announcements",
  target_group: "Customer Group",
  original_text: "Product: R$ 90,00",
  media_filenames: ["media-msg123.jpeg"],
  status: "sent",
  error_message: null
}
```

**Error**:
```javascript
{
  level: 50,
  time: 1234567890,
  msg: "Error sending text message.",
  timestamp: "2024-01-01T12:00:00.000Z",
  source_message_id: "msg123",
  author: "user@c.us",
  source_group: "Announcements",
  original_text: "Product: R$ 90,00",
  modified_text: "Product: R$270,00",
  media_filenames: [],
  status: "error",
  error_message: "Failed to send: Network error"
}
```

## Group Discovery Interface

### Group Matching Logic

**Input**: Array of chat objects from WhatsApp

**Filtering**:
1. Filter groups with `announce=true`
2. Match against `ANNOUNCEMENT_GROUP_NAMES` (contains or equals)
3. Match against `SOURCE_COMMUNITY_NAMES` (contains)
4. Fallback to all announcement channels if no filters

**Output**: Array of matching announcement channel objects

### Group Object Structure

```javascript
{
  id: {
    _serialized: string   // Group ID
  },
  name: string,          // Group name
  isGroup: boolean,      // Always true for groups
  groupMetadata: {
    announce: boolean    // Whether group is announcement channel
  }
}
```

## Media Handling Interface

### Media Download

**Input**: Message object with `hasMedia: true`

**Process**:
```javascript
const media = await message.downloadMedia();
```

**Output**: Media object
```javascript
{
  mimetype: string,      // MIME type (e.g., "image/jpeg")
  data: string,          // Base64-encoded media data
  filename: string       // Original filename (if available)
}
```

### Media Sending

**Input**: Media object and target group ID

**Process**:
```javascript
const mediaToSend = new MessageMedia(media.mimetype, media.data, filename);
await client.sendMessage(targetGroupId, mediaToSend);
```

**Output**: Message send result

## Deduplication Interface

### Message Tracking

**Storage**: In-memory Map
```javascript
Map<messageIdentifier, timestamp>
```

**Message Identifier**:
- Primary: `message.id.id`
- Fallback: `${message.body}-${message.hasMedia}`

### Deduplication Check

**Input**: Message identifier and current timestamp

**Process**:
1. Check if identifier exists in map
2. If exists, calculate time difference
3. If within window, skip message
4. If outside window or not found, proceed

**Output**: Boolean (isDuplicate)

### Window Configuration

- Default: 10 seconds
- Configurable via `DEDUPE_WINDOW_SECONDS`
- Purpose: Prevent duplicate forwards from rapid message replication

## Error Handling Interface

### Error Types

1. **Authentication Errors**
   - Event: `auth_failure`
   - Action: Log error and exit
   - Recovery: Re-authenticate with QR code

2. **Connection Errors**
   - Event: `disconnected`
   - Action: Log disconnect reason
   - Recovery: Automatic reconnection (handled by client)

3. **Media Download Errors**
   - Handler: Try-catch in message handler
   - Action: Log error, continue with text-only forwarding
   - Recovery: None (message partially forwarded)

4. **Message Send Errors**
   - Handler: Try-catch in message handler
   - Action: Log error with full context
   - Recovery: None (message not forwarded)

### Error Log Structure

```javascript
{
  level: 50,
  time: 1234567890,
  msg: "Error message",
  timestamp: "2024-01-01T12:00:00.000Z",
  source_message_id: "msg123",
  author: "user@c.us",
  source_group: "Announcements",
  original_text: "Message text",
  status: "error",
  error_message: "Detailed error message"
}
```

## Integration Points

### WhatsApp Web.js Integration

- **Library**: whatsapp-web.js
- **Version**: latest-alpha
- **Authentication**: LocalAuth strategy
- **Browser**: Puppeteer (Chrome/Chromium)

### External Dependencies

- **Pino**: Structured logging
- **dotenv**: Environment variable management
- **qrcode-terminal**: QR code display

## Future API Considerations

### Potential REST API Endpoints

If extending to REST API in the future:

**GET /health**
- Purpose: Health check endpoint
- Response: `{ status: "ok", uptime: number }`

**GET /status**
- Purpose: Get bot status
- Response: `{ connected: boolean, groups: array, lastMessage: timestamp }`

**POST /config**
- Purpose: Update configuration
- Request: Configuration object
- Response: Updated configuration

**GET /logs**
- Purpose: Retrieve recent logs
- Query: `?limit=100&level=error`
- Response: Array of log entries

**POST /message**
- Purpose: Send test message
- Request: Message object
- Response: Send result

## Testing Interface

### Test Files

- `test_price_formats.js`: Price format recognition tests
- `test_all_formats.js`: Comprehensive format testing
- `test_specific_case.js`: Business logic testing
- `src/test.js`: Unit tests (requires test runner)

### Test Execution

```bash
# Run price format tests
node test_price_formats.js

# Run all format tests
node test_all_formats.js

# Run specific case test
node test_specific_case.js
```

## Summary

While the application doesn't expose a traditional REST API, it provides well-defined internal interfaces for:

- Message processing pipeline
- Price transformation
- Media handling
- Group discovery
- Deduplication
- Error handling
- Logging

These interfaces can be extended to create a REST API or integrated with other systems as needed.

