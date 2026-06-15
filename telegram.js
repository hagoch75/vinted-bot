const https = require('https');
const config = require('./config');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCaption(item) {
  const lines = [
    `<b>${escapeHtml(item.title)}</b>`,
    `Price: ${escapeHtml(item.price)} ${escapeHtml(item.currency)}`,
    `Size: ${escapeHtml(item.size || 'N/A')}`,
    `Brand: ${escapeHtml(item.brand || 'N/A')}`,
    `Condition: ${escapeHtml(item.condition || 'N/A')}`,
    `${escapeHtml(item.url)}`
  ];

  return lines.join('\n');
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(raw);
          if (!result.ok) {
            return reject(new Error(`Telegram error: ${raw}`));
          }
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendItem(item) {
  const caption = buildCaption(item);
  const token = config.telegram.botToken;
  const chatId = config.telegram.chatId;

  if (!token || !chatId || token === 'YOUR_TELEGRAM_BOT_TOKEN' || chatId === 'YOUR_CHAT_ID') {
    throw new Error('Telegram botToken and chatId must be set in config.js');
  }

  // Si on a des photos, envoyer jusqu'à 3 photos en mediaGroup
  if (item.photos && item.photos.length > 0) {
    const mediaGroup = item.photos.slice(0, 3).map((photoUrl, index) => ({
      type: 'photo',
      media: photoUrl,
      caption: index === 0 ? caption : undefined,
      parse_mode: index === 0 ? 'HTML' : undefined
    }));

    return post(`/bot${token}/sendMediaGroup`, {
      chat_id: chatId,
      media: mediaGroup
    });
  }

  // Fallback si pas de photos complètes, utiliser photoUrl (première photo)
  if (item.photoUrl) {
    return post(`/bot${token}/sendPhoto`, {
      chat_id: chatId,
      photo: item.photoUrl,
      caption,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
  }

  // Fallback sans photo
  return post(`/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: caption,
    parse_mode: 'HTML',
    disable_web_page_preview: false
  });
}

module.exports = {
  sendItem
};
