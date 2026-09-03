import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLAIM_IDS,
  applyVerifiedStory,
  claimVerdictPasses,
  generatedStoryIds,
  modelsAreIndependent,
  validateClaimVerdicts,
  validateGeneratedStory,
} from '../scripts/lib/enrichment-safety.mjs';

const sourceStory = {
  id: 'acme-assistant',
  originalTitle: 'Acme releases a new text assistant',
  _rawDescription: 'The assistant summarizes documents for enterprise users. The service is available in a limited preview.',
  publishedAt: '2026-09-03T00:00:00.000Z',
};

const evidence = (sourcePart = 'description', quote = 'The assistant summarizes documents for enterprise users.') => [{
  sourceId: sourceStory.id,
  sourcePart,
  quote,
}];

function generatedStory(overrides = {}) {
  const textById = {
    title: 'Acme、文書要約アシスタントを公開',
    summary: 'Acmeは企業利用者向けに文書を要約するアシスタントを限定プレビューで提供します。',
    'point-1': '企業利用者向けに文書を要約します。',
    'point-2': '提供形態は限定プレビューです。',
    'point-3': '新しいテキストアシスタントとして公開されました。',
  };
  const claims = CLAIM_IDS.map((claimId) => ({
    claimId,
    text: textById[claimId],
    evidence: claimId === 'title' || claimId === 'point-3'
      ? evidence('originalTitle', sourceStory.originalTitle)
      : claimId === 'point-2'
        ? evidence('description', 'The service is available in a limited preview.')
        : evidence(),
  }));
  return { id: sourceStory.id, claims, ...overrides };
}

function verification(statusFor = {}) {
  return {
    stories: [{
      id: sourceStory.id,
      claims: CLAIM_IDS.map((claimId) => ({ claimId, status: statusFor[claimId] || 'supported' })),
    }],
  };
}

test('a complete fixed claim set is the sole source of displayed AI text', () => {
  const modeled = validateGeneratedStory(generatedStory(), sourceStory);
  assert.equal(modeled.title, 'Acme、文書要約アシスタントを公開');
  assert.equal(modeled.summary, generatedStory().claims[1].text);
  assert.deepEqual(modeled.points, generatedStory().claims.slice(2).map((claim) => claim.text));
});

test('missing, duplicate, and unknown claim IDs are rejected', () => {
  const missing = generatedStory();
  missing.claims.pop();
  assert.equal(validateGeneratedStory(missing, sourceStory), null);

  const duplicate = generatedStory();
  duplicate.claims[4] = { ...duplicate.claims[3] };
  assert.equal(validateGeneratedStory(duplicate, sourceStory), null);

  const unknown = generatedStory();
  unknown.claims[4] = { ...unknown.claims[4], claimId: 'other' };
  assert.equal(validateGeneratedStory(unknown, sourceStory), null);
});

test('cross-story and non-verbatim evidence are rejected locally', () => {
  const crossStory = generatedStory();
  crossStory.claims[0].evidence[0].sourceId = 'another-story';
  assert.equal(validateGeneratedStory(crossStory, sourceStory), null);

  const alteredQuote = generatedStory();
  alteredQuote.claims[0].evidence[0].quote = 'Acme supposedly releases a new text assistant';
  assert.equal(validateGeneratedStory(alteredQuote, sourceStory), null);
});

test('fabricated Japanese claims require every independent claim verdict to pass', () => {
  const fabricated = generatedStory();
  const falseTexts = [
    '政府、生成AIの利用を全国で全面禁止',
    '政府は国内の全企業と学校で生成AIの利用を停止する方針を決定しました。',
    '企業向けサービスを含むすべての生成AIが対象です。',
    '学校や行政機関でも利用が認められません。',
    '違反した事業者には厳しい措置が取られます。',
  ];
  fabricated.claims.forEach((claim, index) => { claim.text = falseTexts[index]; });
  // Exact quotes alone are not treated as semantic proof; the second model must decide each claim.
  assert.ok(validateGeneratedStory(fabricated, sourceStory));
  const verdicts = validateClaimVerdicts(verification({ summary: 'unsupported' }), [sourceStory.id]);
  assert.equal(claimVerdictPasses(verdicts.get(sourceStory.id)), false);
});

test('unsupported or insufficient claims reject the whole article, while all-supported passes', () => {
  const fallback = {
    ...sourceStory,
    title: sourceStory.originalTitle,
    summary: sourceStory._rawDescription,
    points: ['fallback one', 'fallback two', 'fallback three'],
    whyItMatters: 'Deterministic category explanation',
  };
  const modeled = validateGeneratedStory(generatedStory(), sourceStory);
  const supported = validateClaimVerdicts(verification(), [sourceStory.id]);
  assert.equal(claimVerdictPasses(supported.get(sourceStory.id)), true);
  assert.equal(applyVerifiedStory(fallback, modeled, supported.get(sourceStory.id), 1).title, modeled.title);

  const unsupported = validateClaimVerdicts(verification({ 'point-2': 'unsupported' }), [sourceStory.id]);
  assert.equal(claimVerdictPasses(unsupported.get(sourceStory.id)), false);
  assert.deepEqual(applyVerifiedStory(fallback, modeled, unsupported.get(sourceStory.id), 1), { ...fallback, rank: 1 });

  const insufficient = validateClaimVerdicts(verification({ title: 'insufficient' }), [sourceStory.id]);
  assert.equal(claimVerdictPasses(insufficient.get(sourceStory.id)), false);
  assert.equal(validateClaimVerdicts({ stories: [] }, [sourceStory.id]), null);
  const unknownStory = verification();
  unknownStory.stories[0].id = 'unknown';
  assert.equal(validateClaimVerdicts(unknownStory, [sourceStory.id]), null);
});

test('the verifier must be configured as a different model ID', () => {
  assert.equal(modelsAreIndependent('openai/gpt-4.1', 'openai/gpt-4.1-mini'), true);
  assert.equal(modelsAreIndependent('openai/gpt-4.1', 'openai/gpt-4.1'), false);
  assert.equal(modelsAreIndependent('gpt-4.1-mini', 'openai/gpt-4.1-mini'), false);
  assert.equal(modelsAreIndependent('openai/gpt-4.1', ''), false);
});

test('schema-shaped generation payloads are checked locally before reading story IDs', () => {
  assert.equal(generatedStoryIds({ stories: '1234567890' }), null);
  assert.equal(generatedStoryIds({ stories: Array(10).fill(null) }), null);
  assert.deepEqual(generatedStoryIds({
    stories: Array.from({ length: 10 }, (_, index) => ({ id: `story-${index}` })),
  }), Array.from({ length: 10 }, (_, index) => `story-${index}`));
});
