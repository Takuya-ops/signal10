import { XMLParser } from 'fast-xml-parser';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'from', 'by',
  'at', 'is', 'are', 'as', 'new', 'its', 'this', 'that', 'how', 'why', 'what', 'ai',
  'を', 'に', 'が', 'の', 'で', 'と', 'へ', 'や', 'から', '生成ai', '人工知能',
]);

const BRAND_TERMS = new Set([
  'openai', 'anthropic', 'claude', 'google', 'gemini', 'deepmind', 'meta', 'microsoft',
  'github', 'aws', 'amazon', 'nvidia', 'apple', 'qwen', 'alibaba', 'mistral', 'hugging',
  'perplexity', 'crowdstrike', 'adobe', 'worldlabs', 'deepseek', 'cohere', 'stability',
  'xai', 'grok', 'muse', 'bedrock', 'agentcore', 'notebook', 'workspace', 'chatgpt',
  'copilot', 'fable', 'mythos',
]);

const ORGANIZATION_TERMS = new Set([
  'openai', 'anthropic', 'google', 'deepmind', 'meta', 'microsoft', 'github', 'aws',
  'amazon', 'nvidia', 'apple', 'alibaba', 'mistral', 'hugging', 'perplexity',
  'crowdstrike', 'adobe', 'worldlabs', 'deepseek', 'cohere', 'stability', 'xai',
]);

const PRODUCT_VARIANT_TERMS = new Set([
  'cyber', 'fable', 'flash', 'haiku', 'max', 'mini', 'mythos', 'nano', 'next',
  'opus', 'pro', 'sonnet', 'spark', 'ultra', 'voice',
]);

const MATCH_GENERIC_TERMS = new Set([
  ...STOP_WORDS,
  'about', 'after', 'before', 'best', 'company', 'could', 'critical', 'first', 'latest',
  'launch', 'launches', 'launched', 'make', 'makes', 'model', 'models', 'news', 'official',
  'release', 'releases', 'released', 'report', 'reports', 'says', 'service', 'services',
  'system', 'systems', 'technology', 'today', 'tool', 'tools', 'update', 'updates', 'using',
  'version', 'with', 'without', 'year', 'years', 'generative', 'security', 'research',
  'code', 'cloud', 'large', 'language', 'learning', 'multimodal', 'framework', 'benchmark',
  'evaluation', 'generation', 'retrieval', 'augmented', 'efficient', 'agent', 'agents', 'agentic',
  'australia', 'china', 'chinese', 'europe', 'india', 'japan', 'korea', 'malaysia',
  'america', 'american', 'united', 'states',
]);

const AI_TERMS = [
  'artificial intelligence', 'generative ai', 'genai', 'large language model', 'language model',
  'multimodal', 'foundation model', 'machine learning', 'deep learning', 'neural', 'transformer',
  'agentic', 'ai agent', 'chatgpt', 'openai', 'anthropic', 'claude', 'gemini', 'deepmind',
  'mistral', 'llama', 'qwen', 'grok', 'copilot', 'hugging face', 'stable diffusion', 'midjourney',
  'sora', 'text-to-image', 'text to video', 'model weights', 'inference', 'prompt injection',
  '生成ai', '生成型ai', '大規模言語モデル', '基盤モデル', '機械学習', '深層学習', 'マルチモーダル',
  'エージェント', 'チャットgpt', '画像生成', '動画生成', '音声モデル', '世界モデル', 'llm', 'rag',
];

const IMPACT_TERMS = new Map([
  ['launch', 8], ['release', 8], ['introduc', 7], ['unveil', 7], ['debut', 6], ['announce', 6], ['available', 4],
  ['model', 5], ['agent', 5], ['open source', 6], ['weights', 5], ['api', 4],
  ['security', 7], ['cyber', 7], ['critical', 8], ['vulnerability', 6], ['safety', 5],
  ['regulation', 8], ['moratorium', 8], ['ban', 6], ['law', 6], ['court', 7], ['copyright', 7], ['government', 6],
  ['funding', 5], ['acqui', 7], ['billion', 7], ['partnership', 4],
  ['公開', 8], ['発表', 6], ['提供開始', 7], ['新モデル', 8], ['基盤モデル', 6],
  ['規制', 8], ['法案', 7], ['訴訟', 7], ['著作権', 7], ['安全', 5], ['脆弱性', 7],
  ['買収', 7], ['提携', 4], ['資金調達', 5], ['オープンソース', 6],
]);

const CATEGORY_RULES = [
  ['安全性', ['security', 'cyber', 'vulnerability', 'guardrail', 'safety', 'risk', 'attack', '脆弱', '安全', '攻撃', '防御', '停止機能']],
  ['政策・社会', ['regulation', 'law', 'court', 'copyright', 'government', 'policy', 'school', 'election', '規制', '法律', '訴訟', '著作権', '政府', '学校', '教育']],
  ['研究', ['research', 'paper', 'benchmark', 'arxiv', 'study', 'world model', '研究', '論文', 'ベンチマーク', '世界モデル']],
  ['開発者向け', ['developer', 'api', 'sdk', 'coding', 'code', 'github', 'inference', 'mcp', '開発者', 'コーディング', '推論']],
  ['ビジネス', ['funding', 'acquisition', 'revenue', 'enterprise', 'partnership', 'business', 'billion', '資金', '買収', '企業', '提携', '売上']],
  ['モデル', ['model', 'llm', 'claude', 'gemini', 'gpt', 'llama', 'qwen', 'mistral', 'grok', 'モデル']],
  ['プロダクト', ['launch', 'release', 'available', 'app', 'feature', 'tool', 'product', '公開', '提供', '機能', 'アプリ', 'ツール']],
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  processEntities: true,
  parseTagValue: false,
});

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textValue).find(Boolean) || '';
  if (typeof value === 'object') {
    return textValue(value['#text']) || textValue(value.__cdata) || textValue(value['@_href']) || '';
  }
  return '';
}

function getLink(value) {
  const links = asArray(value);
  const preferred = links.find((entry) => typeof entry === 'object' && (!entry['@_rel'] || entry['@_rel'] === 'alternate'));
  return textValue(preferred || links[0]);
}

export function stripHtml(value = '') {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(value = '') {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/(amp|print)\/?$/i, '').replace(/\/$/, '') || '/';
    return url.toString();
  } catch {
    return String(value).trim();
  }
}

function matchingHeadline(title = '') {
  return stripHtml(title)
    .replace(/\s+[|｜]\s+[^|｜]{2,90}$/u, ' ')
    .replace(/\s+[-–—]\s+[^|｜–—]{2,90}$/u, ' ')
    .replace(/\b(qwen|gemini|claude|gpt|llama|mistral|grok)(?=\d)/gi, '$1 ')
    .replace(/\bworld\s+labs\b/gi, ' worldlabs ')
    .replace(/グーグル/gu, ' google ')
    .replace(/アンソロピック/gu, ' anthropic ')
    .replace(/ジェミニ/gu, ' gemini ')
    .replace(/フラッシュ/gu, ' flash ')
    .replace(/ミュトス/gu, ' mythos ')
    .replace(/\b(?:new york times|nyt)\b/gi, ' nyt ')
    .replace(/ニューヨーク[・\s]?タイムズ/gu, ' nyt ')
    .replace(/\b(?:(?:u\.?s\.?)\s+)?department of justice\b|\bjustice department\b|\bdoj\b/gi, ' doj ')
    .replace(/米(?:国)?司法省/gu, ' doj ')
    .replace(/\bfair[- ]use\b/gi, ' fairuse ')
    .replace(/公正利用|フェアユース|著作権侵害ではない/gu, ' fairuse ')
    .replace(/\bcopyright(?:ed)?\b/gi, ' copyright ')
    .replace(/著作権/gu, ' copyright ')
    .replace(/\b(?:lawsuits?|case)\b/gi, ' lawsuit ')
    .replace(/訴訟/gu, ' lawsuit ')
    .replace(/\b(?:backs?|backed|supports?|supported|sides?|sided)\b/gi, ' support ')
    .replace(/支持|擁護/gu, ' support ')
    .replace(/\b(?:training|trained|trains?)\b/gi, ' training ')
    .replace(/学習/gu, ' training ')
    .replace(/\bnew york city\b|\bnyc\b/gi, ' nyc ')
    .replace(/\bmamdani\b/gi, ' nyc ')
    .replace(/\b(?:moratorium|bars?|barred|bans?|banned|banning|blocks?|blocked|blocking|prohibit(?:s|ed|ing)?|restrict(?:s|ed|ing)?|paus(?:e|es|ed|ing))\b/gi, ' ban ')
    .replace(/\b(?:classrooms?|elementary|middle|preschools?|schools)\b/gi, ' school ')
    .replace(/\bstudents\b/gi, ' student ')
    .replace(/ニューヨーク市/gu, ' nyc ')
    .replace(/生成[ＡA]Ｉ|生成AI/gu, ' generative ')
    .replace(/(?:公立)?学校|小学校|中学校|教室/gu, ' school ')
    .replace(/禁止|凍結|制限|見合わせ/gu, ' ban ')
    .replace(/生徒|児童/gu, ' student ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTokens(title = '') {
  const rawTitle = matchingHeadline(title).toLowerCase();
  const versionTokens = rawTitle.match(/\b\d+(?:\.\d+)+\b/g) || [];
  const normalized = rawTitle
    .replace(/[|｜]\s*[^|｜]{2,40}$/u, ' ')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = normalized.match(/[a-z0-9][a-z0-9._+-]{1,}|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu) || [];
  const tokens = [];
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(word) && word.length > 4) {
      for (let index = 0; index < word.length - 1; index += 2) tokens.push(word.slice(index, index + 2));
    } else {
      tokens.push(word);
    }
  }
  return [...new Set([...tokens, ...versionTokens])];
}

export function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
}

function properTitleTokens(title = '') {
  const ignored = new Set([
    'ai', 'the', 'new', 'today', 'introducing', 'announcing', 'model', 'models', 'research',
    'openai', 'anthropic', 'claude', 'google', 'gemini', 'meta', 'microsoft', 'github', 'aws',
    'amazon', 'nvidia', 'apple', 'qwen', 'mistral', 'hugging', 'face', 'cnet', 'itmedia',
    'services', 'service', 'system', 'systems', 'data', 'agent', 'agents', 'agentic', 'financial', 'technology',
    'world', 'labs', 'muse',
  ]);
  return [...new Set((matchingHeadline(title).replace(/\bNYC\b/g, 'New York City').match(/\b[A-Z][A-Za-z0-9._+-]{2,}\b/g) || [])
    .map((token) => token.toLowerCase())
    .filter((token) => !ignored.has(token) && !BRAND_TERMS.has(token) && !MATCH_GENERIC_TERMS.has(token)))];
}

export function inferCategory(candidate) {
  const haystack = `${candidate.title} ${candidate.description || ''}`.toLowerCase();
  let best = { category: candidate.defaultCategory || 'プロダクト', hits: 0 };
  for (const [category, terms] of CATEGORY_RULES) {
    const hits = terms.filter((term) => haystack.includes(term)).length;
    if (hits > best.hits) best = { category, hits };
  }
  return best.category;
}

export function isRelevant(candidate) {
  if (candidate.aiOnly) return true;
  const haystack = `${candidate.title} ${candidate.description || ''}`.toLowerCase();
  return AI_TERMS.some((term) => haystack.includes(term));
}

function validDate(value) {
  const parsed = new Date(textValue(value));
  if (Number.isNaN(parsed.getTime())) return null;
  const now = Date.now();
  if (parsed.getTime() > now + 6 * 60 * 60 * 1000) return null;
  return parsed.toISOString();
}

export function parseFeedDocument(xml, source) {
  const parsed = xmlParser.parse(xml);
  let items = [];
  if (parsed.rss?.channel) items = asArray(parsed.rss.channel.item);
  else if (parsed.feed) items = asArray(parsed.feed.entry);
  else if (parsed['rdf:RDF']) items = asArray(parsed['rdf:RDF'].item);

  return items.map((item, index) => {
    const title = stripHtml(textValue(item.title));
    const link = getLink(item.link) || textValue(item.guid) || textValue(item.id);
    const description = stripHtml(
      textValue(item['content:encoded']) || textValue(item.description) || textValue(item.summary) || textValue(item.content),
    ).slice(0, 6000);
    const publishedAt = validDate(item.pubDate || item.published || item.updated || item['dc:date']);
    const embeddedSource = source.id.startsWith('google-news-') ? stripHtml(textValue(item.source)) : '';
    return {
      id: `${source.id}-${textValue(item.guid || item.id) || index}`,
      guid: textValue(item.guid || item.id),
      title,
      description,
      url: normalizeUrl(link),
      publishedAt,
      sourceId: embeddedSource ? `${source.id}:${embeddedSource.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}` : source.id,
      sourceName: embeddedSource || source.name,
      sourceType: source.type,
      tier: source.tier,
      defaultCategory: source.defaultCategory,
      aiOnly: source.aiOnly,
    };
  }).filter((item) => item.title && item.url && item.publishedAt);
}

export function parseSitemapDocument(xml, source, newestAllowed = Date.now()) {
  const parsed = xmlParser.parse(xml);
  const entries = asArray(parsed.urlset?.url);
  const includes = source.include || [];
  const excludes = source.exclude || [];
  return entries
    .map((entry) => ({ url: normalizeUrl(textValue(entry.loc)), publishedAt: validDate(entry.lastmod) }))
    .filter((entry) => entry.url && entry.publishedAt)
    .filter((entry) => new Date(entry.publishedAt).getTime() <= newestAllowed)
    .filter((entry) => !includes.length || includes.some((fragment) => entry.url.includes(fragment)))
    .filter((entry) => !excludes.some((fragment) => entry.url.includes(fragment)));
}

function impactTermScore(candidate) {
  const haystack = `${candidate.title} ${candidate.description || ''}`.toLowerCase();
  let score = 0;
  for (const [term, value] of IMPACT_TERMS) {
    if (haystack.includes(term)) score += value;
  }
  return Math.min(score, 26);
}

export function clusterCandidates(candidates, { maxEventGapMs = 96 * 60 * 60 * 1000 } = {}) {
  const sorted = [...candidates].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const clusters = [];
  const modelVersions = (tokens) => tokens.filter((token) => /\d/.test(token)
    && !/^(?:19|20)\d{2}$/.test(token)
    && !/^\d+d$/i.test(token)
    && !/^\d+(?:k|m|b|gb|tb|mb|hz|mhz|ghz|p)$/i.test(token)
    && (/[a-z]/i.test(token) || /[._+-]/.test(token) || /^0\d+$/.test(token)));
  const sameEvent = (reference, candidate) => {
    if (normalizeUrl(reference.url) === normalizeUrl(candidate.url)) return true;
    if (Math.abs(new Date(reference.publishedAt) - new Date(candidate.publishedAt)) > maxEventGapMs) return false;
    const similarity = jaccard(reference.tokens, candidate.tokens);
    if (reference.sourceType === 'research' && candidate.sourceType === 'research') return similarity >= 0.9;
    const referenceVersions = modelVersions(reference.tokens);
    const candidateVersions = modelVersions(candidate.tokens);
    const shared = candidate.tokens.filter((token) => reference.tokens.includes(token));
    const sharedBrands = candidate.topicBrands.filter((token) => reference.topicBrands.includes(token));
    const referenceVariants = reference.tokens.filter((token) => PRODUCT_VARIANT_TERMS.has(token));
    const candidateVariants = candidate.tokens.filter((token) => PRODUCT_VARIANT_TERMS.has(token));
    if (sharedBrands.length && referenceVersions.length && candidateVersions.length
      && !candidateVersions.some((token) => referenceVersions.includes(token))) return false;
    if (sharedBrands.length && referenceVariants.length && candidateVariants.length
      && !candidateVariants.some((token) => referenceVariants.includes(token))) return false;
    const sharedVersion = shared.some((token) => modelVersions([token]).length > 0);
    if (sharedVersion && sharedBrands.length >= 1) return true;
    const sharedProper = candidate.properTokens.filter((token) => reference.properTokens.includes(token));
    const sharedSpecific = shared.filter((token) => token.length >= 3 && !MATCH_GENERIC_TERMS.has(token));
    const sharedOrganization = sharedBrands.some((token) => ORGANIZATION_TERMS.has(token));
    const nycSchoolPolicy = shared.includes('nyc')
      && (shared.includes('ban') || shared.includes('policy'))
      && (shared.includes('school') || shared.includes('student') || shared.includes('generative') || shared.includes('policy'));
    const nytOpenAiCase = shared.includes('openai') && shared.includes('nyt') && shared.includes('lawsuit')
      && (shared.includes('fairuse') || shared.includes('copyright') || shared.includes('support'));
    const openAiTrainingCase = shared.includes('openai') && shared.includes('training')
      && shared.includes('fairuse') && shared.includes('support');
    if (nycSchoolPolicy) return true;
    if (nytOpenAiCase) return true;
    if (openAiTrainingCase) return true;
    if (sharedProper.some((token) => token.length >= 5) && sharedOrganization) return true;
    return similarity >= 0.72 || (similarity >= 0.48 && sharedSpecific.length >= 4);
  };
  for (const inputCandidate of sorted) {
    const headlineTokens = titleTokens(inputCandidate.title);
    const headlineBrands = headlineTokens.filter((token) => BRAND_TERMS.has(token));
    const sourceLabel = /^Google News\b/i.test(inputCandidate.sourceName || '') ? '' : inputCandidate.sourceName || '';
    const sourceBrands = titleTokens(sourceLabel)
      .filter((token) => BRAND_TERMS.has(token));
    const mediaTopicBrands = headlineBrands.length
      ? [headlineBrands[0], ...(ORGANIZATION_TERMS.has(headlineBrands[0])
        && headlineBrands[1] && !ORGANIZATION_TERMS.has(headlineBrands[1]) ? [headlineBrands[1]] : [])]
      : sourceBrands.slice(0, 1);
    const candidate = {
      ...inputCandidate,
      tokens: headlineTokens,
      properTokens: properTitleTokens(inputCandidate.title),
      topicBrands: [...new Set(inputCandidate.sourceType === 'official'
        ? [...sourceBrands, ...headlineBrands.slice(0, 1)]
        : mediaTopicBrands)],
    };
    const normalizedUrl = normalizeUrl(candidate.url);
    const matches = clusters.filter((cluster) => cluster.urls.has(normalizedUrl)
      || sameEvent(cluster.primary, candidate)
      || (candidate.delivered && cluster.items.some((item) => sameEvent(item, candidate)))
      || (cluster.items.some((item) => item.delivered && sameEvent(item, candidate))));
    if (matches.length) {
      const match = matches[0];
      match.items.push(candidate);
      match.urls.add(normalizedUrl);
      for (const merged of matches.slice(1)) {
        match.items.push(...merged.items);
        for (const url of merged.urls) match.urls.add(url);
        clusters.splice(clusters.indexOf(merged), 1);
      }
      const bestPrimary = [...match.items].sort((left, right) => {
        const authority = (item) => item.delivered ? -1 : item.sourceType === 'official' ? 2 : item.sourceType === 'media' ? 1 : 0;
        return authority(right) - authority(left) || left.tier - right.tier
          || new Date(right.publishedAt) - new Date(left.publishedAt);
      })[0];
      match.primary = bestPrimary;
      match.primaryTokens = bestPrimary.tokens;
      match.primaryProperTokens = bestPrimary.properTokens;
    } else {
      clusters.push({
        primary: candidate,
        items: [candidate],
        urls: new Set([normalizedUrl]),
        primaryTokens: candidate.tokens,
        primaryProperTokens: candidate.properTokens,
      });
    }
  }
  return clusters;
}

export function excludeDeliveredCandidates(candidates, deliveredStories) {
  if (!deliveredStories.length) return candidates;
  const markers = deliveredStories.flatMap((story, storyIndex) => {
    const urls = [story.url, ...(story.relatedSources || []).map((source) => source.url), ...(story.eventUrls || [])].filter(Boolean);
    const titles = [story.originalTitle, story.title,
      `${story.source || ''} ${story.originalTitle || ''}`,
      `${story.source || ''} ${story.title || ''}`,
      ...(story.eventTitles || []),
    ].map((title) => String(title || '').trim()).filter(Boolean);
    const markerInputs = [
      ...[...new Set(urls)].map((url) => ({ url, title: story.originalTitle || story.title })),
      ...[...new Set(titles)].map((title) => ({ url: story.url, title })),
    ];
    return markerInputs.map(({ url, title }, markerIndex) => ({
      id: `delivered-${storyIndex}-${markerIndex}-${story.id}`,
      guid: `delivered-${storyIndex}-${markerIndex}-${story.id}`,
      title,
      description: story.summary || '',
      url,
      publishedAt: story.publishedAt,
      sourceId: 'delivered-edition',
      sourceName: story.source || 'Delivered edition',
      sourceType: 'media',
      tier: 3,
      defaultCategory: story.category,
      aiOnly: true,
      delivered: true,
    }));
  });
  const blockedIds = new Set();
  for (const cluster of clusterCandidates([...candidates, ...markers], { maxEventGapMs: 8 * 24 * 60 * 60 * 1000 })) {
    if (!cluster.items.some((item) => item.delivered)) continue;
    for (const item of cluster.items) {
      if (!item.delivered) blockedIds.add(item.id);
    }
  }
  return candidates.filter((candidate) => !blockedIds.has(candidate.id));
}

export function scoreCluster(cluster, now = Date.now()) {
  const candidate = cluster.primary;
  const officialLabs = new Set([
    'openai', 'google-deepmind', 'google-ai', 'mistral', 'stability-ai', 'anthropic-sitemap',
    'meta-ai-research-sitemap', 'world-labs-sitemap', 'nvidia-generative-ai',
  ]);
  const sourceScore = candidate.tier === 1 ? 25 : candidate.tier === 2 ? 17 : 9;
  const authorityScore = candidate.sourceType === 'official' ? 13 : candidate.sourceType === 'media' ? 8 : 6;
  const labBonus = officialLabs.has(candidate.sourceId) ? 8 : 0;
  const ageHours = Math.max(0, (now - new Date(candidate.publishedAt).getTime()) / 3_600_000);
  const recencyScore = Math.max(0, 22 - ageHours * 0.45);
  const sourceFamily = (item) => item.sourceName.startsWith('arXiv') ? 'arxiv' : item.sourceId.replace(/^google-news-(labs|genai):/, 'publisher:');
  const uniqueItems = [...new Map(cluster.items.map((item) => [normalizeUrl(item.url), item])).values()];
  const coverageScore = Math.min(16, (new Set(uniqueItems.map(sourceFamily)).size - 1) * 6);
  const clusterText = `${candidate.title} ${(candidate.description || '').slice(0, 800)} ` + cluster.items.slice(0, 7).map((item) => item.title).join(' ');
  const detailScore = Math.min(5, Math.max(...cluster.items.map((item) => item.description?.length || 0)) / 120);
  const sponsoredPenalty = /sponsor|partner content|advertorial|pr times|press release/i.test(`${candidate.title} ${candidate.description}`) ? 14 : 0;
  const tutorialPenalty = /\b(how to|guide|tutorial|using|training a|from code to)\b|入門|使い方|活用方法/i.test(candidate.title) ? 12 : 0;
  const score = Math.max(0, Math.min(100, Math.round(
    sourceScore + authorityScore + labBonus + recencyScore + coverageScore + impactTermScore({ title: clusterText, description: '' }) + detailScore - sponsoredPenalty - tutorialPenalty,
  )));
  const onlyArxiv = uniqueItems.every((item) => item.sourceName.startsWith('arXiv'));
  if (onlyArxiv) return Math.min(score, 66);
  return candidate.tier === 3 && cluster.items.length === 1 ? Math.min(score, 68) : score;
}

export function selectTopClusters(candidates, count = 10, now = Date.now()) {
  const ranked = clusterCandidates(candidates)
    .map((cluster) => ({ ...cluster, category: inferCategory(cluster.primary), score: scoreCluster(cluster, now) }))
    .sort((a, b) => b.score - a.score || new Date(b.primary.publishedAt) - new Date(a.primary.publishedAt));

  const selected = [];
  const sourceCounts = new Map();
  const categoryCounts = new Map();
  const groupCounts = new Map();
  const sourceLimit = count <= 10 ? 2 : Math.max(3, Math.ceil(count / 9));
  const categoryLimit = count <= 10 ? 3 : Math.max(4, Math.ceil(count / 4));
  const groupFor = (cluster) => cluster.primary.sourceId.startsWith('arxiv-')
    ? 'arxiv'
    : cluster.primary.sourceId.startsWith('google-news-') ? 'google-news' : cluster.primary.sourceId;
  const groupLimit = (group) => group === 'arxiv'
    ? Math.max(2, Math.ceil(count * 0.14))
    : group === 'google-news' ? Math.max(2, Math.ceil(count * 0.22)) : sourceLimit;
  const add = (cluster) => {
    selected.push(cluster);
    const group = groupFor(cluster);
    sourceCounts.set(cluster.primary.sourceId, (sourceCounts.get(cluster.primary.sourceId) || 0) + 1);
    categoryCounts.set(cluster.category, (categoryCounts.get(cluster.category) || 0) + 1);
    groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
  };
  for (const cluster of ranked) {
    const sourceCount = sourceCounts.get(cluster.primary.sourceId) || 0;
    const categoryCount = categoryCounts.get(cluster.category) || 0;
    const group = groupFor(cluster);
    if (sourceCount >= sourceLimit || categoryCount >= categoryLimit || (groupCounts.get(group) || 0) >= groupLimit(group)) continue;
    add(cluster);
    if (selected.length === count) break;
  }
  if (selected.length < count) {
    for (const cluster of ranked) {
      const group = groupFor(cluster);
      if (!selected.includes(cluster) && (groupCounts.get(group) || 0) < groupLimit(group)) add(cluster);
      if (selected.length === count) break;
    }
  }
  if (selected.length < count) {
    for (const cluster of ranked) {
      if (!selected.includes(cluster)) add(cluster);
      if (selected.length === count) break;
    }
  }
  return selected.sort((left, right) => right.score - left.score
    || new Date(right.primary.publishedAt) - new Date(left.primary.publishedAt));
}

function splitPoints(description) {
  const clean = stripHtml(description);
  const parts = clean.split(/(?<=[。！？.!?])\s+/u).map((part) => part.trim()).filter((part) => part.length >= 18);
  const points = parts.slice(0, 3).map((part) => part.slice(0, 170));
  while (points.length < 3) {
    points.push([
      '公開情報の詳細は、配信元の原文リンクから確認できます。',
      '性能値や効果は発表元による評価で、独立した検証とは限りません。',
      '同じ出来事の関連報道がある場合は、詳細画面にまとめて表示します。',
    ][points.length]);
  }
  return points;
}

const WHY_BY_CATEGORY = {
  モデル: '基盤モデルの性能・価格・利用条件は、既存プロダクトの設計とモデル選定に直接影響します。',
  プロダクト: '利用できる機能とワークフローが変わり、個人やチームの日常業務に影響する可能性があります。',
  ビジネス: '提携・投資・市場投入の動きは、生成AI市場の競争環境と導入判断に影響します。',
  '政策・社会': '規制や社会実装の判断は、生成AIを使える範囲と責任の所在を左右します。',
  研究: '研究上の進展は、次世代モデルや新しい応用領域の実用化につながる可能性があります。',
  '開発者向け': 'APIや開発基盤の変更は、実装方法、運用コスト、提供できる体験に直結します。',
  安全性: '生成AIの能力が高まるほど、悪用対策と制御手段は導入可否を左右する重要条件になります。',
};

export function clustersToStories(clusters) {
  return clusters.map((cluster, index) => {
    const primary = cluster.primary;
    const description = stripHtml(primary.description || '');
    const uniqueItems = [...new Map(cluster.items.map((item) => [normalizeUrl(item.url), item])).values()];
    return {
      id: primary.id.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠_-]+/gu, '-').slice(0, 100),
      rank: index + 1,
      title: primary.title,
      originalTitle: primary.title,
      summary: (description || `${primary.sourceName}が公開した生成AI関連の最新情報です。`).slice(0, 260),
      points: splitPoints(description),
      whyItMatters: WHY_BY_CATEGORY[cluster.category],
      source: primary.sourceName,
      sourceType: primary.sourceType,
      category: cluster.category,
      publishedAt: primary.publishedAt,
      url: primary.url,
      impactScore: cluster.score,
      impactLabel: cluster.score >= 86 ? '特大' : cluster.score >= 72 ? '大' : '中',
      verification: new Set(uniqueItems.map((item) => item.sourceName.toLowerCase()
        .replace(/itmedia.*$/u, 'itmedia')
        .replace(/associated press|^ap$/u, 'ap')
        .replace(/[^a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu, ''))).size >= 2
        ? '複数ソース'
        : primary.sourceType === 'official' ? '公式発表' : '信頼できる報道',
      relatedSources: uniqueItems
        .filter((item) => item.url !== primary.url)
        .filter((item, relatedIndex, items) => items.findIndex((other) => other.sourceId === item.sourceId) === relatedIndex)
        .slice(0, 3)
        .map((item) => ({ name: item.sourceName, url: item.url })),
      eventUrls: [...new Set(cluster.items.map((item) => normalizeUrl(item.url)).filter(Boolean))].slice(0, 50),
      eventTitles: [...new Set(cluster.items.map((item) => item.title).filter(Boolean))].slice(0, 30),
      _rawDescription: description,
    };
  });
}

export function validateDigest(digest) {
  if (!digest || !Array.isArray(digest.stories) || digest.stories.length !== 10) throw new Error('Digest must contain exactly 10 stories');
  const ids = new Set();
  for (const [index, story] of digest.stories.entries()) {
    if (!story.id || !story.title || !story.summary || !story.url) throw new Error(`Story ${index + 1} is incomplete`);
    if (ids.has(story.id)) throw new Error(`Duplicate story id: ${story.id}`);
    if (story.rank !== index + 1) throw new Error(`Story rank mismatch at ${index + 1}`);
    if (!Array.isArray(story.points) || story.points.length !== 3) throw new Error(`Story ${index + 1} needs exactly three points`);
    ids.add(story.id);
  }
  return true;
}

export function determineDigestStatus({
  checkedSources,
  successfulSources,
  freshSources,
  coreSources,
  coreSuccessfulSources,
  coreFreshSources,
}) {
  if (!checkedSources || !coreSources) return 'degraded';
  const globalHealthy = successfulSources / checkedSources >= 0.7
    && freshSources / checkedSources >= 0.35;
  const coreHealthy = coreSuccessfulSources / coreSources >= 0.8
    && coreFreshSources / coreSources >= 0.6;
  return globalHealthy && coreHealthy ? 'live' : 'degraded';
}
