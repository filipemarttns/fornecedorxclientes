const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config(); // Load environment variables from .env file

// Configuration
const SOURCE_COMMUNITY_NAMES = (process.env.SOURCE_COMMUNITY_NAMES || "").split(',').map(name => name.trim()).filter(n => n);
const ANNOUNCEMENT_GROUP_NAME = process.env.ANNOUNCEMENT_GROUP_NAME || "Avisos";
const TARGET_GROUP_NAME = process.env.TARGET_GROUP_NAME || "OJ® Streetwear Shop & Sneakers";
const DEDUPE_WINDOW_SECONDS = parseInt(process.env.DEDUPE_WINDOW_SECONDS || "10", 10);
const MEDIA_SEND_DELAY_MS = parseInt(process.env.MEDIA_SEND_DELAY_MS || "20000", 10); // Reintroduced and set default to 20 seconds
const LOG_PATH = process.env.LOG_PATH || './wh_relay.log';
const HEADLESS = true; // Forçar o modo headless para que não abra a janela do navegador.

let GLOBAL_PRICE_MULTIPLIER = 3; // Default to 3, but will be set by user input

// Initialize logger
const logger = pino(
  {
    level: 'debug',
    base: null, // Don't log hostname/pid
  },
  pino.destination({
    dest: LOG_PATH,
    sync: false, // Asynchronous logging
  })
);

async function promptUserForMultiplier() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        function ask() {
            rl.question(
                '\nEscolha uma opção para os valores de R$:\n1. Triplicar (multiplicar por 3)\n2. Duplicar (multiplicar por 2)\nDigite 1 ou 2: ',
                (answer) => {
                    const choice = parseInt(answer.trim(), 10);
                    if (choice === 1) {
                        rl.close();
                        resolve(3);
                    } else if (choice === 2) {
                        rl.close();
                        resolve(2);
                    } else {
                        console.log('Opção inválida. Por favor, digite 1 ou 2.');
                        ask(); // Ask again
                    }
                }
            );
        }
        ask();
    });
}

(async () => {
    logger.info('Starting WhatsApp Forwarder Bot...');
    GLOBAL_PRICE_MULTIPLIER = await promptUserForMultiplier();
    console.log(`[DEBUG] Multiplicador de preço escolhido: ${GLOBAL_PRICE_MULTIPLIER}`);

    logger.info(`Source Communities: "${SOURCE_COMMUNITY_NAMES.join(', ')}"`); // Log communities
    logger.info(`Announcement Group Name: "${ANNOUNCEMENT_GROUP_NAME}"`); // Log announcement group name
    logger.info(`Target Group: "${TARGET_GROUP_NAME}"`);
    logger.info(`Dedupe Window: ${DEDUPE_WINDOW_SECONDS} seconds`);
    logger.info(`Media Send Delay: ${MEDIA_SEND_DELAY_MS} milliseconds`);
    logger.info(`Log Path: "${LOG_PATH}"`);
    logger.info(`Headless Mode: ${HEADLESS}`);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: 'whatsapp-forwarder' }),
        puppeteer: {
            headless: HEADLESS,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    });

    let sourceGroups = []; // Changed to an array of announcement groups
    let sourceGroupIds = []; // New array to store IDs of announcement groups
    let targetGroup;
    let isReadyToProcessMessages = false; // Flag para indicar que o bot está pronto para processar mensagens
    const forwardedMessages = new Map(); // Map to store forwarded message hashes/IDs and their timestamps

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        logger.info('QR RECEIVED. Scan with your WhatsApp app.');
    });

    client.on('ready', async () => {
        logger.info('Client is ready!');

        const chats = await client.getChats();

        // Log all group names found for debugging
        const groupNamesFound = chats.filter(chat => chat.isGroup).map(chat => chat.name);
        logger.info(`[DEBUG] Todos os nomes de grupos encontrados no WhatsApp: [${groupNamesFound.join(', ')}]`);

        // Detailed log of all chats found (for community debugging)
        const allChatsDetails = chats.map(chat => JSON.parse(JSON.stringify(chat))); // Deep copy to get all properties
        logger.debug(`[DEBUG] Detalhes completos de TODOS os chats encontrados: ${JSON.stringify(allChatsDetails, null, 2)}`);

        // --- NEW LOGIC: Find Announcement Groups within specified Communities ---
        sourceGroups = chats.filter(chat =>
            chat.isGroup &&
            SOURCE_COMMUNITY_NAMES.includes(chat.name) &&
            chat.groupMetadata && chat.groupMetadata.announce === true
        );

        logger.debug(`[DEBUG] Grupos de Avisos identificados diretamente pelos nomes e flag 'announce': ${JSON.stringify(sourceGroups.map(g => ({ id: g.id._serialized, name: g.name, isGroup: g.isGroup, announce: g.groupMetadata ? g.groupMetadata.announce : false })), null, 2)}`);

        sourceGroupIds = sourceGroups.map(group => group.id._serialized);

        if (sourceGroups.length === 0) {
            logger.error(`Nenhum Grupo de Avisos foi encontrado com os nomes: "${SOURCE_COMMUNITY_NAMES.join(', ')}". Certifique-se de que os nomes correspondem exatamente aos canais de aviso das comunidades e que a flag 'announce' está presente.`);
            process.exit(1);
        }

        // Find the target group (remains the same)
        targetGroup = chats.find(chat => chat.isGroup && chat.name === TARGET_GROUP_NAME);
        logger.debug(`[DEBUG] Grupo de destino encontrado: ${targetGroup ? `${targetGroup.name} (${targetGroup.id._serialized})` : 'Nenhum'}`);

        if (!targetGroup) {
            logger.error(`Grupo de destino "${TARGET_GROUP_NAME}" não encontrado. Verifique o nome no .env.`);
            process.exit(1);
        }

        logger.info(`Monitorando Grupos de Avisos: "${sourceGroups.map(g => g.name).join(', ')}"`);
        logger.info(`Encaminhando para o grupo: "${targetGroup.name} (${targetGroup.id._serialized})"`);

        isReadyToProcessMessages = true; // Bot está pronto para processar mensagens
    });

    client.on('message', async (message) => {
        // Ensure the bot is ready to process messages
        if (!isReadyToProcessMessages) {
            logger.warn('Ignorando mensagem: Bot ainda não está pronto para processar.');
            return;
        }

        logger.debug(`[DEBUG] Mensagem recebida. Tipo: ${message.type}, De: ${message.from}, Corpo: ${message.body.substring(0, 50)}...`);

        // Only process incoming messages from the identified Announcement Groups
        if (!sourceGroupIds.includes(message.from) || message.fromMe) {
            return;
        }

        const chat = await message.getChat();
        // Ensure the message comes from one of the explicitly monitored Announcement Groups
        if (!chat.isGroup || !sourceGroupIds.includes(chat.id._serialized)) {
            logger.warn(`Mensagem ignorada de chat que não é um Grupo de Avisos monitorado: ${chat.name}`);
            return;
        }

        // Get the actual source group name for logging
        const actualSourceGroupName = chat.name;

        logger.info({
            timestamp: new Date().toISOString(),
            source_message_id: message.id.id,
            author: message.author || message.from,
            source_group: actualSourceGroupName, // Use actual group name here
            original_text: message.body,
            media_filenames: [],
            status: 'received',
            error_message: null,
        }, 'Nova mensagem recebida de um Grupo de Avisos monitorado.');

        // Deduplication check
        const messageIdentifier = message.id.id || `${message.body}-${message.hasMedia}`; // Fallback for ID
        if (forwardedMessages.has(messageIdentifier)) {
            const lastForwardTime = forwardedMessages.get(messageIdentifier);
            if ((Date.now() - lastForwardTime) / 1000 < DEDUPE_WINDOW_SECONDS) {
                logger.warn({
                    timestamp: new Date().toISOString(),
                    source_message_id: message.id.id,
                    author: message.author || message.from,
                    source_group: actualSourceGroupName, // Use actual group name here
                    original_text: message.body,
                    media_filenames: [],
                    status: 'skipped',
                    error_message: 'Mensagem duplicada ignorada dentro da janela de deduplicação.',
                }, 'Skipping duplicate message.');
                return;
            }
        }

        let mediaFilenames = [];
        let modifiedBody = message.body;

        // Process text for R$ and Atacado rules
        if (modifiedBody) {
            let firstRFoundInMessage = false;
            const lines = modifiedBody.split(/\r?\n/);
            const processedLines = [];

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                const priceRegex = /(R\$)\s*(\d+([.,]\d{1,2})?)/i;
                const match = line.match(priceRegex);

                if (match) {
                    const fullMatch = match[0];
                    const currencySymbol = match[1];
                    let priceString = match[2].replace(',', '.');
                    const originalPrice = parseFloat(priceString);

                    if (!isNaN(originalPrice)) {
                        if (!firstRFoundInMessage) {
                            // Use the chosen multiplier here
                            const multipliedPrice = (originalPrice * GLOBAL_PRICE_MULTIPLIER).toFixed(2).replace('.', ',');
                            line = line.replace(fullMatch, `${currencySymbol}${multipliedPrice}`);
                            firstRFoundInMessage = true;
                        } else {
                            const indexOfR = line.indexOf(currencySymbol);
                            if (indexOfR !== -1) {
                                line = line.substring(0, indexOfR).trim();
                            }
                        }
                    }
                }
                processedLines.push(line);
            }

            modifiedBody = processedLines.map(line => line.replace(/\s*-\s*Atacado|\s*Atacado/gi, '').trim()).join('\n');
        }

        if (message.hasMedia) {
            logger.info({
                timestamp: new Date().toISOString(),
                source_message_id: message.id.id,
                status: 'media_detected',
            }, 'Message detected with media. Attempting to download...');
            console.log(`[DEBUG] Media download STARTED for message ${message.id.id}.`);
            try {
                const media = await message.downloadMedia();
                console.log(`[DEBUG] Media download COMPLETED for message ${message.id.id}.`);
                if (media) {
                    logger.info({
                        timestamp: new Date().toISOString(),
                        source_message_id: message.id.id,
                        mimetype: media.mimetype,
                        data_length: media.data.length, // Log data length to confirm content
                        status: 'media_downloaded',
                    }, 'Media downloaded successfully. Attempting to send...');

                    const extension = media.mimetype.split('/')[1] || 'bin';
                    const filename = `media-${message.id.id}.${extension}`;
                    const mediaToSend = new MessageMedia(media.mimetype, media.data, filename);
                    
                    // Send media FIRST, without caption, and without any delay
                    logger.info({ timestamp: new Date().toISOString(), source_message_id: message.id.id, status: 'attempting_send_media_only' }, 'Attempting to send media message only.');
                    console.log(`[DEBUG] Media send STARTED (no delay) for message ${message.id.id}.`);
                    await client.sendMessage(targetGroup.id._serialized, mediaToSend);
                    console.log(`[DEBUG] Media send COMPLETED for message ${message.id.id}.`);

                    mediaFilenames.push(filename);
                    logger.info(`Media forwarded: ${filename}`);
                    
                    // If there's text, apply delay and send as a separate message
                    if (modifiedBody && modifiedBody.trim() !== '') { // Ensure there's actual content after processing
                        logger.info(`Applying ${MEDIA_SEND_DELAY_MS}ms delay before sending text message.`);
                        console.log(`[DEBUG] TEXT DELAY STARTED (${MEDIA_SEND_DELAY_MS}ms) for message ${message.id.id}.`); // Explicit console log
                        await new Promise(resolve => setTimeout(resolve, MEDIA_SEND_DELAY_MS));
                        console.log(`[DEBUG] TEXT DELAY COMPLETED for message ${message.id.id}. Sending text now.`); // Explicit console log
                        await client.sendMessage(targetGroup.id._serialized, modifiedBody);
                        logger.info('Text message sent after media.');
                    }

                } else {
                    logger.warn({
                        timestamp: new Date().toISOString(),
                        source_message_id: message.id.id,
                        status: 'media_download_failed_no_data',
                    }, 'message.downloadMedia() returned null or undefined.');
                }
            } catch (mediaError) {
                logger.error({
                    timestamp: new Date().toISOString(),
                    source_message_id: message.id.id,
                    author: message.author || message.from,
                    source_group: actualSourceGroupName, // Use actual group name here
                    original_text: message.body,
                    media_filenames: [],
                    status: 'error',
                    error_message: `Failed to download or send media: ${mediaError.message}`,
                }, 'Error handling media.');
            }
        } else if (modifiedBody && modifiedBody.trim() !== '') { // Only send text if no media was detected and there's actual modifiedBody
            try {
                logger.info({ timestamp: new Date().toISOString(), source_message_id: message.id.id, status: 'attempting_send_text_only' }, 'Attempting to send text-only message.');
                console.log(`[DEBUG] TEXT DELAY STARTED (${MEDIA_SEND_DELAY_MS}ms) for message ${message.id.id}. (Text Only)`); // Explicit console log for text-only
                await new Promise(resolve => setTimeout(resolve, MEDIA_SEND_DELAY_MS));
                console.log(`[DEBUG] TEXT DELAY COMPLETED for message ${message.id.id}. Sending text now. (Text Only)`); // Explicit console log for text-only
                await client.sendMessage(targetGroup.id._serialized, modifiedBody);
                logger.info('Text message (possibly modified) forwarded.');
            } catch (textError) {
                logger.error({
                    timestamp: new Date().toISOString(),
                    source_message_id: message.id.id,
                    author: message.author || message.from,
                    source_group: actualSourceGroupName, // Use actual group name here
                    original_text: message.body,
                    modified_text: modifiedBody, // Log modified text too
                    media_filenames: mediaFilenames,
                    status: 'error',
                    error_message: `Failed to send text message: ${textError.message}`,
                }, 'Error sending text message.');
            }
        }

        forwardedMessages.set(messageIdentifier, Date.now());

        logger.info({
            timestamp: new Date().toISOString(),
            source_message_id: message.id.id,
            author: message.author || message.from,
            source_group: actualSourceGroupName, // Use actual group name here
            target_group: targetGroup.name,
            original_text: message.body,
            media_filenames: mediaFilenames,
            status: 'sent',
            error_message: null,
        }, 'Message fully processed and forwarded.');
    });

    client.on('auth_failure', msg => {
        logger.error(`Authentication failure: ${msg}`);
    });

    client.on('disconnected', reason => {
        logger.error(`Client disconnected: ${reason}`);
    });

    client.initialize();
})(); 