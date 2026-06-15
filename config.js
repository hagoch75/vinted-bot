const config = {
  telegram: {
    botToken: '8914340627:AAERAOn_YGo_TTPDPl0kMGzweANhjlDBALQ',
    chatId: '-5333640255'
  },
  search: {
    keywords: ['nike running', 'nike dri fit', 'nike division', 'under armour'],
    sizes: ['M', 'L'],
    brands: ['Nike', 'Adidas'],
    conditions: ['good', 'very_good', 'like_new'],
    perPage: 100,
    locale: 'en_GB',
    currency: 'GBP',
    country: 'GB',
    minIntervalSeconds: 10,
    maxIntervalSeconds: 16,
    maxPages: 2
  },
  webhook: {
    url: ''
  },
  vinted: {
    host: 'www.vinted.co.uk',
    path: '/api/v2/catalog/items'
  }
};

module.exports = config;
