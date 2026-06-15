const vinted = require('./vinted');

(async () => {
  try {
    console.log('Lancement d\'un scan unique (mode test) — aucun message Telegram envoyé.');
    const items = await vinted.searchItems();
    console.log(`Articles trouvés: ${items.length}`);
    console.log('Exemples (max 10):');
    items.slice(0, 10).forEach((it, i) => {
      console.log(`${i + 1}. ${it.title} — ${it.price} ${it.currency} — ${it.url} (id:${it.id})`);
    });
  } catch (err) {
    console.error('Erreur pendant le scan:', err.message || err);
    process.exit(1);
  }
})();
