const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const app = express();

app.get('/api/pair', async (req, res) => {
    let phone = req.query.phone;
    if (!phone) return res.json({ error: "Number missing" });

    // Vercel /tmp folder use karne deta hai
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/' + phone);
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Chrome (Linux)", "", ""]
    });

    try {
        // Pairing code request
        await delay(2000);
        let code = await sock.requestPairingCode(phone.replace(/[^0-9]/g, ''));
        
        // Response jaldi bhejna zaroori hai Vercel par
        res.status(200).json({ code: code });
        
        // Background mein connection monitor karein (sirf 30 seconds tak)
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (s) => {
            if (s.connection === "open") {
                const sessionID = Buffer.from(JSON.stringify(state.creds)).toString('base64');
                await sock.sendMessage(sock.user.id, { text: "SESSION-ID: " + sessionID });
            }
        });
    } catch (err) {
        res.json({ error: "Vercel Timeout. Try Again." });
    }
});

module.exports = app;
