const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config(); // Load environment variables from .env file

// Função para encontrar o Chrome no sistema
function findChromePath() {
    const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
            return chromePath;
        }
    }
    
    return undefined;
}

// Configuration
const SOURCE_COMMUNITY_NAMES = (process.env.SOURCE_COMMUNITY_NAMES || "").split(',').map(name => name.trim()).filter(n => n);
// Permite lista explícita de canais de anúncio (separados por vírgula)
const ANNOUNCEMENT_GROUP_NAMES = (process.env.ANNOUNCEMENT_GROUP_NAMES || process.env.ANNOUNCEMENT_GROUP_NAME || "")
  .split(',')
  .map(name => name.trim())
  .filter(n => n);
// Nome padrão para o canal da comunidade (comportamento típico do WhatsApp): "Avisos"
const ANNOUNCEMENT_GROUP_NAME = process.env.ANNOUNCEMENT_GROUP_NAME || "Avisos";
const TARGET_GROUP_NAME = process.env.TARGET_GROUP_NAME || "OJ® Streetwear Shop & Sneakers";
const DEDUPE_WINDOW_SECONDS = parseInt(process.env.DEDUPE_WINDOW_SECONDS || "10", 10);
const MEDIA_SEND_DELAY_MS = parseInt(process.env.MEDIA_SEND_DELAY_MS || "20000", 10); // Reintroduced and set default to 20 seconds
const LOG_PATH = process.env.LOG_PATH || './wh_relay.log';
const HEADLESS = process.env.HEADLESS === 'true' || process.env.HEADLESS === true; // Usar .env para controlar headless

let GLOBAL_PRICE_MULTIPLIER = parseInt(process.env.GLOBAL_PRICE_MULTIPLIER) || 3; // Usar .env ou default 3

// Normalização e listas de filtro (escopo global)
function normalize(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
const communityWanted = SOURCE_COMMUNITY_NAMES.map(normalize);
const defaultAnnouncementNames = [normalize(ANNOUNCEMENT_GROUP_NAME), 'anuncios', 'anúncios', 'announcements'];
const announcementWanted = (ANNOUNCEMENT_GROUP_NAMES.length > 0
    ? ANNOUNCEMENT_GROUP_NAMES
    : [ANNOUNCEMENT_GROUP_NAME]
).map(normalize).concat(defaultAnnouncementNames);

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

// Função removida - agora usa apenas o .env

(async () => {
    logger.info('Starting WhatsApp Forwarder Bot...');
    
    // Usar sempre o valor do .env (não fazer pergunta)
    console.log(`[DEBUG] Multiplicador de preço configurado: ${GLOBAL_PRICE_MULTIPLIER}`);

    logger.info(`Source Communities: "${SOURCE_COMMUNITY_NAMES.join(', ')}"`); // Log communities
    logger.info(`Announcement Group Name: "${ANNOUNCEMENT_GROUP_NAME}"`); // Log announcement group name
    logger.info(`Target Group: "${TARGET_GROUP_NAME}"`);
    logger.info(`Dedupe Window: ${DEDUPE_WINDOW_SECONDS} seconds`);
    logger.info(`Media Send Delay: ${MEDIA_SEND_DELAY_MS} milliseconds`);
    logger.info(`Log Path: "${LOG_PATH}"`);
    logger.info(`Headless Mode: ${HEADLESS}`);

    // Encontrar o Chrome no sistema
    const chromePath = findChromePath();
    if (chromePath) {
        console.log(`[DEBUG] Chrome encontrado em: ${chromePath}`);
    } else {
        console.log('[DEBUG] Chrome não encontrado, usando Chromium embutido');
    }

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: 'whatsapp-forwarder' }),
        puppeteer: {
            headless: HEADLESS,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            executablePath: chromePath || undefined, // Usar Chrome do sistema se disponível
        }
    });

    let sourceGroups = []; // Changed to an array of announcement groups
    let sourceGroupIds = []; // New array to store IDs of announcement groups
    let targetGroup;
    let isReadyToProcessMessages = false; // Flag para indicar que o bot está pronto para processar mensagens
    const forwardedMessages = new Map(); // Map to store forwarded message hashes/IDs and their timestamps

    client.on('qr', (qr) => {
        console.log('\n=== QR CODE PARA AUTENTICAÇÃO ===');
        qrcode.generate(qr, { small: true });
        console.log('=== ESCANEIE O QR CODE ACIMA COM SEU WHATSAPP ===\n');
        logger.info('QR RECEIVED. Scan with your WhatsApp app.');
    });

    client.on('ready', async () => {
        console.log('\n✅ WhatsApp conectado com sucesso!');
        console.log('🤖 Bot iniciado e monitorando grupos...\n');
        logger.info('Client is ready!');

        const chats = await client.getChats();

        // Log all group names found for debugging
        const groupNamesFound = chats.filter(chat => chat.isGroup).map(chat => chat.name);
        logger.info(`[DEBUG] Todos os nomes de grupos encontrados no WhatsApp: [${groupNamesFound.join(', ')}]`);

        // Detailed log of all chats found (for community debugging)
        const allChatsDetails = chats.map(chat => JSON.parse(JSON.stringify(chat))); // Deep copy to get all properties
        logger.debug(`[DEBUG] Detalhes completos de TODOS os chats encontrados: ${JSON.stringify(allChatsDetails, null, 2)}`);

        // --- NEW LOGIC (revisado): Encontrar Canais de Aviso ---
        // Regras:
        // 1) Se ANNOUNCEMENT_GROUP_NAMES estiver definido, casar por igualdade OU "contém" (case-insensitive)
        // 2) Caso contrário, usar SOURCE_COMMUNITY_NAMES como filtro por "contém" (case-insensitive) nos nomes dos canais com announce=true
        // 3) Se nada for definido, monitorar TODOS os canais com announce=true (com aviso no log)

        const announcedChats = chats.filter(chat => chat.isGroup && chat.groupMetadata && chat.groupMetadata.announce === true);
        logger.info(`[ANNOUNCE] Canais com announce=true encontrados: [${announcedChats.map(c => c.name).join(', ')}]`);
        logger.info(`[ANNOUNCE] communityWanted: [${communityWanted.join(', ')}]; announcementWanted: [${announcementWanted.join(', ')}]`);

        if (communityWanted.length > 0 || announcementWanted.length > 0) {
            sourceGroups = announcedChats.filter(chat => {
                const nameN = normalize(chat.name);
                const matchesCommunity = communityWanted.length > 0 && communityWanted.some(w => nameN.includes(w) || nameN === w);
                const matchesAnnouncementName = announcementWanted.some(w => w && (nameN === w || nameN.includes(w)));
                const accepted = matchesCommunity || matchesAnnouncementName;
                logger.debug(`[ANNOUNCE_MATCH] name="${chat.name}" announce=true matchesCommunity=${matchesCommunity} matchesAnnouncementName=${matchesAnnouncementName} accepted=${accepted}`);
                return accepted;
            });
        } else {
            // Fallback: monitora todos os canais de anúncio encontrados
            sourceGroups = announcedChats;
            logger.warn('Nenhum filtro de nomes fornecido. Monitorando TODOS os canais de anúncio encontrados.');
        }

        logger.debug(`[DEBUG] Grupos de Avisos identificados (announce=true, com matching flexível): ${JSON.stringify(sourceGroups.map(g => ({ id: g.id._serialized, name: g.name, isGroup: g.isGroup, announce: g.groupMetadata ? g.groupMetadata.announce : false })), null, 2)}`);

        sourceGroupIds = sourceGroups.map(group => group.id._serialized);

        if (sourceGroups.length === 0) {
            logger.error(`Nenhum Canal de Avisos encontrado de acordo com os filtros.
Filtros usados -> ANNOUNCEMENT_GROUP_NAMES: [${ANNOUNCEMENT_GROUP_NAMES.join(', ')}]; SOURCE_COMMUNITY_NAMES: [${SOURCE_COMMUNITY_NAMES.join(', ')}].
Verifique os nomes no WhatsApp, inclusive acentuação e variações, ou deixe vazio para monitorar todos os canais com announce=true.`);
            process.exit(1);
        }

        // Find the target group (remains the same)
        targetGroup = chats.find(chat => chat.isGroup && chat.name === TARGET_GROUP_NAME);
        logger.debug(`[DEBUG] Grupo de destino encontrado: ${targetGroup ? `${targetGroup.name} (${targetGroup.id._serialized})` : 'Nenhum'}`);

        if (!targetGroup) {
            logger.error(`Grupo de destino "${TARGET_GROUP_NAME}" não encontrado. Verifique o nome no .env.`);
            process.exit(1);
        }

        logger.info(`Monitorando Canais de Aviso: "${sourceGroups.map(g => g.name).join(', ')}"`);
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

        // --- NEW LOGIC: Filter messages based on keywords ---
        const messageBodyLower = message.body.toLowerCase();
        if (messageBodyLower.includes('bom dia')) {
            logger.info(`[FILTRO] Mensagem ignorada devido se de bom dia: "${message.body.substring(0, 50)}..."`);
            return;
        }
        // --- END NEW LOGIC ---

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
        console.log('Erro de autenticação. Verifique se o QR code foi escaneado corretamente.');
    });

    client.on('disconnected', reason => {
        logger.error(`Client disconnected: ${reason}`);
        console.log('Cliente desconectado. Tentando reconectar...');
    });

    // Tratamento de erros não capturados
    process.on('uncaughtException', (error) => {
        logger.error(`Uncaught Exception: ${error.message}`);
        console.log('Erro não capturado:', error.message);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
        console.log('Promise rejeitada:', reason);
    });

    try {
        await client.initialize();
    } catch (error) {
        logger.error(`Failed to initialize client: ${error.message}`);
        console.log('Erro ao inicializar cliente:', error.message);
        process.exit(1);
    }
})(); 