const https = require('https');
const zlib = require('zlib');
const config = require('./config');

let sessionCookies = 'locale=en_GB;';
let accessToken = '';
let lastSessionFetch = 0;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  const delaySeconds = 2 + Math.random() * 3;
  return sleep(Math.round(delaySeconds * 1000));
}

function extractAccessToken(cookies) {
  const match = cookies.match(/access_token_web=([^;]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return '';
}

function buildQuery(params) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function shuffleArray(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Récupère les cookies de session anonyme depuis la page principale
function getSessionCookies() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.vinted.co.uk',
      path: '/',
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        'DNT': '1',
        'User-Agent': getRandomUserAgent(),
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Chromium";v="126", "Not A(Brand)";v="99", "Google Chrome";v="126"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
      }
    };

    https.get(options, (res) => {
      const cookies = res.headers['set-cookie'] || [];
      let cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      
      // Garder le cookie locale=en_GB s'il n'est pas déjà présent
      if (cookieString && !cookieString.includes('locale=en_GB')) {
        cookieString += '; locale=en_GB';
      } else if (!cookieString) {
        cookieString = 'locale=en_GB';
      }

      // Extraire le token d'accès
      const token = extractAccessToken(cookieString);
      if (token) {
        accessToken = token;
      }

      let stream = res;
      const encoding = res.headers['content-encoding'];

      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }

      stream.on('data', () => {});
      stream.on('end', () => {
        sessionCookies = cookieString;
        lastSessionFetch = Date.now();
        resolve(cookieString);
      });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function ensureSessionCookies() {
  const sessionAge = Date.now() - lastSessionFetch;
  if (!sessionCookies || sessionAge > 5 * 60 * 1000) {
    await getSessionCookies();
  }
}

async function requestJson(path, retry = true) {
  await ensureSessionCookies();
  await randomDelay();

  const options = {
    hostname: config.vinted.host,
    path,
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
      'DNT': '1',
      'Host': config.vinted.host,
      'Origin': 'https://www.vinted.co.uk',
      'Referer': 'https://www.vinted.co.uk/',
      'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': getRandomUserAgent(),
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Authorization': accessToken ? `Bearer ${accessToken}` : 'Bearer ',
      'Cookie': sessionCookies
    }
  };

  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      let stream = res;
      const encoding = res.headers['content-encoding'];

      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }

      let raw = '';
      stream.on('data', (chunk) => raw += chunk);
      stream.on('end', async () => {
        if (res.statusCode === 403 && retry) {
          try {
            console.warn('Vinted API returned 403, attente 10s puis réessai');
            await sleep(10000);
            resolve(await requestJson(path, false));
          } catch (retryError) {
            reject(retryError);
          }
          return;
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Vinted API returned ${res.statusCode}`));
        }

        try {
          const parsed = JSON.parse(raw);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

function getPhotoUrl(item) {
  // Essayer d'abord le champ photo principal
  if (item.photo && item.photo.url) {
    return item.photo.url;
  }

  // Essayer les photos dans l'array
  if (item.photos && item.photos.length) {
    return item.photos[0].url || item.photos[0].thumbnail || item.photos[0].medium;
  }

  return null;
}

function getSize(item) {
  const size = item.size_title || (item.size && item.size.title) || item.size || '';
  // Extraire juste la première partie de la taille (avant " / ")
  return size.split(' / ')[0].trim();
}

function getBrand(item) {
  return item.brand_title || (item.brand && item.brand.title) || item.brand || '';
}

function getCondition(item) {
  return item.condition || item.item_condition || item.condition_type || '';
}

function normalizeItem(item) {
  // Extraire le prix
  let price = 0;
  if (item.price) {
    if (typeof item.price === 'number') {
      price = item.price;
    } else if (item.price.amount) {
      price = parseFloat(item.price.amount) || 0;
    }
  }

  // Extraire les photos
  const photos = [];
  if (item.photos && Array.isArray(item.photos)) {
    photos.push(...item.photos.map(p => p.url).filter(url => url));
  } else if (item.photo && item.photo.url) {
    photos.push(item.photo.url);
  }

  // Extraire le timestamp de création (si disponible)
  let createdAtTs = null;
  if (item.created_at_ts) {
    createdAtTs = item.created_at_ts;
  } else if (item.created_at) {
    // Si c'est une date ISO, convertir en timestamp
    createdAtTs = Math.floor(new Date(item.created_at).getTime() / 1000);
  }

  return {
    id: item.id || item.item_id,
    title: item.title || item.name || '',
    price: price,
    currency: item.currency || (item.price && item.price.currency_code) || config.search.currency,
    size: getSize(item),
    brand: getBrand(item),
    condition: getCondition(item),
    photoUrl: getPhotoUrl(item),
    photos: photos,
    created_at_ts: createdAtTs,
    url: item.url || item.path || `https://www.vinted.co.uk/items/${item.id}`
  };
}

function filterItem(item) {
  if (!item.id) {
    return false;
  }

  // Filtrer les annonces des 24 dernières heures (si timestamp existe)
  // Condition: Date.now()/1000 - item.created_at_ts < 86400 (24h * 3600s)
  if (item.created_at_ts !== null && item.created_at_ts !== undefined) {
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = now - item.created_at_ts;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60; // 86400 secondes
    if (timeDiff > TWENTY_FOUR_HOURS) {
      return false;
    }
  }
  // Si pas de timestamp, garder l'annonce (le tri newest_first ordonne déjà par date)

  if (config.search.sizes && config.search.sizes.length) {
    const normalizedSize = item.size.toString().toLowerCase();
    const allowedSizes = config.search.sizes.map((size) => size.toString().toLowerCase());
    if (!allowedSizes.includes(normalizedSize)) {
      return false;
    }
  }

  if (config.search.brands && config.search.brands.length) {
    const normalizedBrand = item.brand.toString().toLowerCase();
    const allowedBrands = config.search.brands.map((brand) => brand.toString().toLowerCase());
    if (normalizedBrand && !allowedBrands.includes(normalizedBrand)) {
      return false;
    }
  }

  if (config.search.conditions && config.search.conditions.length) {
    const normalizedCondition = item.condition.toString().toLowerCase();
    const allowedConditions = config.search.conditions.map((condition) => condition.toString().toLowerCase());
    if (normalizedCondition && !allowedConditions.includes(normalizedCondition)) {
      return false;
    }
  }

  return true;
}

async function searchItems() {
  // Récupère d'abord les cookies de session
  await getSessionCookies();

  const keywords = Array.isArray(config.search.keywords)
    ? config.search.keywords
    : [config.search.keywords || ''];
  const shuffledKeywords = shuffleArray(keywords);
  const maxPages = config.search.maxPages || 1;

  let allRawItems = [];

  for (const keyword of shuffledKeywords) {
    const pagesToFetch = 1 + Math.floor(Math.random() * maxPages);

    for (let page = 1; page <= pagesToFetch; page += 1) {
      const params = {
        'items[per_page]': config.search.perPage,
        'items[page]': page,
        'search_text': keyword,
        'currency': config.search.currency,
        'locale': config.search.locale,
        'country': config.search.country,
        'order': 'newest_first'
      };

      const path = `${config.vinted.path}?${buildQuery(params)}`;
      const response = await requestJson(path);
      const rawItems = response.items || response.catalog_items || [];
      allRawItems = allRawItems.concat(rawItems);

      if (page < pagesToFetch) {
        await randomDelay();
      }
    }

    await randomDelay();
  }

  const normalizedItems = allRawItems
    .map(normalizeItem)
    .filter(filterItem);

  const uniqueItems = [];
  const seenIds = new Set();
  for (const item of normalizedItems) {
    if (item.id && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

module.exports = {
  searchItems
};
