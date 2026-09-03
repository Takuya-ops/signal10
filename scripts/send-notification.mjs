import { appendFile, readFile } from 'node:fs/promises';
import { validateDigest } from './lib/news-core.mjs';

const digest = JSON.parse(await readFile('public/data/latest.json', 'utf8'));
validateDigest(digest);
const date = digest.edition.slice(0, 10).replaceAll('-', '.');
const top = digest.stories[0];
const repositoryUrl = digest.repositoryUrl || (process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : '');
const DAILY_LABEL = 'signal10-daily';
const DAILY_MARKER = '<!-- signal10-daily -->';
const DAILY_LABEL_COLOR = '1f6feb';

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function markdownUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return '';
  return url.replace(/[()@<>\\`]/g, (character) => `%${character.codePointAt(0).toString(16).toUpperCase()}`);
}

function neutralizeMentions(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/@/g, '@\u200b')
    .replace(/<!/g, '<\u200b!')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownText(value) {
  return neutralizeMentions(value).replace(/[\\`*_\[\]{}()#+\-.!|<>~]/g, '\\$&');
}

function markdownLink(label, value) {
  const url = markdownUrl(value);
  return url ? `[${markdownText(label)}](<${url}>)` : markdownText(`${label}（URLを利用できません）`);
}

function neutralizeUserLinks(value) {
  return neutralizeMentions(value)
    .replace(/\b(?:https?|ftp):\/\//gi, (scheme) => scheme.replace(':', ':\u200b'))
    .replace(/\bwww\./gi, (prefix) => `${prefix.slice(0, -1)}\u200b.`);
}

function slackText(value) {
  const replacements = new Map([
    ['&', '＆'],
    ['<', '＜'],
    ['>', '＞'],
    ['*', '＊'],
    ['_', '＿'],
    ['~', '～'],
    ['`', '｀'],
  ]);
  return neutralizeUserLinks(value).replace(/[&<>*_~`]/g, (character) => replacements.get(character));
}

function discordText(value) {
  return neutralizeUserLinks(value).replace(/[\\`*_\[\]{}()#+\-.!|<>~]/g, '\\$&');
}

function sanitizedDigest() {
  return {
    ...digest,
    editorialNote: neutralizeMentions(digest.editorialNote),
    repositoryUrl: safeHttpUrl(digest.repositoryUrl),
    stories: digest.stories.map((story) => ({
      ...story,
      title: neutralizeMentions(story.title),
      originalTitle: neutralizeMentions(story.originalTitle),
      summary: neutralizeMentions(story.summary),
      points: story.points.map(neutralizeMentions),
      whyItMatters: neutralizeMentions(story.whyItMatters),
      source: neutralizeMentions(story.source),
      sourceType: neutralizeMentions(story.sourceType),
      category: neutralizeMentions(story.category),
      impactLabel: neutralizeMentions(story.impactLabel),
      verification: neutralizeMentions(story.verification),
      url: safeHttpUrl(story.url),
      relatedSources: (story.relatedSources || []).map((source) => ({
        name: neutralizeMentions(source.name),
        url: safeHttpUrl(source.url),
      })),
      eventUrls: (story.eventUrls || []).map(safeHttpUrl).filter(Boolean),
      eventTitles: (story.eventTitles || []).map(neutralizeMentions),
    })),
  };
}

const appUrl = safeHttpUrl(process.env.PUBLIC_APP_URL || repositoryUrl);
const healthStatus = digest.status === 'live' ? '正常' : '要確認';
const healthSummary = `収集状態: ${healthStatus} · 成功 ${digest.successfulSources}/${digest.checkedSources}ソース · 直近21日更新 ${digest.freshSources ?? '不明'}ソース`;
const coreHealthSummary = Number.isInteger(digest.coreSources)
  ? `主要公式: 成功 ${digest.coreSuccessfulSources}/${digest.coreSources} · 直近21日更新 ${digest.coreFreshSources}/${digest.coreSources}`
  : '';

function markdownBody() {
  const lines = [
    `# SIGNAL 10 — ${date}`,
    '',
    `> ${markdownText(digest.editorialNote)}`,
    '',
    ...digest.stories.flatMap((story) => [
      `## ${story.rank}. ${markdownText(story.title)}`,
      '',
      `**${markdownText(story.source)} · ${markdownText(story.category)} · 重要度 ${story.impactScore}/100**`,
      '',
      markdownText(story.summary),
      '',
      `- ${story.points.map(markdownText).join('\n- ')}`,
      '',
      `**なぜ重要か:** ${markdownText(story.whyItMatters)}`,
      '',
      markdownLink('原文を読む', story.url),
      '',
    ]),
    '---',
    `${healthSummary} · 候補${digest.candidateCount}件`,
    coreHealthSummary,
    appUrl ? `\n${markdownLink('見やすいWeb版を開く', appUrl)}` : '',
    '',
    DAILY_MARKER,
  ];
  return lines.join('\n');
}

function compactText(formatUserText) {
  return [
    `SIGNAL 10 — ${date}`,
    `今日の1位: ${formatUserText(top.title)}`,
    formatUserText(top.summary),
    '',
    ...digest.stories.slice(1).map((story) => `${story.rank}. ${formatUserText(story.title)}`),
    '',
    healthSummary,
    appUrl ? `Web版: ${markdownUrl(appUrl)}` : '',
  ].filter(Boolean).join('\n');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestWithRetry(url, options = {}, settings = {}) {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('Notification endpoint must use HTTPS');
  const attempts = settings.attempts ?? 3;
  const acceptedStatuses = new Set(settings.acceptStatuses || []);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(target, {
        ...options,
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok || acceptedStatuses.has(response.status)) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        const error = new Error(`${target.hostname} returned ${response.status}`);
        error.retryable = false;
        throw error;
      }
      lastError = new Error(`${target.hostname} returned ${response.status}`);
    } catch (error) {
      if (error?.retryable === false) throw error;
      lastError = error;
    }
    if (attempt < attempts) await wait(450 * 2 ** (attempt - 1));
  }
  throw lastError;
}

async function postJson(url, body) {
  await requestWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function issueHasLabel(issue, labelName) {
  return Array.isArray(issue.labels) && issue.labels.some((label) => (
    typeof label === 'string' ? label === labelName : label?.name === labelName
  ));
}

function isManagedDailyIssue(issue) {
  return !issue.pull_request
    && issue.user?.login === 'github-actions[bot]'
    && issueHasLabel(issue, DAILY_LABEL)
    && typeof issue.body === 'string'
    && issue.body.includes(DAILY_MARKER);
}

async function ensureDailyLabel(api, headers) {
  const labelUrl = `${api}/labels/${encodeURIComponent(DAILY_LABEL)}`;
  const existing = await requestWithRetry(labelUrl, { headers }, { acceptStatuses: [404] });
  if (existing.status !== 404) return;

  const created = await requestWithRetry(`${api}/labels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: DAILY_LABEL,
      color: DAILY_LABEL_COLOR,
      description: 'SIGNAL 10 automated morning digest',
    }),
  }, { acceptStatuses: [422] });

  // Another run may have created the label between the GET and POST.
  if (created.status === 422) await requestWithRetry(labelUrl, { headers });
}

async function deliverGitHubIssue() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) return 'skipped';
  const api = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
  const repositoryOwner = process.env.GITHUB_REPOSITORY.split('/')[0];
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const title = `AI朝刊 ${date} — #1 ${neutralizeMentions(top.title)}`;
  await ensureDailyLabel(api, headers);
  const listResponse = await requestWithRetry(`${api}/issues?state=open&labels=${encodeURIComponent(DAILY_LABEL)}&per_page=100`, { headers });
  const openIssues = await listResponse.json();
  const managedIssues = openIssues.filter(isManagedDailyIssue);
  const existing = managedIssues.find((issue) => issue.title?.startsWith(`AI朝刊 ${date}`));

  if (existing) {
    await Promise.all(managedIssues
      .filter((issue) => issue.number !== existing.number)
      .map((issue) => requestWithRetry(`${api}/issues/${issue.number}`, {
        method: 'PATCH', headers, body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      })));
    await requestWithRetry(`${api}/issues/${existing.number}`, {
      method: 'PATCH', headers, body: JSON.stringify({ title, body: markdownBody(), assignees: [repositoryOwner] }),
    });
    return 'updated';
  }

  await Promise.all(managedIssues
    .map((issue) => requestWithRetry(`${api}/issues/${issue.number}`, {
      method: 'PATCH', headers, body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    })));
  await requestWithRetry(`${api}/issues`, {
    method: 'POST', headers, body: JSON.stringify({
      title,
      body: markdownBody(),
      assignees: [repositoryOwner],
      labels: [DAILY_LABEL],
    }),
  });
  return 'created';
}

const deliveries = [
  ['GitHub', deliverGitHubIssue],
  ['Slack', async () => process.env.SLACK_WEBHOOK_URL ? postJson(process.env.SLACK_WEBHOOK_URL, { text: compactText(slackText), mrkdwn: false }) : 'skipped'],
  ['Discord', async () => process.env.DISCORD_WEBHOOK_URL ? postJson(process.env.DISCORD_WEBHOOK_URL, { content: compactText(discordText).slice(0, 1_990), allowed_mentions: { parse: [] } }) : 'skipped'],
  ['Webhook', async () => process.env.GENERIC_WEBHOOK_URL ? postJson(process.env.GENERIC_WEBHOOK_URL, { title: `SIGNAL 10 — ${date}`, appUrl, digest: sanitizedDigest() }) : 'skipped'],
];

const deliveryResults = await Promise.all(deliveries.map(async ([name, operation]) => {
  try {
    const result = await operation();
    return { ok: true, message: `${name}: ${result || 'sent'}` };
  } catch (error) {
    return { ok: false, message: `${name}: ${error.message}` };
  }
}));
const results = deliveryResults.filter((result) => result.ok).map((result) => result.message);
const failures = deliveryResults.filter((result) => !result.ok).map((result) => result.message);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdownBody()}\n\n### 配信結果\n${[...results, ...failures].map((line) => `- ${line}`).join('\n')}\n`);
}
console.log(results.join(' · '));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
