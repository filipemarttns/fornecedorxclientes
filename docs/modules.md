# Module-by-Module Documentation

## Overview

The application is structured as a single main module (`src/index.js`) with supporting test modules. The architecture is monolithic by design, keeping all core functionality in one file for simplicity and ease of maintenance.

## Main Module: `src/index.js`

### Purpose

The main entry point of the application. Handles WhatsApp client initialization, message processing, price transformation, media handling, and message forwarding.

### Key Functions

#### `findChromePath()`

**Purpose**: Locates Google Chrome executable on Windows systems.

**Logic**:
- Checks common Chrome installation paths
- Returns first valid path found
- Returns `undefined` if Chrome not found (falls back to bundled Chromium)

**Inputs**: None (uses `process.env.USERNAME`)

**Outputs**: String path or `undefined`

**Important Decisions**:
- Windows-only paths (Linux/Mac would need separate logic)
- Prioritizes system Chrome over bundled Chromium for better compatibility

#### `normalize(str)`

**Purpose**: Normalizes text for flexible matching (case-insensitive, diacritic-insensitive).

**Logic**:
- Converts to lowercase
- Removes diacritical marks (NFD normalization)
- Handles empty strings gracefully

**Inputs**: String to normalize

**Outputs**: Normalized string

**Use Cases**:
- Group name matching
- Announcement channel filtering
- Community name comparison

### Configuration Section

#### Environment Variables Loading

All configuration loaded from environment variables with sensible defaults:

- `SOURCE_COMMUNITY_NAMES`: Comma-separated community names
- `ANNOUNCEMENT_GROUP_NAMES`: Comma-separated announcement channels
- `ANNOUNCEMENT_GROUP_NAME`: Single announcement channel (fallback)
- `TARGET_GROUP_NAME`: Destination group name
- `GLOBAL_PRICE_MULTIPLIER`: Price markup multiplier
- `DEDUPE_WINDOW_SECONDS`: Duplicate detection window
- `MEDIA_SEND_DELAY_MS`: Delay between media and text
- `LOG_PATH`: Log file location
- `HEADLESS`: Browser headless mode flag

#### Normalized Filter Lists

Creates normalized versions of group names for flexible matching:
- `communityWanted`: Normalized source community names
- `announcementWanted`: Normalized announcement channel names with defaults

### Logger Initialization

**Purpose**: Sets up structured logging with Pino.

**Configuration**:
- Log level: `debug`
- Output: File destination (async)
- Format: JSON structured logs

**Responsibilities**:
- Log all message operations
- Track errors and warnings
- Provide debugging information

### WhatsApp Client Initialization

#### Client Configuration

```javascript
new Client({
    authStrategy: new LocalAuth({ clientId: 'whatsapp-forwarder' }),
    puppeteer: {
        headless: HEADLESS,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: chromePath || undefined
    }
})
```

**Responsibilities**:
- Manage WhatsApp Web session
- Handle authentication
- Provide message events
- Execute message sending

### Event Handlers

#### `client.on('qr')`

**Purpose**: Display QR code for authentication.

**Responsibilities**:
- Generate QR code in terminal
- Provide user instructions
- Log QR code generation

**Output**: QR code printed to console

#### `client.on('ready')`

**Purpose**: Initialize group discovery and filtering after authentication.

**Key Operations**:
1. **Group Enumeration**: Retrieves all chats from WhatsApp
2. **Announcement Channel Discovery**: Filters groups with `announce=true`
3. **Group Matching**: Matches announcement channels against configured names
4. **Target Group Discovery**: Finds target group by exact name
5. **Validation**: Ensures required groups are found
6. **Flag Setting**: Sets `isReadyToProcessMessages` to true

**Important Logic**:
- Supports multiple announcement channels
- Flexible name matching (contains or equals)
- Falls back to all announcement channels if no filters specified
- Exits process if required groups not found

**Outputs**:
- `sourceGroups`: Array of announcement channel objects
- `sourceGroupIds`: Array of announcement channel IDs
- `targetGroup`: Target group object
- `isReadyToProcessMessages`: Boolean flag

#### `client.on('message')`

**Purpose**: Process and forward incoming messages.

**Processing Pipeline**:

1. **Readiness Check**
   - Validates bot is ready to process messages
   - Early return if not ready

2. **Keyword Filtering**
   - Checks for blocked keywords (e.g., "bom dia")
   - Filters out unwanted messages

3. **Origin Validation**
   - Ignores messages sent by bot itself
   - Validates message from monitored announcement channel
   - Early return for non-matching groups

4. **Deduplication**
   - Creates message identifier (ID or body+media hash)
   - Checks against forwarded messages map
   - Validates time window hasn't expired
   - Skips if duplicate within window

5. **Text Processing**
   - Splits message into lines
   - Processes each line:
     - Removes lines with "Varejo" but no "Atacado"
     - Removes "Atacado" label from lines
     - Detects and multiplies prices
   - Joins processed lines
   - Cleans excessive blank lines

6. **Media Handling** (if media present)
   - Downloads media from message
   - Creates MessageMedia object
   - Sends media to target group
   - Applies delay before sending text
   - Sends processed text after delay

7. **Text-Only Handling** (if no media)
   - Applies delay (same as media flow)
   - Sends processed text to target group

8. **Tracking**
   - Records message in forwarded messages map
   - Logs successful forwarding

**Price Processing Details**:

The price transformation uses a comprehensive regex pattern:
```javascript
/(?:?:\s*)?(R\$|\$\$?)\s*(\d+(?:[.,]\d{2})?)|\b(\d+(?:[.,]\d{2})?)\s*(R\$|\$\$?)|\b(\d+[.,]\d{2})\b/gi
```

This pattern matches:
- `R$ 90,00` or `R$90,00` or `R$90`
- `$90,00` or `$90`
- `$$90,00` or `$$90`
- `90,00$` or `90$`
- `90,00$$` or `90$$`
- `90,00` or `90.00` (decimal format)

Each price is:
1. Extracted from the line
2. Normalized to decimal format (comma to dot)
3. Parsed as float
4. Multiplied by `GLOBAL_PRICE_MULTIPLIER`
5. Formatted as `R$XX,XX`
6. Replaced in the original line

**Error Handling**:
- Media download errors logged but don't block text forwarding
- Message send errors logged with full context
- Individual message failures don't stop the bot

#### `client.on('auth_failure')`

**Purpose**: Handle authentication failures.

**Responsibilities**:
- Log authentication errors
- Display user-friendly error message
- Provide troubleshooting guidance

#### `client.on('disconnected')`

**Purpose**: Handle client disconnections.

**Responsibilities**:
- Log disconnect reasons
- Provide reconnection information
- Track connection state

### Global Error Handlers

#### `process.on('uncaughtException')`

**Purpose**: Catch unhandled exceptions.

**Responsibilities**:
- Log critical errors
- Display error messages
- Prevent silent failures

#### `process.on('unhandledRejection')`

**Purpose**: Catch unhandled promise rejections.

**Responsibilities**:
- Log promise rejections
- Display error messages
- Track async errors

### Client Initialization

**Purpose**: Start the WhatsApp client.

**Flow**:
1. Call `client.initialize()`
2. Handle initialization errors
3. Exit process on critical failures

## Test Modules

### `src/test.js`

**Purpose**: Unit tests for message forwarding logic.

**Structure**:
- Uses Sinon for mocking
- Mocks WhatsApp client and messages
- Tests core functionality:
  - Text message forwarding
  - Media message forwarding
  - Duplicate message handling
  - Error handling
  - Group filtering

**Note**: Test structure exists but requires test runner setup (Mocha/Jest) for execution.

### `test_price_formats.js`

**Purpose**: Validates price regex pattern against various formats.

**Functionality**:
- Tests all supported price formats
- Validates price multiplication
- Checks format standardization
- Provides test output for manual verification

**Usage**: Run directly with `node test_price_formats.js`

### `test_all_formats.js`

**Purpose**: Comprehensive price format testing.

**Functionality**:
- Tests all known price format variations
- Validates recognition and transformation
- Provides pass/fail status

**Usage**: Run directly with `node test_all_formats.js`

### `test_specific_case.js`

**Purpose**: Tests specific message format with "Atacado" and "Varejo" handling.

**Functionality**:
- Tests message with multiple price lines
- Validates "Varejo" line removal
- Validates "Atacado" label removal
- Tests price transformation in context

**Usage**: Run directly with `node test_specific_case.js`

## Module Responsibilities Summary

| Module | Responsibility | Key Functions |
|--------|---------------|---------------|
| `src/index.js` | Main application logic | Client initialization, message processing, price transformation, media handling |
| `src/test.js` | Unit tests | Test message forwarding, deduplication, error handling |
| `test_price_formats.js` | Price regex validation | Test price format recognition |
| `test_all_formats.js` | Comprehensive format testing | Validate all price formats |
| `test_specific_case.js` | Business logic testing | Test Atacado/Varejo filtering |

## Inputs and Outputs

### Main Module Inputs

- **Environment Variables**: Configuration via `.env` file
- **WhatsApp Messages**: Incoming messages from announcement channels
- **QR Code Scan**: User authentication via mobile app

### Main Module Outputs

- **Forwarded Messages**: Processed messages sent to target group
- **Log Files**: Structured logs in configured log file
- **Console Output**: QR codes, status messages, debug information

### Processing Flow

```
Input: WhatsApp Message
    │
    ├─► Origin Validation
    ├─► Keyword Filtering
    ├─► Deduplication Check
    ├─► Text Processing
    │       ├─► Line Filtering
    │       ├─► Price Detection
    │       └─► Price Transformation
    ├─► Media Processing (if applicable)
    └─► Output: Forwarded Message
```

## Important Decisions

### Monolithic Architecture
All core logic in single file simplifies deployment and reduces complexity. Trade-off: larger file size, but acceptable for this use case.

### Event-Driven Design
WhatsApp messages arrive asynchronously, so event handlers fit naturally. No polling required, efficient resource usage.

### Price Regex Complexity
Comprehensive regex pattern handles real-world price format variations. Single-pass processing maintains performance.

### Media-First Sending
Sending media before text prevents WhatsApp from merging messages. Delay ensures proper sequencing.

### Normalization Strategy
Text normalization enables flexible group matching without strict name requirements. Handles naming variations gracefully.

### LocalAuth Persistence
Session persistence avoids repeated QR code scans. Local storage sufficient for single-instance deployment.

