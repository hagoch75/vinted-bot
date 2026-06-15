const config = {
  telegram: {
    botToken: '8914340627:AAERAOn_YGo_TTPDPl0kMGzweANhjlDBALQ',
    chatId: '-5333640255'
  },
  search: {
    keywords: ['Under Armour Pants', 'Nike elite', 'Nike running division', 'nike Trail', 'nike running', 'nike therma fit'],
    sizes: ['M', 'L'],
    brands: ['Nike', 'Adidas'],
    conditions: ['good', 'very_good', 'like_new'],
    perPage: 30,
    // Minimum gap between individual HTTP requests to Vinted (ms)
    minRequestIntervalMs: 2000,
    locale: 'en_GB',
    currency: 'GBP',
    country: 'GB',
    // Increased intervals to reduce request frequency
    minIntervalSeconds: 12,
    maxIntervalSeconds: 20,
    maxPages: 2
  },
  webhook: {
    url: ''
  },
  state: {
    // File to persist seen IDs between restarts
    seenIdsFile: 'seenIds.json',
    // Autosave interval in ms
    autosaveIntervalMs: 60000
  },
  vinted: {
    host: 'www.vinted.co.uk',
    path: '/api/v2/catalog/items'
  }
};

module.exports = config;
