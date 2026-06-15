const https = require('https');
const vinted = require('./vinted');
const telegram = require('./telegram');
const config = require('./config');

const path = require('path');
const seenIds = require('./seenIds');

const seenIdsFile = path.resolve(process.cwd(), config.state && config.state.seenIdsFile ? config.state.seenIdsFile : 'seenIds.json');
let autosaveIntervalId = null;

function loadSeenIds() {
  seenIds.load(seenIdsFile);
}

function saveSeenIds() {
  seenIds.save(seenIdsFile);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomInterval() {
  // Non-uniform human-like distribution: often ~5s, often ~7s, rarely ~8s
  const p = Math.random();
  let seconds;
  if (p < 0.6) seconds = 5;
  else if (p < 0.95) seconds = 7;
  else seconds = 8;
  // small jitter +/-200ms
  seconds += (Math.random() - 0.5) * 0.4;
  return Math.max(1000, Math.round(seconds * 1000));
}

function registerSeenId(id) {
  return seenIds.register(id);
}

async function loadInitialItems() {
  // Load persisted seen IDs first
  loadSeenIds();

  const items = await vinted.searchItems();
  items.forEach((item) => {
    if (item.id) {
      seenIds.add(item.id);
    }
  });
  console.log(`Initialisation terminée : ${items.length} annonces récupérées, ${seenIds.size()} IDs en mémoire.`);
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
    if (!registerSeenId(item.id)) {
      continue;
    }

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

  // Start autosave of seenIds
  try {
    const autosaveMs = config.state && config.state.autosaveIntervalMs ? config.state.autosaveIntervalMs : 60000;
    autosaveIntervalId = setInterval(saveSeenIds, autosaveMs);
  } catch (e) {
    // ignore
  }

  while (true) {
    try {
      await checkForNewItems();
    } catch (error) {
      console.error('Erreur pendant la vérification:', error.message || error);
    }

    // Occasionally take a longer break to mimic human inactivity (1 in 20)
    if (Math.random() < 0.05) {
      const longPause = 30000 + Math.floor(Math.random() * 60000); // 30s-90s
      console.log(`Pause longue aléatoire de ${Math.round(longPause/1000)}s...`);
      await sleep(longPause);
    }

    const delay = getRandomInterval();
    console.log(`Pause de ${Math.round(delay / 1000)}s avant la prochaine recherche...`);
    await sleep(delay);
  }
}

function shutdownAndExit(code = 0) {
  console.log('Sauvegarde de l\'état avant arrêt...');
  try {
    if (autosaveIntervalId) clearInterval(autosaveIntervalId);
    saveSeenIds();
  } catch (e) {
    console.error('Erreur lors de la sauvegarde:', e.message || e);
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdownAndExit(0));
process.on('SIGTERM', () => shutdownAndExit(0));
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdownAndExit(1);
});

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
