import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, '..');
const siteDirectory = path.join(repositoryDirectory, 'docs');
const dataPath = path.join(repositoryDirectory, 'data', 'restaurants.json');
const homepagePath = path.join(siteDirectory, 'index.html');
const checkOnly = process.argv.includes('--check');
const issueFlagIndex = process.argv.indexOf('--issue');
const issueDate = issueFlagIndex >= 0 ? process.argv[issueFlagIndex + 1] : null;

if (checkOnly && issueDate) throw new Error('請分開執行 --issue 與 --check。');
if (issueFlagIndex >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(issueDate ?? '')) {
  throw new Error('--issue 必須接 YYYY-MM-DD 格式的週報日期。');
}

const decodeEntities = (value) => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'");

const textContent = (value) => decodeEntities(value.replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ')
  .trim();

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getAttribute = (attributes, name) => {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = attributes.match(pattern);
  return match ? decodeEntities(match[2].trim()) : '';
};

const markedElementText = (html, marker) => {
  const pattern = new RegExp(
    `<([a-z][\\w-]*)\\b(?=[^>]*\\b${marker}(?:\\s|=|>|/))[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  );
  const match = html.match(pattern);
  return match ? textContent(match[2]) : '';
};

const markedLink = (html) => {
  const match = html.match(/<a\b(?=[^>]*\bdata-restaurant-link(?:\s|=|>|\/))([^>]*)>[\s\S]*?<\/a>/i);
  return match ? getAttribute(match[1], 'href') : '';
};

const markedTags = (html) => {
  const region = html.match(/<([a-z][\w-]*)\b(?=[^>]*\bdata-restaurant-tags(?:\s|=|>|\/))[^>]*>([\s\S]*?)<\/\1>/i);
  if (!region) return [];
  return [...region[2].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => textContent(match[1]))
    .filter(Boolean);
};

const markedImage = (html, issue) => {
  const match = html.match(/<img\b(?=[^>]*\bdata-restaurant-image(?:\s|=|>|\/))([^>]*)>/i);
  if (!match) return { src: '', alt: '' };
  const source = getAttribute(match[1], 'src');
  const alt = getAttribute(match[1], 'alt');
  if (/^(?:[a-z]+:|\/)/i.test(source) || source.includes('..')) {
    throw new Error(`${issue} 的餐廳截圖必須使用該期週報內的相對路徑：${source}`);
  }
  return {
    src: path.posix.join('reports', issue, source),
    alt,
  };
};

const normalizedUrl = (value) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`餐廳網址必須使用 HTTPS：${value}`);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
};

const parseRestaurant = (article, issue) => {
  const restaurant = {
    name: markedElementText(article, 'data-restaurant-name'),
    category: markedElementText(article, 'data-restaurant-category'),
    summary: markedElementText(article, 'data-restaurant-summary'),
    url: markedLink(article),
    tags: markedTags(article),
    image: markedImage(article, issue),
    introducedAt: issue,
  };
  const required = {
    name: restaurant.name,
    category: restaurant.category,
    summary: restaurant.summary,
    url: restaurant.url,
    image: restaurant.image.src,
    imageAlt: restaurant.image.alt,
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`${issue} 的餐廳標記缺少：${missing.join(', ')}`);
  restaurant.key = normalizedUrl(restaurant.url);
  return restaurant;
};

const loadCatalog = async () => {
  try {
    const catalog = JSON.parse(await readFile(dataPath, 'utf8'));
    if (!Array.isArray(catalog.restaurants)) throw new Error('restaurants 必須是陣列。');
    return catalog;
  } catch (error) {
    if (error.code === 'ENOENT') return { intro: '', updatedFromIssue: '', restaurants: [] };
    throw new Error(`無法讀取餐廳目錄資料：${error.message}`);
  }
};

const importIssue = async (catalog, issue) => {
  const reportPath = path.join(siteDirectory, 'reports', issue, 'index.html');
  const report = await readFile(reportPath, 'utf8');
  const articles = report.match(/<article\b(?=[^>]*\bdata-restaurant(?:\s|=|>|\/))[^>]*>[\s\S]*?<\/article>/gi) ?? [];
  if (!articles.length) throw new Error(`${issue} 週報沒有標記任何新餐廳。`);

  const intro = markedElementText(report, 'data-restaurant-catalog-intro');
  const parsed = articles.map((article) => parseRestaurant(article, issue));
  let added = 0;
  let updated = 0;

  for (const restaurant of parsed) {
    const existingIndex = catalog.restaurants.findIndex(
      (existing) => normalizedUrl(existing.url) === restaurant.key,
    );
    delete restaurant.key;
    if (existingIndex >= 0) {
      const introducedAt = catalog.restaurants[existingIndex].introducedAt;
      catalog.restaurants[existingIndex] = { ...restaurant, introducedAt };
      updated += 1;
    } else {
      catalog.restaurants.push(restaurant);
      added += 1;
    }
  }

  if (intro) catalog.intro = intro;
  if (!catalog.intro) throw new Error(`${issue} 週報缺少 data-restaurant-catalog-intro。`);
  catalog.updatedFromIssue = issue;
  return { catalog, added, updated };
};

const renderCatalog = (catalog) => {
  const restaurants = [...catalog.restaurants]
    .sort((a, b) => b.introducedAt.localeCompare(a.introducedAt));
  const cards = restaurants.map((restaurant, index) => {
    const tags = restaurant.tags
      .map((tag) => `                  <li>${escapeHtml(tag)}</li>`)
      .join('\n');
    return `        <article class="restaurant-card">
          <a class="restaurant-card-media" href="${escapeHtml(restaurant.url)}" target="_blank" rel="noreferrer" aria-label="前往${escapeHtml(restaurant.name)}">
            <img src="${escapeHtml(restaurant.image.src)}" alt="${escapeHtml(restaurant.image.alt)}" loading="lazy">
          </a>
          <div class="restaurant-card-body">
            <div class="restaurant-card-top">
              <span class="restaurant-category">${escapeHtml(restaurant.category)}</span>
              <span class="restaurant-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
            </div>
            <h3><a href="${escapeHtml(restaurant.url)}" target="_blank" rel="noreferrer">${escapeHtml(restaurant.name)}</a></h3>
            <p>${escapeHtml(restaurant.summary)}</p>
            <ul class="restaurant-tags" aria-label="餐廳特色">
${tags}
            </ul>
            <footer class="restaurant-card-footer">
              <a class="restaurant-intro" href="reports/${restaurant.introducedAt}/" aria-label="查看${escapeHtml(restaurant.name)}的週報介紹">看介紹 <span aria-hidden="true">→</span></a>
              <a class="restaurant-visit" href="${escapeHtml(restaurant.url)}" target="_blank" rel="noreferrer">前往餐廳 <span aria-hidden="true">↗</span></a>
            </footer>
          </div>
        </article>`;
  }).join('\n');

  return `    <!-- RESTAURANT_CATALOG_START -->
    <!-- 由 scripts/update-restaurant-catalog.mjs 自動產生，請勿直接編輯此區塊 -->
    <section class="section restaurant-catalog" aria-labelledby="restaurant-catalog-title" id="restaurants">
      <div class="shell">
        <div class="section-head restaurant-catalog-head">
          <div>
            <p class="catalog-kicker">OPENFUN FOOD COURT</p>
            <h2 id="restaurant-catalog-title">歐噴餐廳美食街</h2>
          </div>
          <p>${escapeHtml(catalog.intro)}</p>
        </div>
        <div class="restaurant-catalog-meta">
          <strong>${restaurants.length} 間餐廳</strong>
          <span>依首次登場日期排序</span>
        </div>
        <div class="restaurant-grid">
${cards}
        </div>
      </div>
    </section>
    <!-- RESTAURANT_CATALOG_END -->`;
};

let catalog = await loadCatalog();
let importResult = null;
if (issueDate) {
  importResult = await importIssue(catalog, issueDate);
  catalog = importResult.catalog;
}
if (!catalog.restaurants.length) throw new Error('餐廳目錄目前沒有任何資料。');

const homepage = await readFile(homepagePath, 'utf8');
const catalogBlock = renderCatalog(catalog);
const blockPattern = /[ \t]*<!-- RESTAURANT_CATALOG_START -->[\s\S]*?[ \t]*<!-- RESTAURANT_CATALOG_END -->/;
if (!blockPattern.test(homepage)) throw new Error('首頁缺少餐廳目錄產生標記。');
const generatedHomepage = homepage.replace(blockPattern, catalogBlock);

if (checkOnly) {
  if (generatedHomepage !== homepage) {
    console.error('首頁餐廳目錄尚未同步，請執行：node scripts/update-restaurant-catalog.mjs');
    process.exitCode = 1;
  } else {
    console.log(`首頁餐廳目錄已同步，共 ${catalog.restaurants.length} 間。`);
  }
} else {
  if (importResult) await writeFile(dataPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(homepagePath, generatedHomepage);
  if (importResult) {
    console.log(`已匯入 ${issueDate} 週報：新增 ${importResult.added} 間、更新 ${importResult.updated} 間；目錄共 ${catalog.restaurants.length} 間。`);
  } else {
    console.log(`已從餐廳目錄資料重建首頁，共 ${catalog.restaurants.length} 間。`);
  }
}
