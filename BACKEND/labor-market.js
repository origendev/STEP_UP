import { XMLParser } from 'fast-xml-parser';

const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CACHE_MS = 15 * 60 * 1000;
const FORECAST_CACHE_MS = 60 * 60 * 1000;
const LOOKBACK_DAYS = 30;
const EPFO_SOURCE = 'https://www.epfo.gov.in/';
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
let cache = null;
let cacheAt = 0;
let requestInFlight = null;
let forecastCache = null;
let forecastCacheAt = 0;
let forecastInFlight = null;

function cleanText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function rssImage(item) {
  const candidates = [item['media:content'], item['media:thumbnail'], item.enclosure]
    .flatMap((candidate) => Array.isArray(candidate) ? candidate : candidate ? [candidate] : []);
  const image = candidates.find((candidate) => candidate['@_url'] || candidate['@_href']);
  return safeImageUrl(image?.['@_url'] || image?.['@_href'] || '');
}

function eventType(article) {
  const text = article.title.toLowerCase();
  const hiring = /\b(?:re-?hiring|re-?hire|hiring\s+(?:drive|plan|spree|surge|push|for\s+\d|to fill|plans?)|mass hiring|companies?\s+(?:are\s+)?hiring|employers?\s+(?:are\s+)?hiring|global hiring outlook\s+(?:strengthens|improves|rises)|(?:plans?|expects?|aims?|set to|will) hire\s+\d|(?:hire|hires|hired)\s+\d[\d,.]*\s+(?:new\s+)?(?:employees|workers|staff|people|roles|jobs|positions)|recruitment\s+(?:drive|plan|for\s+\d)|recruitment\s+\d{4}|\d[\d,.]*\s+(?:new\s+)?(?:jobs|roles|positions|posts|vacancies)\s+(?:created|added|to be filled|to fill)|(?:create|adds?|added|adding)\s+\d[\d,.]*\s+(?:new\s+)?(?:jobs|roles|positions|posts)|workforce\s+(?:expansion|growth|increase)|expands?\s+(?:its\s+)?workforce|job\s+(?:creation|growth|rush))\b/i.test(text)
    && !/\bhiring grounds?\b|\bbrand is hiring\b|\bseeking .{0,30}expertise\b/i.test(text);
  const layoffs = /\b(?:layoffs?|laid off|job cuts?|redundanc(?:y|ies)|downsizing|workforce reduction|dismissals?|(?:jobs?|roles?|positions?)\s+(?:cut|eliminated|axed)|(?:cuts?|eliminates?|slashing|reduces?)\s+\d[\d,.]*\s+(?:jobs|roles|positions)|\d[\d,.]*\s+jobs?\s+(?:cut|to go|will be cut|may go))\b/i.test(text);
  if (hiring && layoffs) return 'mixed';
  if (layoffs) return 'layoffs';
  if (hiring) return 'hiring';
  return null;
}

async function fetchGoogleNews(query, locale) {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', `${query} when:30d`);
  for (const [key, value] of Object.entries(locale)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'Mozilla/5.0 StepUpLaborMarket/1.0' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Google News RSS returned ${response.status}`);
  const feed = xmlParser.parse(await response.text());
  const entries = feed.rss?.channel?.item || [];
  return (Array.isArray(entries) ? entries : [entries]).map((item) => ({
    title: cleanText(item.title || ''),
    description: cleanText(item.description || ''),
    source: cleanText(item.source?.['#text'] || item.source || 'Google News'),
    url: item.link || '',
    image: rssImage(item),
    publishedAt: item.pubDate || ''
  }));
}

async function fetchNewsApi(query, country) {
  const url = new URL('https://newsapi.org/v2/everything');
  const from = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  url.searchParams.set('q', query);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'publishedAt');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('from', from.toISOString().slice(0, 10));
  url.searchParams.set('apiKey', NEWS_API_KEY);
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  const payload = await response.json();
  if (!response.ok || payload.status !== 'ok') throw new Error(payload.message || `NewsAPI returned ${response.status}`);
  return (payload.articles || []).map((article) => ({
    title: cleanText(article.title || ''),
    description: cleanText(article.description || article.content || ''),
    source: article.source?.name || 'News publisher',
    url: article.url || '',
    image: safeImageUrl(article.urlToImage || ''),
    publishedAt: article.publishedAt || '',
    country
  }));
}

const INDIA_TEXT_PATTERN = /\b(?:india|indian|indians|bharat|rupees?|rs\.?\s?\d|inr|crore|lakh|nse|bse|sensex|nifty|iit|iim|nasscom|gcc|bengaluru|bangalore|mumbai|delhi|new delhi|hyderabad|chennai|pune|kolkata|ahmedabad|jaipur|lucknow|kochi|coimbatore|gurugram|gurgaon|noida|haryana|tamil nadu|karnataka|kerala|maharashtra|gujarat|rajasthan|uttar pradesh|telangana|infosys|tcs|tata consultancy|wipro|hcl(?:tech)?|tech mahindra|cognizant india|zomato|swiggy|paytm|flipkart|byju|ola electric|reliance|adani|mahindra|bajaj|naukri|foxconn india)\b/i;
const INDIA_SOURCE_PATTERN = /\b(?:times of india|economic times|hindustan times|the hindu|business standard|livemint|mint|moneycontrol|ndtv|indian express|financial express|firstpost|news18|india today|zee|republic world|deccan|telangana today|the print|theprint|outlook india|inc42|yourstory|entrackr|ians|pti|business today|economictimes|indiatimes|india\.com)\b/i;
const INDIA_URL_PATTERN = /(?:\.in(?:\/|$)|indiatimes|timesofindia|hindustantimes|thehindu|livemint|moneycontrol|ndtv|indianexpress|business-standard|financialexpress|news18|indiatoday)/i;

function isIndiaStory(article) {
  let host = '';
  try { host = new URL(article.url).hostname; } catch { /* keep empty */ }
  return INDIA_TEXT_PATTERN.test(`${article.title} ${article.description}`)
    || INDIA_SOURCE_PATTERN.test(article.source || '')
    || (host && !/news\.google\.com$/i.test(host) && INDIA_URL_PATTERN.test(host));
}

async function fetchLaborReports(market) {
  const isIndia = market === 'india';
  const query = isIndia
    ? 'India (company OR companies OR employer) (hiring OR layoffs OR "job cuts" OR recruitment)'
    : '(company OR companies OR employer) (hiring OR layoffs OR "job cuts") global international worldwide';
  const locale = isIndia
    ? { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' }
    : { hl: 'en', gl: 'US', ceid: 'US:en' };
  let articles;
  let provider = 'google-news-rss';
  if (NEWS_API_KEY) {
    try {
      articles = await fetchNewsApi(query, market);
      provider = 'newsapi';
    } catch (error) {
      console.warn(`Labor-market news search failed for ${market}; using Google News RSS.`, error.message);
    }
  }
  const rssQueries = isIndia
    ? [
      'India companies hiring layoffs jobs recruitment',
      'India private companies hiring workforce expansion layoffs',
      'India corporate hiring plans job cuts employers'
    ]
    : [
      ['global companies hiring layoffs jobs workforce', { hl: 'en', gl: 'US', ceid: 'US:en' }],
      ['Europe UK Germany France companies hiring layoffs jobs', { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' }],
      ['Canada Australia Singapore Japan companies hiring layoffs jobs', { hl: 'en-AU', gl: 'AU', ceid: 'AU:en' }]
    ];
  const rssResults = await Promise.allSettled((isIndia
    ? rssQueries.map((rssQuery) => fetchGoogleNews(rssQuery, locale))
    : rssQueries.map(([rssQuery, rssLocale]) => fetchGoogleNews(rssQuery, rssLocale))));
  articles = [
    ...(articles || []),
    ...rssResults.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  ];

  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set();
  const reports = articles
    .map((article) => ({ ...article, type: eventType(article) }))
    .filter((article) => {
      const published = Date.parse(article.publishedAt);
      if (!article.type || !article.title || !article.url || (Number.isFinite(published) && published < cutoff)) return false;
      if (market === 'india' && /\b(?:police recruitment|non-faculty|university recruitment|government recruitment|public service commission|army recruitment|civil service exam)\b/i.test(article.title)) return false;
      if (market === 'overseas' && isIndiaStory(article)) return false;
      if (market === 'india' && !/\b(?:india|indian|iit|fssai|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|kolkata|gurugram|gurgaon|noida|haryana|tamil nadu|karnataka|maharashtra|rajasthan|uttar pradesh)\b/i.test(`${article.title} ${article.description}`)
        && !/\bgcc\b.*\blayoffs?\b|\blayoffs?\b.*\bgcc\b/i.test(article.title)) return false;
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    })
    .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''));

  return { reports, provider };
}

function weeklyReportCounts(reports) {
  const now = new Date();
  const weeks = [];
  for (let offset = 3; offset >= 0; offset -= 1) {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() - offset * 7);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    const inWeek = reports.filter((item) => {
      const timestamp = Date.parse(item.publishedAt || '');
      return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= end.getTime();
    });
    weeks.push({
      label: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      hiringReports: inWeek.filter((item) => item.type === 'hiring' || item.type === 'mixed').length,
      layoffReports: inWeek.filter((item) => item.type === 'layoffs' || item.type === 'mixed').length
    });
  }
  return weeks;
}

function parseForecast(content) {
  const parsed = JSON.parse(content || '{}');
  const direction = new Set(['rising', 'stable', 'falling', 'unclear']);
  const confidence = new Set(['low', 'medium', 'high']);
  return ['india', 'overseas'].map((market) => {
    const forecast = parsed[market] || {};
    return {
      market,
      hiringDirection: direction.has(forecast.hiringDirection) ? forecast.hiringDirection : 'unclear',
      layoffDirection: direction.has(forecast.layoffDirection) ? forecast.layoffDirection : 'unclear',
      confidence: confidence.has(forecast.confidence) ? forecast.confidence : 'low',
      rationale: cleanText(forecast.rationale || '').slice(0, 500)
    };
  });
}

function linearTrend(values) {
  if (values.length < 2 || values.every((value) => value === 0)) {
    return { direction: 'unclear', projected: null };
  }
  const meanX = (values.length - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.filter((value) => value > 0).length < 2) {
    return { direction: 'unclear', projected: Math.round(meanY * 4) };
  }
  const numerator = values.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0);
  const denominator = values.reduce((sum, _value, index) => sum + (index - meanX) ** 2, 0) || 1;
  const slope = numerator / denominator;
  const direction = slope > 0.35 ? 'rising' : slope < -0.35 ? 'falling' : 'stable';
  const projection = Array.from({ length: 4 }, (_value, index) => Math.max(0, meanY + slope * (values.length + index - meanX)));
  return { direction, projected: Math.round(projection.reduce((sum, value) => sum + value, 0)) };
}

function trendForecasts(data) {
  return ['india', 'overseas'].map((market) => {
    const weeks = data[market].weekly;
    const hiring = linearTrend(weeks.map((week) => week.hiringReports));
    const layoffs = linearTrend(weeks.map((week) => week.layoffReports));
    return {
      market,
      hiringDirection: hiring.direction,
      layoffDirection: layoffs.direction,
      hiringProjectedReports: hiring.projected,
      layoffProjectedReports: layoffs.projected,
      confidence: 'low',
      rationale: 'Four-week linear projection of sourced news-report counts. Report volume is not a count of jobs or workers.'
    };
  });
}

async function createAiForecast(data) {
  if (!OPENAI_API_KEY) return { status: 'not_configured', forecasts: trendForecasts(data) };
  const context = {
    India: {
      source: EPFO_SOURCE,
      observations: 'Counts below are news articles reporting hiring or layoffs in the last 30 days. They are NOT counts of workers or a nationally representative labor-force measure.',
      weeklyReportedEvents: data.india.weekly,
      recentReports: data.india.reports.slice(0, 20).map(({ title, source, publishedAt, type }) => ({ title, source, publishedAt, type }))
    },
    Overseas: {
      source: data.overseas.source,
      observations: 'Counts are sourced international company news reports, not employee totals or a representative worldwide labor-force measure.',
      weeklyReportedEvents: data.overseas.weekly,
      recentReports: data.overseas.reports.slice(0, 20).map(({ title, source, publishedAt, type }) => ({ title, source, publishedAt, type }))
    }
  };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Analyze labor market evidence conservatively. Return JSON only, with india and overseas objects. Each needs hiringDirection (rising, stable, falling, unclear), layoffDirection (same enum), confidence (low, medium, high), and rationale for the next four weeks. Never invent worker counts, turn news-report counts into employment counts, or claim news reports are representative.'
        },
        { role: 'user', content: JSON.stringify(context) }
      ]
    }),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error?.message || `OpenAI returned ${response.status}`;
    return {
      status: /credit|billing|quota/i.test(message) ? 'credits_required' : 'unavailable',
      forecasts: trendForecasts(data)
    };
  }
  try {
    const generated = parseForecast(payload.choices?.[0]?.message?.content);
    if (generated.some((item) => !item.rationale)) return { status: 'unavailable', forecasts: trendForecasts(data) };
    const trends = new Map(trendForecasts(data).map((item) => [item.market, item]));
    return { status: 'current', forecasts: generated.map((item) => ({ ...trends.get(item.market), ...item })) };
  } catch {
    return { status: 'unavailable', forecasts: trendForecasts(data) };
  }
}

async function loadData(refreshForecast) {
  const [indiaResult, overseasNewsResult] = await Promise.allSettled([
    fetchLaborReports('india'),
    fetchLaborReports('overseas')
  ]);
  const indiaReports = indiaResult.status === 'fulfilled' ? indiaResult.value.reports : [];
  const overseasReports = overseasNewsResult.status === 'fulfilled' ? overseasNewsResult.value.reports : [];
  const data = {
    updatedAt: new Date().toISOString(),
    periodDays: LOOKBACK_DAYS,
    india: {
      source: EPFO_SOURCE,
      newsSource: indiaResult.status === 'fulfilled' ? indiaResult.value.provider : null,
      hiringReports: indiaReports.filter((item) => item.type === 'hiring' || item.type === 'mixed').length,
      layoffReports: indiaReports.filter((item) => item.type === 'layoffs' || item.type === 'mixed').length,
      weekly: weeklyReportCounts(indiaReports),
      reports: indiaReports,
      definition: 'Sourced India company reports published in the past 30 days, not worker headcounts or a national hiring/layoff estimate.'
    },
    overseas: {
      source: 'https://news.google.com/',
      reports: overseasReports,
      newsSource: overseasNewsResult.status === 'fulfilled' ? overseasNewsResult.value.provider : null,
      hiringReports: overseasReports.filter((item) => item.type === 'hiring' || item.type === 'mixed').length,
      layoffReports: overseasReports.filter((item) => item.type === 'layoffs' || item.type === 'mixed').length,
      weekly: weeklyReportCounts(overseasReports),
      definition: 'Sourced international company reports from the past 30 days, not a single global worker headcount.'
    },
    newsError: indiaResult.status === 'rejected' && overseasNewsResult.status === 'rejected'
      ? 'Live labor-market reporting is temporarily unavailable.'
      : null
  };
  let ai = !refreshForecast && forecastCache && Date.now() - forecastCacheAt < FORECAST_CACHE_MS
    ? forecastCache
    : null;
  if (!ai) {
    if (!forecastInFlight) {
      forecastInFlight = createAiForecast(data)
        .catch((error) => {
          console.warn('AI labor-market forecast unavailable:', error.message);
          return { status: 'unavailable', forecasts: trendForecasts(data) };
        })
        .then((result) => {
          forecastCache = result;
          forecastCacheAt = Date.now();
          return result;
        })
        .finally(() => { forecastInFlight = null; });
    }
    ai = await forecastInFlight;
  }
  return { ...data, forecastStatus: ai.status, forecasts: ai.forecasts };
}

export async function getLaborMarket({ refresh = false } = {}) {
  if (!refresh && cache && Date.now() - cacheAt < CACHE_MS) return cache;
  if (!requestInFlight) {
    requestInFlight = loadData(refresh)
      .then((data) => {
        cache = data;
        cacheAt = Date.now();
        return data;
      })
      .finally(() => { requestInFlight = null; });
  }
  return requestInFlight;
}