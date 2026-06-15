const vinted = require('./vinted');

async function test() {
  const items = await vinted.searchItems();
  console.log('Total items returned:', items.length);
  if (items.length > 0) {
    console.log('\nFirst item:');
    console.log(JSON.stringify(items[0], null, 2));
  } else {
    console.log('\nNo items returned. Let me check raw API response...');
    // Faire un appel direct pour voir ce que l'API retourne
  }
}

test().catch(err => console.error('Error:', err.message));

