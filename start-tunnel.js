// Script to start Cloudflare Quick Tunnel and send URL to Telegram
const { spawn } = require('child_process');
const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8762225638:AAGbQ6umdkkWaj8WoUqoQWFzi_xIgyh7vsU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '7122063649';
const LOCAL_URL = 'http://localhost:3000';

function sendTelegram(message) {
  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML',
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options);
  req.write(body);
  req.end();
}

function startTunnel() {
  console.log('Starting Cloudflare Tunnel...');

  const tunnel = spawn('cloudflared', ['tunnel', '--url', LOCAL_URL], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let urlSent = false;

  // Cloudflare prints the tunnel URL to stderr
  tunnel.stderr.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (!urlSent) {
      // Match trycloudflare.com URL
      const match = output.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
      if (match) {
        const tunnelUrl = match[0];
        urlSent = true;
        console.log(`\nTunnel URL: ${tunnelUrl}`);

        const message =
          `🌐 <b>Love Memory Web đang online!</b>\n\n` +
          `🔗 Link: ${tunnelUrl}\n\n` +
          `💕 Quân &amp; Lành`;

        sendTelegram(message);
        console.log('Telegram notification sent!');
      }
    }
  });

  tunnel.stdout.on('data', (data) => {
    process.stdout.write(data.toString());
  });

  tunnel.on('close', (code) => {
    console.log(`Tunnel closed with code ${code}`);
    sendTelegram('⚠️ Love Memory Web tunnel đã đóng!');
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    tunnel.kill();
    process.exit();
  });
}

startTunnel();
