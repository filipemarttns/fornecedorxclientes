const assert = require('assert');
const sinon = require('sinon');

// Mock whatsapp-web.js components
const mockClient = {
    on: sinon.stub(),
    initialize: sinon.stub(),
    getChats: sinon.stub().resolves([
        { isGroup: true, name: "Fornecedores", id: { _serialized: "123@g.us" } },
        { isGroup: true, name: "Clientes", id: { _serialized: "456@g.us" } },
        { isGroup: false, name: "OtherChat", id: { _serialized: "789@c.us" } },
    ]),
    sendMessage: sinon.stub().resolves(true),
};

const mockMessage = (id, body, hasMedia = false, from = "123@g.us") => ({
    id: { id: id },
    body: body,
    hasMedia: hasMedia,
    from: from,
    fromMe: false,
    getChat: sinon.stub().resolves({
        isGroup: true,
        name: "Fornecedores",
        id: { _serialized: "123@g.us" },
    }),
    downloadMedia: sinon.stub().resolves(hasMedia ? { mimetype: 'image/jpeg', data: 'base64data' } : null),
});

const mockMessageMedia = (mimetype, data, filename) => ({
    mimetype: mimetype,
    data: data,
    filename: filename,
});

// Stub global objects if necessary for the module under test
global.Client = function() { return mockClient; };
global.LocalAuth = function() { return {}; };
global.MessageMedia = mockMessageMedia;
global.qrcode = { generate: sinon.stub() };
global.pino = sinon.stub().returns({
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
});

// Require the module to be tested *after* mocks are set up
require('./index'); 

// Access the message handler directly from the client.on stub
let messageHandler;
// Find the message handler from the stub calls
for (const call of mockClient.on.getCalls()) {
    if (call.args[0] === 'message') {
        messageHandler = call.args[1];
        break;
    }
}

// Find the ready handler
let readyHandler;
for (const call of mockClient.on.getCalls()) {
    if (call.args[0] === 'ready') {
        readyHandler = call.args[1];
        break;
    }
}

describe('WhatsApp Forwarder Bot', () => {

    beforeEach(() => {
        // Reset mocks before each test
        sinon.resetHistory();
        // Clear forwardedMessages map (if accessible, otherwise rely on fresh require)
        // For simplicity, we'll re-require in tests or ensure the map is cleared via a test helper if needed
    });

    it('should forward a text message from Fornecedores to Clientes', async () => {
        await readyHandler(); // Simulate client ready event
        const message = mockMessage('msg1', 'Hello from Fornecedores');
        await messageHandler(message);

        assert(mockClient.sendMessage.calledOnceWith('456@g.us', 'Hello from Fornecedores'), 'Text message not forwarded correctly.');
    });

    it('should forward media and then text from Fornecedores to Clientes', async () => {
        await readyHandler();
        const message = mockMessage('msg2', 'Check out this image', true);
        await messageHandler(message);

        assert(mockClient.sendMessage.calledWith('456@g.us', sinon.match.instanceOf(mockMessageMedia)), 'Media not forwarded.');
        assert(mockClient.sendMessage.calledWith('456@g.us', 'Check out this image'), 'Text not forwarded after media.');
        assert(mockClient.sendMessage.callCount === 2, 'Expected two messages (media and text).');
    });

    it('should skip duplicate messages within the deduplication window', async () => {
        await readyHandler();
        const message1 = mockMessage('msg3', 'Duplicate message test');
        await messageHandler(message1);
        await messageHandler(message1); // Send same message again

        assert(mockClient.sendMessage.calledOnce, 'Duplicate message was forwarded.');
    });

    it('should forward messages if deduplication window has passed', async () => {
        await readyHandler();
        const message1 = mockMessage('msg4', 'Time-based duplicate test');
        await messageHandler(message1);

        // Manually advance time beyond DEDUPE_WINDOW_SECONDS
        const clock = sinon.useFakeTimers(Date.now() + (DEDUPE_WINDOW_SECONDS * 1000) + 1000);
        await messageHandler(message1);
        clock.restore();

        assert(mockClient.sendMessage.calledTwice, 'Message not forwarded after dedupe window.');
    });

    it('should log an error if media download fails but still send text', async () => {
        await readyHandler();
        const message = mockMessage('msg5', 'Text with failed media', true);
        message.downloadMedia.rejects(new Error('Download failed'));

        await messageHandler(message);

        assert(global.pino().error.calledWith(sinon.match({
            error_message: sinon.match(/Failed to download or send media/)
        })), 'Error for failed media not logged.');
        assert(mockClient.sendMessage.calledOnceWith('456@g.us', 'Text with failed media'), 'Text message not sent after media failure.');
    });

    it('should not forward messages from other groups', async () => {
        await readyHandler();
        const message = mockMessage('msg6', 'Hello from OtherChat', false, '789@c.us');
        message.getChat.resolves({ isGroup: false, name: "OtherChat", id: { _serialized: "789@c.us" } });
        await messageHandler(message);

        assert(mockClient.sendMessage.notCalled, 'Message from other group was forwarded.');
    });
}); 