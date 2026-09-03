import { stripHtml } from './news-core.mjs';

export const CLAIM_IDS = ['title', 'summary', 'point-1', 'point-2', 'point-3'];

const CLAIM_LIMITS = {
  title: 100,
  summary: 360,
  'point-1': 220,
  'point-2': 220,
  'point-3': 220,
};

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && expected.every((key, index) => keys[index] === key);
}

export function cleanModelText(value, maxLength) {
  return stripHtml(String(value || ''))
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/@/g, '＠')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function evidenceMatchesSource(evidence, story) {
  if (!hasExactKeys(evidence, ['quote', 'sourceId', 'sourcePart'])) return false;
  if (evidence.sourceId !== story.id || !['originalTitle', 'description'].includes(evidence.sourcePart)) return false;
  if (typeof evidence.quote !== 'string' || evidence.quote !== evidence.quote.trim()
    || evidence.quote.length < 10 || evidence.quote.length > 240) return false;
  const sourcePart = evidence.sourcePart === 'originalTitle'
    ? story.originalTitle
    : story._rawDescription.slice(0, 1_200);
  return typeof sourcePart === 'string' && sourcePart.includes(evidence.quote);
}

function isAtomicText(text) {
  return !/[\r\n]/.test(text) && (text.match(/[。！？!?]/g) || []).length <= 1;
}

export function validateGeneratedStory(next, story) {
  if (!hasExactKeys(next, ['claims', 'id']) || !story || next.id !== story.id
    || !Array.isArray(next.claims) || next.claims.length !== CLAIM_IDS.length) return null;
  const claims = new Map();
  for (const claim of next.claims) {
    if (!hasExactKeys(claim, ['claimId', 'evidence', 'text'])
      || !CLAIM_IDS.includes(claim.claimId) || claims.has(claim.claimId)) return null;
    const maxLength = CLAIM_LIMITS[claim.claimId];
    if (typeof claim.text !== 'string' || claim.text !== cleanModelText(claim.text, maxLength)
      || !claim.text || !isAtomicText(claim.text)) return null;
    if (!Array.isArray(claim.evidence) || claim.evidence.length < 1 || claim.evidence.length > 3
      || !claim.evidence.every((evidence) => evidenceMatchesSource(evidence, story))) return null;
    const evidenceKeys = claim.evidence.map(({ sourceId, sourcePart, quote }) => `${sourceId}\u0000${sourcePart}\u0000${quote}`);
    if (new Set(evidenceKeys).size !== evidenceKeys.length) return null;
    claims.set(claim.claimId, claim);
  }
  if (CLAIM_IDS.some((claimId) => !claims.has(claimId))) return null;
  return {
    id: next.id,
    title: claims.get('title').text,
    summary: claims.get('summary').text,
    points: ['point-1', 'point-2', 'point-3'].map((claimId) => claims.get(claimId).text),
    claims: CLAIM_IDS.map((claimId) => claims.get(claimId)),
  };
}

export function containsUnsupportedNumbers(next, story) {
  const sourceText = `${story.originalTitle} ${story._rawDescription.slice(0, 1_200)} ${story.publishedAt}`;
  const sourceNumbers = new Set((sourceText.match(/\d+(?:[.,]\d+)*/g) || []).map((value) => value.replaceAll(',', '')));
  const outputText = [next.title, next.summary, ...(next.points || [])].join(' ');
  return (outputText.match(/\d+(?:[.,]\d+)*/g) || [])
    .map((value) => value.replaceAll(',', ''))
    .some((value) => !sourceNumbers.has(value));
}

export function containsUnsupportedLatinEntity(next, story) {
  const sourceText = `${story.originalTitle} ${story._rawDescription.slice(0, 1_200)}`.toLowerCase();
  const outputText = [next.title, next.summary, ...(next.points || [])].join(' ');
  const entities = outputText.match(/\b[A-Z][A-Za-z0-9._+-]{2,}\b/g) || [];
  return entities.some((entity) => !sourceText.includes(entity.toLowerCase()));
}

export function modelsAreIndependent(generatorModel, verifierModel) {
  const canonical = (value) => typeof value === 'string'
    ? value.trim().toLowerCase().replace(/^openai\//, '')
    : '';
  const generator = canonical(generatorModel);
  const verifier = canonical(verifierModel);
  return Boolean(generator) && Boolean(verifier) && generator !== verifier;
}

export function generatedStoryIds(payload, expectedCount = 10) {
  if (!hasExactKeys(payload, ['stories']) || !Array.isArray(payload.stories)
    || payload.stories.length !== expectedCount) return null;
  const ids = [];
  for (const story of payload.stories) {
    if (!story || typeof story !== 'object' || Array.isArray(story)
      || typeof story.id !== 'string' || !story.id || story.id.length > 160) return null;
    ids.push(story.id);
  }
  return ids;
}

export function validateClaimVerdicts(payload, expectedIds) {
  if (!hasExactKeys(payload, ['stories']) || !Array.isArray(payload.stories)
    || payload.stories.length !== expectedIds.length) return null;
  const byId = new Map();
  for (const story of payload.stories) {
    if (!hasExactKeys(story, ['claims', 'id']) || typeof story.id !== 'string' || byId.has(story.id)
      || !Array.isArray(story.claims) || story.claims.length !== CLAIM_IDS.length) return null;
    const claims = new Map();
    for (const verdict of story.claims) {
      if (!hasExactKeys(verdict, ['claimId', 'status'])
        || !CLAIM_IDS.includes(verdict.claimId) || claims.has(verdict.claimId)
        || !['supported', 'unsupported', 'insufficient'].includes(verdict.status)) return null;
      claims.set(verdict.claimId, verdict.status);
    }
    if (CLAIM_IDS.some((claimId) => !claims.has(claimId))) return null;
    byId.set(story.id, claims);
  }
  if (expectedIds.some((id) => !byId.has(id))) return null;
  return byId;
}

export function claimVerdictPasses(verdicts) {
  return verdicts instanceof Map && CLAIM_IDS.every((claimId) => verdicts.get(claimId) === 'supported');
}

export function applyVerifiedStory(fallbackStory, modeledStory, verdicts, rank) {
  const fallback = { ...fallbackStory, rank };
  if (!modeledStory || !claimVerdictPasses(verdicts)) return fallback;
  return {
    ...fallback,
    title: modeledStory.title,
    summary: modeledStory.summary,
    points: [...modeledStory.points],
  };
}
