# WhatsApp Group Message Forwarder Bot

This bot monitors a specified WhatsApp group (e.g., "Fornecedores") and forwards all new messages, including text and media, to another specified WhatsApp group (e.g., "Clientes"). It runs locally, preserves sessions to avoid repeated QR scans, and ensures no content alteration (e.g., prices or text) during forwarding.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Running in Debug Mode (with browser)](#running-in-debug-mode-with-browser)
  - [Running in Headless Mode](#running-in-headless-mode)
- [Building Executables](#building-executables)
  - [Windows x64](#windows-x64)
  - [Linux x64](#linux-x64)
  - [macOS (Experimental)](#macos-experimental)
- [Testing (Dry-Run)](#testing-dry-run)
- [Security, Operation, and Limits](#security-operation-and-limits)
- [Troubleshooting](#troubleshooting)
- [Disclaimer](#disclaimer)

## Features

*   **Real-time Monitoring**: Monitors a designated source group for new messages.
*   **Pure Forwarding**: Forwards text and all media (images, videos, documents) without any alterations.
*   **Media Handling**: Downloads and re-sends media, preserving order (media first, then text).
*   **Deduplication**: Prevents duplicate messages within a configurable time window (default 10 seconds).
*   **Session Persistence**: Saves session data locally to avoid frequent QR code scans.
*   **Logging**: Detailed logging in JSON lines format to a configurable file.
*   **Headless & Debug Modes**: Runs headless by default; debug mode opens a visible browser for QR scanning.
*   **Single-file Executable**: Provides instructions and scripts to build executables for Windows and Linux.
*   **No C++ Compilation**: Uses Node.js and npm packages to avoid manual C++ compilation steps.

## Prerequisites

*   **Node.js**: Version 18 or higher. You can download it from [nodejs.org](https://nodejs.org/).
*   **npm**: Node.js package manager, usually installed with Node.js.
*   **Google Chrome / Chromium**: `whatsapp-web.js` uses Puppeteer, which requires a Chromium-based browser. This is usually installed automatically by Puppeteer, but if you encounter issues, ensure you have Chrome or Chromium installed on your system.

## Installation

1.  **Clone the repository or download the ZIP file:**
    ```bash
    git clone <repository_url>
    cd whatsapp-forwarder-bot
    ```
    (If you downloaded a ZIP, extract it and navigate into the directory.)

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

Configure the bot using environment variables. These can be set directly in your terminal or by creating a `.env` file in the project root (you'll need `dotenv` for this, but for simplicity, direct environment variables are recommended for executables).

*   `SOURCE_GROUP_NAME`: The exact name of the WhatsApp group to monitor (default: "Fornecedores").
*   `TARGET_GROUP_NAME`: The exact name of the WhatsApp group to forward messages to (default: "Clientes").
*   `DEDUPE_WINDOW_SECONDS`: Time in seconds to ignore duplicate messages (default: 10).
*   `LOG_PATH`: Path to the log file (default: `./wh_relay.log`).
*   `HEADLESS`: Set to `false` to run the browser visibly (debug mode, useful for QR scan). Default is `true` (headless).

**Example (Linux/macOS):**

    ```bash
export SOURCE_GROUP_NAME="Fornecedores"
export TARGET_GROUP_NAME="Clientes"
export DEDUPE_WINDOW_SECONDS=15
export LOG_PATH="/var/log/whatsapp-bot/relay.log"
export HEADLESS=false # For initial QR scan
npm start
```

**Example (Windows - PowerShell):**

```powershell
$env:SOURCE_GROUP_NAME="Fornecedores"
$env:TARGET_GROUP_NAME="Clientes"
$env:DEDUPE_WINDOW_SECONDS=15
$env:LOG_PATH=".\wh_relay.log"
$env:HEADLESS="false" # For initial QR scan
npm start
```

## Usage

Once configured, you can run the bot.

### Running in Debug Mode (with browser)

This mode is useful for the initial QR code scan. Set `HEADLESS` to `false`.

```bash
# Linux/macOS
HEADLESS=false npm start

# Windows (PowerShell)
$env:HEADLESS="false"; npm start
```

Scan the QR code displayed in your terminal or the opened browser with your WhatsApp mobile app. Once authenticated, the browser will close (if headless) or remain open (if debug).

### Running in Headless Mode

After the initial successful authentication (session saved), you can run the bot in headless mode.

```bash
npm start
```
Or using your configured environment variables.

## Building Executables

This project uses `pkg` to create single-file executables. The session data (`./.wwebjs_auth`) and logs (`./wh_relay.log`) will be created relative to where the executable is run.

1.  **Install `pkg` globally (if not already installed):**
    ```bash
    npm install -g pkg
    ```

2.  **Run the build command:**
    ```bash
    npm run build
    ```
    This will generate executables in a `bin` directory for Windows and Linux.

### Windows x64

Locate `bin/whatsapp-forwarder-win.exe`.

### Linux x64

Locate `bin/whatsapp-forwarder-linux`.

### macOS (Experimental)

To generate for macOS, you would need to run `npm run build` on a macOS machine. Modify the `package.json` build script to include `node18-macos-x64`:

```json
"build": "pkg . --targets node18-win-x64,node18-linux-x64,node18-macos-x64 --output bin/whatsapp-forwarder"
```

## Testing (Dry-Run)

To ensure the bot's core logic (forwarding, deduplication) works as expected without connecting to a live WhatsApp account, you can run the provided tests:

```bash
npm test
```

This will execute a series of unit tests that mock WhatsApp interactions.

## Security, Operation, and Limits

**⚠️ WARNING: Automation via WhatsApp Web is unofficial and carries a risk of account blocking. Use at your own discretion and responsibility. It is highly recommended to test in a controlled environment with a non-critical WhatsApp account first.**

*   **Session Data**: The session is saved locally in the `.wwebjs_auth` directory. This directory is crucial for session persistence. Do not delete it unless you intend to re-authenticate.
*   **Error Handling**: The bot includes basic error handling for media downloads and message sending with logging. More advanced retry mechanisms could be implemented if needed.
*   **Resource Usage**: Running a browser (even headless) consumes system resources. Monitor memory and CPU usage, especially on constrained systems.
*   **WhatsApp Web Limitations**: The bot is subject to the limitations and changes of WhatsApp Web. Future updates to WhatsApp Web might break the bot's functionality.

## Troubleshooting

*   **QR Code Not Appearing**: Ensure `HEADLESS` is set to `false` for the initial scan. Check your internet connection.
*   **Group Not Found**: Verify that `SOURCE_GROUP_NAME` and `TARGET_GROUP_NAME` exactly match the group names in WhatsApp (case-sensitive).
*   **Media Download Errors**: Check your internet connection and disk space. Ensure Puppeteer has correctly installed Chromium.
*   **Executable Not Running**: Ensure all assets (like the `.wwebjs_auth` directory for session) are in the correct location relative to the executable.

## Disclaimer

This tool is an independent project and is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta Platforms, Inc. The use of this bot may violate WhatsApp's Terms of Service, and your account may be temporarily or permanently banned. The developer of this bot is not responsible for any consequences that may arise from its use. Use responsibly and at your own risk. 