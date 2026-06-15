const https = require('https');
const vinted = require('./vinted');
const telegram = require('./telegram');
const config = require('./config');

const seenIds = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomInterval() {
  const min = config.search.minIntervalSeconds;
  const max = config.search.maxIntervalSeconds;
  return Math.round(min * 1000 + Math.random() * ((max - min) * 1000));
}

async function loadInitialItems() {
  const items = await vinted.searchItems();
  items.forEach((item) => {
    if (item.id) {
      seenIds.add(item.id);
    }
  });
  console.log(`Initialisation terminée : ${items.length} annonces enregistrées.`);
}

function postWebhook(item) {
  if (!config.webhook || !config.webhook.url) {
    return Promise.resolve();
  }

  const webhookUrl = new URL(config.webhook.url);
  const payload = JSON.stringify({
    id: item.id,
    title: item.title,
    price: item.price,
    currency: item.currency,
    size: item.size,
    brand: item.brand,
    condition: item.condition,
    url: item.url,
    photos: item.photos,
    created_at_ts: item.created_at_ts
  });

  const options = {
    hostname: webhookUrl.hostname,
    path: webhookUrl.pathname + webhookUrl.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }; 

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(raw);
        } else {
          reject(new Error(`Webhook returned status ${res.statusCode}: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function checkForNewItems() {
  console.log('Recherche de nouvelles annonces...');
  const items = await vinted.searchItems();
  let newCount = 0;

  for (const item of items) {
    if (!item.id || seenIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    newCount += 1;
    console.log(`Nouvelle annonce trouvée: ${item.title} (${item.id})`);

    try {
      await telegram.sendItem(item);
    } catch (error) {
      console.error(`Erreur envoi Telegram pour ${item.id}:`, error.message || error);
      try {
        await postWebhook(item);
        console.log(`Notification de secours envoyée pour ${item.id}`);
      } catch (webhookError) {
        console.error(`Erreur webhook de secours pour ${item.id}:`, webhookError.message || webhookError);
      }
    }
  }

  if (newCount === 0) {
    console.log('Aucune nouvelle annonce trouvée.');
  }
}

async function start() {
  console.log('Démarrage du bot Vinted UK...');
  await loadInitialItems();
  console.log(`Le bot vérifiera les nouvelles annonces toutes les ${config.search.minIntervalSeconds}-${config.search.maxIntervalSeconds} secondes (intervalle aléatoire).`);

  while (true) {
    try {
      await checkForNewItems();
    } catch (error) {
      console.error('Erreur pendant la vérification:', error.message || error);
    }

    const delay = getRandomInterval();
    console.log(`Pause de ${Math.round(delay / 1000)}s avant la prochaine recherche...`);
    await sleep(delay);
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

if (require.main === module) {
  start().catch((error) => {
    console.error('Impossible de démarrer le bot:', error.message || error);
    process.exit(1);
  });
}

module.exports = {
  start
};
