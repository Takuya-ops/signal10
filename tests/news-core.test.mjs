import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  clusterCandidates,
  clustersToStories,
  determineDigestStatus,
  excludeDeliveredCandidates,
  isRelevant,
  normalizeUrl,
  parseFeedDocument,
  parseSitemapDocument,
  scoreCluster,
  selectTopClusters,
  validateDigest,
} from '../scripts/lib/news-core.mjs';
import { assertPublicHttpsUrl, hasSameHostname, isPublicAddress } from '../scripts/lib/network-safety.mjs';

const source = {
  id: 'test-source',
  name: 'Test Source',
  type: 'official',
  tier: 1,
  defaultCategory: 'モデル',
  aiOnly: true,
};

test('RSS and Atom entries are normalized into candidates', () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><title>New AI model</title><link>https://example.com/post?utm_source=test</link><description><![CDATA[<p>Details &amp; context.</p>]]></description><pubDate>Wed, 02 Sep 2026 12:00:00 GMT</pubDate><guid>abc</guid></item></channel></rss>`;
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Agent update</title><link rel="alternate" href="https://example.com/agent"/><summary>Useful details</summary><updated>2026-09-02T12:00:00Z</updated><id>def</id></entry></feed>`;
  const rssItems = parseFeedDocument(rss, source);
  const atomItems = parseFeedDocument(atom, source);
  assert.equal(rssItems.length, 1);
  assert.equal(rssItems[0].url, 'https://example.com/post');
  assert.equal(rssItems[0].description, 'Details & context.');
  assert.equal(atomItems[0].title, 'Agent update');
});

test('sitemap discovery honors include and exclude path rules', () => {
  const sitemap = `<?xml version="1.0"?><urlset><url><loc>https://example.com/news/model</loc><lastmod>2026-09-02</lastmod></url><url><loc>https://example.com/events/model</loc><lastmod>2026-09-02</lastmod></url><url><loc>https://example.com/about</loc><lastmod>2026-09-02</lastmod></url></urlset>`;
  const items = parseSitemapDocument(sitemap, {
    ...source,
    include: ['/news/', '/events/'],
    exclude: ['/events/'],
  }, new Date('2026-09-03T00:00:00Z').getTime());
  assert.deepEqual(items.map((item) => item.url), ['https://example.com/news/model']);
});

test('tracking parameters are removed without changing meaningful query parameters', () => {
  assert.equal(
    normalizeUrl('https://WWW.Example.com/news/?id=42&utm_campaign=x#top'),
    'https://example.com/news?id=42',
  );
});

test('network guards reject private destinations and cross-host sitemap entries', async () => {
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('127.0.0.1'), false);
  assert.equal(isPublicAddress('169.254.169.254'), false);
  assert.equal(isPublicAddress('::1'), false);
  await assert.rejects(() => assertPublicHttpsUrl('https://127.0.0.1/private'), /Private or reserved/);
  await assert.rejects(() => assertPublicHttpsUrl('http://example.com'), /Only HTTPS/);
  assert.equal(hasSameHostname('https://www.example.com/a', 'https://example.com/sitemap.xml'), true);
  assert.equal(hasSameHostname('https://evil.example/a', 'https://example.com/sitemap.xml'), false);
});

test('general feeds require an AI signal', () => {
  assert.equal(isRelevant({ title: 'New LLM inference engine', description: '', aiOnly: false }), true);
  assert.equal(isRelevant({ title: 'Quarterly gardening results', description: '', aiOnly: false }), false);
  assert.equal(isRelevant({ title: 'Any official AI-feed post', description: '', aiOnly: true }), true);
});

test('near-duplicate headlines are clustered', () => {
  const now = '2026-09-03T00:00:00.000Z';
  const base = {
    description: 'A major generative AI model release.',
    publishedAt: now,
    sourceType: 'media',
    tier: 1,
    defaultCategory: 'モデル',
    aiOnly: true,
  };
  const clusters = clusterCandidates([
    { ...base, id: 'a', guid: 'a', title: 'Acme launches Orion 4 AI model today', url: 'https://one.example/a', sourceId: 'one', sourceName: 'One' },
    { ...base, id: 'b', guid: 'b', title: 'Acme launches its Orion 4 AI model', url: 'https://two.example/b', sourceId: 'two', sourceName: 'Two' },
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].items.length, 2);
});

test('different products from the same company are not merged', () => {
  const base = {
    description: 'A generative AI product update.',
    publishedAt: '2026-09-03T00:00:00.000Z',
    sourceType: 'media',
    tier: 1,
    defaultCategory: 'プロダクト',
    aiOnly: true,
  };
  const clusters = clusterCandidates([
    { ...base, id: 'adobe-slack', guid: 'adobe-slack', title: 'Adobe launches Photoshop tools for Slack', url: 'https://one.example/adobe-slack', sourceId: 'one', sourceName: 'One' },
    { ...base, id: 'adobe-rilo', guid: 'adobe-rilo', title: 'Adobe acquires video startup Rilo', url: 'https://two.example/adobe-rilo', sourceId: 'two', sourceName: 'Two' },
    { ...base, id: 'muse-spark', guid: 'muse-spark', title: 'Meta introduces Muse Spark 1.3', url: 'https://three.example/muse-spark', sourceId: 'three', sourceName: 'Three' },
    { ...base, id: 'muse-voice', guid: 'muse-voice', title: 'Meta introduces Muse Voice Transcribe', url: 'https://four.example/muse-voice', sourceId: 'four', sourceName: 'Four' },
  ]);
  assert.equal(clusters.length, 4);
});

test('separate ChatGPT events remain separate topics', () => {
  const base = {
    description: 'A public OpenAI update.',
    publishedAt: '2026-09-03T00:00:00.000Z',
    sourceType: 'media',
    tier: 1,
    defaultCategory: 'プロダクト',
    aiOnly: true,
  };
  const clusters = clusterCandidates([
    { ...base, id: 'health', guid: 'health', title: 'OpenAI connects ChatGPT Healthcare to Epic health records', url: 'https://one.example/health', sourceId: 'one', sourceName: 'One' },
    { ...base, id: 'ads', guid: 'ads', title: 'OpenAI ChatGPT advertising reaches annual revenue milestone', url: 'https://two.example/ads', sourceId: 'two', sourceName: 'Two' },
    { ...base, id: 'tour', guid: 'tour', title: 'ATV Big Air Tour turns three days of work into hours with ChatGPT', url: 'https://three.example/tour', sourceId: 'three', sourceName: 'Three' },
  ]);
  assert.equal(clusters.length, 3);
});

test('same vendor and generic agentic wording do not merge unrelated case studies', () => {
  const base = {
    description: '', publishedAt: '2026-09-03T00:00:00.000Z', sourceType: 'official', tier: 2,
    defaultCategory: '開発者向け', aiOnly: true, sourceId: 'aws', sourceName: 'AWS Machine Learning',
  };
  const clusters = clusterCandidates([
    { ...base, id: 'docs', guid: 'docs', title: 'From code to diagrams: Agentic architecture documentation with Amazon Bedrock AgentCore', url: 'https://aws.example/docs' },
    { ...base, id: 'trinity', guid: 'trinity', title: 'Trinity: Agentic AI-powered transition planning for students with disabilities', url: 'https://aws.example/trinity' },
  ]);
  assert.equal(clusters.length, 2);
});

test('a model launch does not absorb a separate customer adoption story', () => {
  const base = {
    description: '', publishedAt: '2026-09-03T00:00:00.000Z', tier: 1,
    defaultCategory: 'モデル', aiOnly: true,
  };
  const clusters = clusterCandidates([
    { ...base, id: 'launch', guid: 'launch', title: 'Introducing Claude Fable 5.1 and Claude Mythos 5.1', url: 'https://anthropic.example/launch', sourceId: 'anthropic', sourceName: 'Anthropic', sourceType: 'official' },
    { ...base, id: 'adoption', guid: 'adoption', title: 'NEC adopts Claude Mythos Preview and joins Anthropic-led Project Glasswing', url: 'https://media.example/adoption', sourceId: 'media', sourceName: 'Media', sourceType: 'media' },
  ]);
  assert.equal(clusters.length, 2);
});

test('shared years, publishers, and version numbers do not merge unrelated events', () => {
  const base = {
    description: 'Generative AI news.',
    publishedAt: '2026-09-03T00:00:00.000Z',
    sourceType: 'media',
    tier: 1,
    defaultCategory: 'モデル',
    aiOnly: true,
  };
  const clusters = clusterCandidates([
    { ...base, id: 'qwen', guid: 'qwen', title: 'Alibaba launches Qwen 3.8 Max 0902 - Daily Tech', url: 'https://one.example/qwen', sourceId: 'one', sourceName: 'Daily Tech' },
    { ...base, id: 'gemini', guid: 'gemini', title: 'Google launches Gemini 3.8 Flash - Daily Tech', url: 'https://one.example/gemini', sourceId: 'one', sourceName: 'Daily Tech' },
    { ...base, id: 'deepseek', guid: 'deepseek', title: 'DeepSeek V4 vision model arrives in 2026 - News Wire', url: 'https://two.example/deepseek', sourceId: 'two', sourceName: 'News Wire' },
    { ...base, id: 'astra', guid: 'astra', title: 'OpenAI Astra critical cyber model arrives in 2026 - News Wire', url: 'https://two.example/astra', sourceId: 'two', sourceName: 'News Wire' },
  ]);
  assert.equal(clusters.length, 4);
});

test('dimensions and disjoint model variants are not treated as the same release', () => {
  const base = {
    description: '', publishedAt: '2026-09-03T00:00:00.000Z', sourceType: 'media', tier: 2,
    defaultCategory: 'モデル', aiOnly: true,
  };
  const clusters = clusterCandidates([
    { ...base, id: 'atlas', guid: 'atlas', title: 'World Labs introduces Atlas for interactive 3D worlds', url: 'https://one.example/atlas', sourceId: 'one', sourceName: 'One' },
    { ...base, id: 'code', guid: 'code', title: 'World Labs: 3D as code', url: 'https://two.example/code', sourceId: 'two', sourceName: 'Two' },
    { ...base, id: 'max', guid: 'max', title: 'Alibaba launches Qwen3.8-Max-0902', url: 'https://three.example/max', sourceId: 'three', sourceName: 'Three' },
    { ...base, id: 'flash', guid: 'flash', title: 'Alibaba previews Qwen3.8-Flash-Next', url: 'https://four.example/flash', sourceId: 'four', sourceName: 'Four' },
  ]);
  assert.equal(clusters.length, 4);
});

test('NYC school policy paraphrases form one event cluster', () => {
  const base = {
    description: '',
    publishedAt: '2026-09-03T00:00:00.000Z',
    sourceType: 'media',
    tier: 1,
    defaultCategory: '政策・社会',
    aiOnly: true,
  };
  const clusters = clusterCandidates([
    { ...base, id: 'nyc-a', guid: 'nyc-a', title: 'New York City puts one-year school generative AI moratorium in place', url: 'https://one.example/nyc', sourceId: 'one', sourceName: 'One' },
    { ...base, id: 'nyc-b', guid: 'nyc-b', title: 'Mayor Mamdani bans generative AI in public schools', url: 'https://two.example/nyc', sourceId: 'two', sourceName: 'Two' },
    { ...base, id: 'nyc-c', guid: 'nyc-c', title: 'ニューヨーク市、公立学校で生成AIの利用を1年間禁止', url: 'https://three.example/nyc', sourceId: 'three', sourceName: 'Three' },
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].items.length, 3);
});

test('delivered primary and related URLs prevent replays without excluding lookalikes', () => {
  const base = {
    description: '',
    publishedAt: '2026-09-03T00:00:00.000Z',
    sourceType: 'media',
    tier: 1,
    defaultCategory: '安全性',
    aiOnly: true,
  };
  const candidates = [
    { ...base, id: 'nvidia', guid: 'nvidia', title: 'NVIDIA and CrowdStrike strengthen agentic cybersecurity frontier', url: 'https://nvidia.example/safemind', sourceId: 'nvidia', sourceName: 'NVIDIA' },
    { ...base, id: 'gemini', guid: 'gemini', title: 'Google launches Gemini 3.8 Flash', url: 'https://google.example/gemini', sourceId: 'google', sourceName: 'Google' },
    { ...base, id: 'memory', guid: 'memory', title: 'Qwen3 memory benchmark for AI agents', url: 'https://paper.example/memory', sourceId: 'paper', sourceName: 'Paper' },
  ];
  const delivered = [{
    id: 'safe-mind',
    title: 'CrowdStrikeとNVIDIA、サイバー防御AIを発表',
    originalTitle: 'CrowdStrike launches frontier models for cybersecurity with NVIDIA',
    summary: 'A joint cybersecurity model launch.',
    url: 'https://crowdstrike.example/safemind',
    relatedSources: [{ name: 'NVIDIA', url: 'https://nvidia.example/safemind' }],
    publishedAt: '2026-09-02T00:00:00.000Z',
    category: '安全性',
  }];
  assert.deepEqual(excludeDeliveredCandidates(candidates, delivered).map((item) => item.id), ['gemini', 'memory']);
});

test('attached Qwen version spelling still blocks a delivered Qwen release only', () => {
  const base = {
    description: '',
    publishedAt: '2026-09-03T00:00:00.000Z',
    sourceType: 'media',
    tier: 2,
    defaultCategory: 'モデル',
    aiOnly: true,
  };
  const candidates = [
    { ...base, id: 'qwen', guid: 'qwen', title: 'Alibaba launches Qwen-3.8-Max-0902', url: 'https://media.example/qwen', sourceId: 'media', sourceName: 'Media' },
    { ...base, id: 'gemini', guid: 'gemini', title: 'Google launches Gemini 3.8 Flash', url: 'https://media.example/gemini', sourceId: 'media', sourceName: 'Media' },
    { ...base, id: 'memory', guid: 'memory', title: 'Qwen3 memory benchmark for agents', url: 'https://paper.example/qwen-memory', sourceId: 'paper', sourceName: 'Paper' },
    { ...base, id: 'flash', guid: 'flash', title: 'Alibaba previews Qwen3.8-Flash-Next', url: 'https://media.example/qwen-flash', sourceId: 'media', sourceName: 'Media' },
  ];
  const delivered = [{
    id: 'qwen-release', title: 'Qwen3.8-Max-0902を公開', originalTitle: 'Qwen3.8-Max-0902 launches',
    summary: '', url: 'https://qwen.example/release', relatedSources: [], publishedAt: '2026-09-02T00:00:00.000Z', category: 'モデル',
  }];
  assert.deepEqual(excludeDeliveredCandidates(candidates, delivered).map((item) => item.id), ['gemini', 'memory', 'flash']);
});

test('katakana model names match a delivered Latin-script release', () => {
  const candidate = {
    id: 'gemini-ja', guid: 'gemini-ja', title: 'グーグル、AIモデル「ジェミニ3.8フラッシュ」今週発表へ',
    description: '', url: 'https://media.example/gemini-ja', publishedAt: '2026-09-03T00:00:00.000Z',
    sourceId: 'media', sourceName: 'Media', sourceType: 'media', tier: 2, defaultCategory: 'モデル', aiOnly: true,
  };
  const delivered = [{
    id: 'gemini', title: 'Google、Gemini 3.8 Flashを発表', originalTitle: 'Introducing Gemini 3.8 Flash',
    summary: '', source: 'Google', url: 'https://google.example/gemini', relatedSources: [],
    publishedAt: '2026-09-02T00:00:00.000Z', category: 'モデル',
  }];
  assert.deepEqual(excludeDeliveredCandidates([candidate], delivered), []);
});

test('delivered DOJ event blocks English and Japanese paraphrases', () => {
  const base = {
    description: '', publishedAt: '2026-09-03T00:00:00.000Z', sourceType: 'media', tier: 2,
    defaultCategory: '政策・社会', aiOnly: true,
  };
  const candidates = [
    { ...base, id: 'english', guid: 'english', title: 'US Department of Justice backs fair use for AI training in landmark copyright case', url: 'https://media.example/doj-en', sourceId: 'one', sourceName: 'One' },
    { ...base, id: 'japanese', guid: 'japanese', title: 'トランプ政権「記事のAI学習は著作権侵害ではない」 OpenAIを支持する意見書、対New York Timesとの訴訟で', url: 'https://media.example/doj-ja', sourceId: 'two', sourceName: 'Two' },
    { ...base, id: 'japanese-short', guid: 'japanese-short', title: 'トランプ政権、OpenAIを支持 メディアとの著作権訴訟でAI学習は「フェアユース」', url: 'https://media.example/doj-ja-short', sourceId: 'four', sourceName: 'Four' },
    { ...base, id: 'other', guid: 'other', title: 'OpenAI launches a new developer API', url: 'https://media.example/api', sourceId: 'three', sourceName: 'Three' },
  ];
  const delivered = [{
    id: 'doj', title: '米司法省、NYT対OpenAI訴訟でAI学習の公正利用論を支持',
    originalTitle: "Justice Department backs OpenAI's fair use argument in New York Times copyright case",
    summary: '', source: 'Associated Press', url: 'https://ap.example/doj', relatedSources: [],
    publishedAt: '2026-09-02T18:00:00.000Z', category: '政策・社会',
  }];
  assert.deepEqual(excludeDeliveredCandidates(candidates, delivered).map((item) => item.id), ['other']);
});

test('delivered World Labs Atlas event blocks a differently worded follow-up', () => {
  const base = {
    description: '', publishedAt: '2026-09-03T00:00:00.000Z', sourceType: 'media', tier: 2,
    defaultCategory: 'モデル', aiOnly: true,
  };
  const candidates = [
    { ...base, id: 'atlas', guid: 'atlas', title: 'World Labs unveils Atlas, a single AI model that generates and simulates 3D worlds', url: 'https://media.example/atlas', sourceId: 'one', sourceName: 'One' },
    { ...base, id: 'paper', guid: 'paper', title: 'A biomedical literature atlas built with a language model', url: 'https://paper.example/atlas', sourceId: 'two', sourceName: 'Two', sourceType: 'research' },
    { ...base, id: 'code', guid: 'code', title: '3D as code', url: 'https://worldlabs.example/3d-as-code', sourceId: 'world-labs', sourceName: 'World Labs', sourceType: 'official' },
  ];
  const delivered = [{
    id: 'atlas-launch', title: 'World Labs、映像から操作可能な3D世界を作るAtlasを発表',
    originalTitle: 'Introducing Atlas', summary: '', source: 'World Labs', url: 'https://worldlabs.example/atlas',
    relatedSources: [], publishedAt: '2026-09-02T00:00:00.000Z', category: 'モデル',
  }];
  assert.deepEqual(excludeDeliveredCandidates(candidates, delivered).map((item) => item.id), ['paper', 'code']);
});

test('delivery matching spans the seven-day replay window', () => {
  const candidate = {
    id: 'late', guid: 'late', title: 'Google releases Gemini 8.4 Pro', description: '',
    url: 'https://media.example/gemini', publishedAt: '2026-09-07T00:00:00.000Z', sourceId: 'media',
    sourceName: 'Media', sourceType: 'media', tier: 2, defaultCategory: 'モデル', aiOnly: true,
  };
  const delivered = [{
    id: 'gemini', title: 'Google、Gemini 8.4 Proを公開', originalTitle: 'Introducing Gemini 8.4 Pro',
    summary: '', source: 'Google', url: 'https://google.example/gemini', relatedSources: [],
    publishedAt: '2026-09-01T00:00:00.000Z', category: 'モデル',
  }];
  assert.deepEqual(excludeDeliveredCandidates([candidate], delivered), []);
});

test('the same syndicated URL cannot create false multi-source verification or coverage', () => {
  const base = {
    description: 'A significant AI model release.', publishedAt: '2026-09-03T00:00:00.000Z',
    sourceType: 'media', tier: 2, defaultCategory: 'モデル', aiOnly: true,
  };
  const items = [
    { ...base, id: 'one', guid: 'one', title: 'Acme launches Orion 9', url: 'https://news.example/story', sourceId: 'feed-a', sourceName: 'Aggregator' },
    { ...base, id: 'two', guid: 'two', title: 'Acme launches Orion 9', url: 'https://news.example/story', sourceId: 'feed-b:publisher', sourceName: 'Publisher' },
  ];
  const cluster = clusterCandidates(items)[0];
  const singleCluster = clusterCandidates([items[0]])[0];
  cluster.category = 'モデル';
  cluster.score = scoreCluster(cluster, Date.parse('2026-09-03T00:00:00.000Z'));
  singleCluster.category = 'モデル';
  singleCluster.score = scoreCluster(singleCluster, Date.parse('2026-09-03T00:00:00.000Z'));
  assert.equal(cluster.score, singleCluster.score);
  assert.equal(clustersToStories([cluster])[0].verification, '信頼できる報道');
});

test('ranking always returns ten distinct clusters when enough candidates exist', () => {
  const now = new Date('2026-09-03T00:00:00.000Z').getTime();
  const candidates = Array.from({ length: 14 }, (_, index) => ({
    id: `id-${index}`,
    guid: `guid-${index}`,
    title: `Company ${index} launches unique AI model ${100 + index}`,
    description: `Official release ${index} adds a unique capability for developers and enterprises.`,
    url: `https://example${index}.com/news/${index}`,
    publishedAt: new Date(now - index * 600_000).toISOString(),
    sourceId: `source-${index}`,
    sourceName: `Source ${index}`,
    sourceType: index % 2 ? 'media' : 'official',
    tier: index < 8 ? 1 : 2,
    defaultCategory: index % 2 ? 'モデル' : '開発者向け',
    aiOnly: true,
  }));
  const selected = selectTopClusters(candidates, 10, now);
  assert.equal(selected.length, 10);
  assert.equal(new Set(selected.map((cluster) => cluster.primary.id)).size, 10);
  assert.ok(selected.every((cluster, index) => index === 0 || selected[index - 1].score >= cluster.score));
});

test('candidate preselection limits research-feed crowding', () => {
  const now = new Date('2026-09-03T00:00:00.000Z').getTime();
  const candidates = Array.from({ length: 24 }, (_, index) => ({
    id: `candidate-${index}`,
    guid: `candidate-${index}`,
    title: `${index < 12 ? 'Novel benchmark paper' : 'Company launch'} unique model ${200 + index}`,
    description: `Distinct generative AI event ${index} with production impact.`,
    url: `https://example${index}.com/${index}`,
    publishedAt: new Date(now - index * 60_000).toISOString(),
    sourceId: index < 12 ? `arxiv-${index % 3}` : `publisher-${index}`,
    sourceName: index < 12 ? `arXiv ${index % 3}` : `Publisher ${index}`,
    sourceType: index < 12 ? 'research' : 'media',
    tier: index < 12 ? 1 : 2,
    defaultCategory: index < 12 ? '研究' : 'モデル',
    aiOnly: true,
  }));
  const selected = selectTopClusters(candidates, 10, now);
  assert.ok(selected.filter((cluster) => cluster.primary.sourceId.startsWith('arxiv-')).length <= 2);
});

test('digest validation rejects anything other than a complete top ten', () => {
  assert.throws(() => validateDigest({ stories: [] }), /exactly 10/);
  const stories = Array.from({ length: 10 }, (_, index) => ({
    id: `story-${index}`,
    rank: index + 1,
    title: 'Title',
    summary: 'Summary',
    url: 'https://example.com',
    points: ['one', 'two', 'three'],
  }));
  assert.equal(validateDigest({ stories }), true);
});

test('digest health requires both broad coverage and healthy core official sources', () => {
  const healthy = {
    checkedSources: 43,
    successfulSources: 40,
    freshSources: 30,
    coreSources: 11,
    coreSuccessfulSources: 10,
    coreFreshSources: 9,
  };
  assert.equal(determineDigestStatus(healthy), 'live');
  assert.equal(determineDigestStatus({ ...healthy, coreSuccessfulSources: 8 }), 'degraded');
  assert.equal(determineDigestStatus({ ...healthy, coreFreshSources: 6 }), 'degraded');
  assert.equal(determineDigestStatus({ ...healthy, successfulSources: 29 }), 'degraded');
});

test('checked-in edition and source registry are complete and consistent', async () => {
  const digest = JSON.parse(await readFile('public/data/latest.json', 'utf8'));
  const sources = JSON.parse(await readFile('config/sources.json', 'utf8'));
  assert.equal(validateDigest(digest), true);
  assert.equal(digest.checkedSources, sources.length);
  assert.ok(sources.length >= 40);
  assert.equal(new Set(sources.map((source) => source.id)).size, sources.length);
  assert.ok(sources.every((source) => new URL(source.url).protocol === 'https:'));
});
