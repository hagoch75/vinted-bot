const https = require('https');
const zlib = require('zlib');
const config = require('./config');

let sessionCookies = 'locale=en_GB;';
let accessToken = '';

function extractAccessToken(cookies) {
  const match = cookies.match(/access_token_web=([^;]+)/);
  return match && match[1] ? match[1] : '';
}

function buildQuery(params) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function getSessionCookies() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.vinted.co.uk',
      path: '/',
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        'DNT': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Cache-Control': 'max-age=0'
      }
    };

    https.get(options, (res) => {
      const cookies = res.headers['set-cookie'] || [];
      let cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      if (cookieString && !cookieString.includes('locale=en_GB')) {
        cookieString += '; locale=en_GB';
      } else if (!cookieString) {
        cookieString = 'locale=en_GB';
      }
      const token = extractAccessToken(cookieString);
      if (token) accessToken = token;

      let stream = res;
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

      stream.on('data', () => {});
      stream.on('end', () => {
        sessionCookies = cookieString;
        resolve(cookieString);
      });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

function requestJson(path) {
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
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
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

      let raw = '';
      stream.on('data', (chunk) => raw += chunk);
      stream.on('end', () => {
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

async function testPerPage() {
  await getSessionCookies();
  
  for (const perPage of [48, 100, 150]) {
    const params = {
      'items[per_page]': perPage,
      'items[page]': 1,
      'search_text': 'jacket',
      'currency': 'GBP',
      'locale': 'en_GB',
      'country': 'GB',
      'order': 'newest_first'
    };
    
    const path = `/api/v2/catalog/items?${buildQuery(params)}`;
    
    try {
      const response = await requestJson(path);
      console.log(`per_page=${perPage}: returned ${response.items.length} items`);
    } catch (err) {
      console.error(`per_page=${perPage}: Error -`, err.message);
    }
  }
}

testPerPage();
