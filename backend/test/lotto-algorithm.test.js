const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildGeneratedSets,
  buildPatternModel,
  scoreCombination,
  selectBestCandidate,
  getCommonZoneCount,
  getProfileZoneCount,
  SET_CONFIGS,
  LOTTO_ALGORITHM_VERSION,
} = require('../test-build/algorithms/lotto.js');

const { createSeededRng, shrinkRate } = require('../test-build/algorithms/statistics.js');

// ---------------------------------------------------------------------------
// Test fixture: 10 hand-crafted draws with zone-boundary numbers, cold/hot,
// consecutive pairs. Input is ASC by drwNo (oldest first).
// ---------------------------------------------------------------------------
function makeDraw(drwNo, nums) {
  return {
    drwNo,
    drwtNo1: nums[0], drwtNo2: nums[1], drwtNo3: nums[2],
    drwtNo4: nums[3], drwtNo5: nums[4], drwtNo6: nums[5],
    bnusNo: 7,
  };
}

const FIXTURE_DRAWS = [
  makeDraw(1,  [3, 9, 18, 27, 36, 45]),
  makeDraw(2,  [1, 10, 19, 28, 37, 44]),
  makeDraw(3,  [5, 14, 23, 32, 38, 43]),
  makeDraw(4,  [2, 11, 20, 29, 35, 42]),
  makeDraw(5,  [7, 13, 22, 31, 39, 41]),
  makeDraw(6,  [4, 15, 24, 33, 40, 45]),
  makeDraw(7,  [6, 12, 21, 30, 36, 44]),
  makeDraw(8,  [8, 16, 25, 34, 37, 43]),
  makeDraw(9,  [1, 10, 19, 28, 38, 42]),
  makeDraw(10, [3, 14, 23, 32, 39, 41]),
];

// The 5 expected profile IDs from SET_CONFIGS
const EXPECTED_PROFILE_IDS = new Set([
  'odd-balance', 'no-consecutive-pair', 'stable-sum', 'zone-distribution', 'tail-balance',
]);

// ---------------------------------------------------------------------------
// T1: Deterministic seeded output
// ---------------------------------------------------------------------------
describe('buildGeneratedSets', () => {
  it('produces identical results for the same seed', () => {
    const a = buildGeneratedSets(FIXTURE_DRAWS, createSeededRng(42));
    const b = buildGeneratedSets(FIXTURE_DRAWS, createSeededRng(42));
    assert.deepStrictEqual(
      a.map(s => s.numbers),
      b.map(s => s.numbers),
    );
  });

  // -------------------------------------------------------------------------
  // T2: Output invariants — 5 sets, profiles, labels, numbers
  // -------------------------------------------------------------------------
  it('returns 5 valid sets with correct invariants and profile coverage', () => {
    const sets = buildGeneratedSets(FIXTURE_DRAWS, createSeededRng(42));
    assert.strictEqual(sets.length, 5);

    const returnedRuleIds = new Set();
    const returnedLabels = new Set();

    for (const s of sets) {
      assert.strictEqual(s.numbers.length, 6);
      assert.ok(s.numbers.every(n => n >= 1 && n <= 45), 'numbers in [1,45]');
      assert.deepStrictEqual(s.numbers, [...s.numbers].sort((a, b) => a - b), 'sorted');
      assert.strictEqual(new Set(s.numbers).size, 6, 'unique');

      // Each set must have a matching ruleId and label from SET_CONFIGS
      const ruleId = s.meta?.ruleId;
      assert.ok(ruleId, 'set must have a ruleId');
      assert.ok(EXPECTED_PROFILE_IDS.has(ruleId), `ruleId ${ruleId} must be a known profile`);
      const config = SET_CONFIGS.find(c => c.id === ruleId);
      assert.ok(config, `config for ${ruleId} must exist`);
      assert.strictEqual(s.label, config.label, 'label must match config');

      returnedRuleIds.add(ruleId);
      returnedLabels.add(s.label);
    }

    // All 5 profiles must be represented (sorted identity sets, order-independent)
    assert.deepStrictEqual(returnedRuleIds, EXPECTED_PROFILE_IDS, 'all profiles covered');
    assert.strictEqual(returnedLabels.size, 5, 'distinct labels');
  });

  // -------------------------------------------------------------------------
  // T5: Data-free compatibility
  // -------------------------------------------------------------------------
  it('returns 5 valid random sets when draws is empty', () => {
    const sets = buildGeneratedSets([], createSeededRng(7));
    assert.strictEqual(sets.length, 5);
    for (const s of sets) {
      assert.strictEqual(s.numbers.length, 6);
      assert.ok(s.numbers.every(n => n >= 1 && n <= 45));
    }
  });
});

// ---------------------------------------------------------------------------
// T3: Pattern score sensitivity — history affects scores
// ---------------------------------------------------------------------------
describe('scoreCombination', () => {
  it('scores a combination higher when history matches it', () => {
    // Low-biased draws: numbers concentrated in 1-20
    const lowDraws = Array.from({ length: 20 }, (_, i) =>
      makeDraw(i + 1, [1, 5, 8, 12, 15, 18]),
    );
    // High-biased draws: numbers concentrated in 26-45
    const highDraws = Array.from({ length: 20 }, (_, i) =>
      makeDraw(i + 1, [26, 30, 33, 37, 40, 44]),
    );

    const lowModel = buildPatternModel(lowDraws);
    const highModel = buildPatternModel(highDraws);

    const lowCombo = [1, 2, 3, 4, 5, 6];
    assert.ok(
      scoreCombination(lowCombo, lowModel) > scoreCombination(lowCombo, highModel),
      'low-biased model should score low combo higher',
    );
  });

  // -------------------------------------------------------------------------
  // T7: Score bounds — always in [0, 1]
  // -------------------------------------------------------------------------
  it('always returns a score in [0, 1]', () => {
    const model = buildPatternModel(FIXTURE_DRAWS);
    const rng = createSeededRng(123);
    for (let i = 0; i < 100; i++) {
      const nums = [];
      const used = new Set();
      while (nums.length < 6) {
        const n = Math.floor(rng() * 45) + 1;
        if (!used.has(n)) { used.add(n); nums.push(n); }
      }
      nums.sort((a, b) => a - b);
      const score = scoreCombination(nums, model);
      assert.ok(score >= 0 && score <= 1, `score ${score} out of [0,1]`);
    }
  });
});

// ---------------------------------------------------------------------------
// T6: Zone definition consistency — intentionally different
// ---------------------------------------------------------------------------
describe('zone definitions', () => {
  it('getCommonZoneCount and getProfileZoneCount differ on boundary numbers', () => {
    const nums = [9, 10, 18, 19, 36, 37];
    const common = getCommonZoneCount(nums);
    const profile = getProfileZoneCount(nums);
    assert.notStrictEqual(common, profile, 'definitions must differ');
    assert.strictEqual(common, 5, 'common zones (ceil/9)');
    assert.strictEqual(profile, 3, 'profile zones (ceil/10)');
  });

  it('SET_CONFIGS zone-distribution check uses getProfileZoneCount definition', () => {
    const zoneConfig = SET_CONFIGS.find(c => c.id === 'zone-distribution');
    assert.ok(zoneConfig, 'zone-distribution config must exist');
    // [1,11,21,31,41,45] → ceil/10 zones: {1,2,3,4,5} → 5 >= 4 → true
    assert.strictEqual(zoneConfig.check([1, 11, 21, 31, 41, 45]), true);
    // [1,2,3,4,5,6] → ceil/10 zones: {1} → 1 < 4 → false
    assert.strictEqual(zoneConfig.check([1, 2, 3, 4, 5, 6]), false);
    // Verify it matches getProfileZoneCount, not getCommonZoneCount
    // [9,10,18,19,36,37]: profile=3 < 4 → false, common=5 >= 4 → would be true
    assert.strictEqual(zoneConfig.check([9, 10, 18, 19, 36, 37]), false,
      'must use profile zones (ceil/10), not common zones (ceil/9)');
  });
});

// ---------------------------------------------------------------------------
// T-pair: Pair prior and unobserved pair posterior
// ---------------------------------------------------------------------------
describe('pair prior and posterior', () => {
  it('uses exactly 1/66 as the pair inclusion prior', () => {
    const model = buildPatternModel(FIXTURE_DRAWS);
    assert.strictEqual(model.pairPrior, 1 / 66);
  });

  it('assigns unobserved pairs the exact shrunk posterior', () => {
    const model = buildPatternModel(FIXTURE_DRAWS);

    // Compute expected totalDecayedWeight from FIXTURE_DRAWS with half-life 52
    let totalDecayedWeight = 0;
    for (let i = 0; i < FIXTURE_DRAWS.length; i++) {
      const age = FIXTURE_DRAWS.length - 1 - i;
      totalDecayedWeight += Math.pow(0.5, age / 52);
    }

    // Pair (2, 44) never co-occurs in FIXTURE_DRAWS
    const key = 2 * 46 + 44;
    const pairVal = model.pairFreq.get(key);

    const expected = shrinkRate(0, totalDecayedWeight, 1 / 66, 12);

    assert.notStrictEqual(pairVal, undefined, 'unobserved pair must be in map');
    assert.notStrictEqual(pairVal, 1 / 66, 'must not be raw prior');
    assert.ok(pairVal < 1 / 66, 'posterior for unobserved pair < prior');
    assert.ok(
      Math.abs(pairVal - expected) < 1e-15,
      `unobserved posterior ${pairVal} must equal shrinkRate(0, ${totalDecayedWeight}, 1/66, 12) = ${expected}`,
    );
  });
});

// ---------------------------------------------------------------------------
// T-select: selectBestCandidate — highest score wins, ties preserve order
// ---------------------------------------------------------------------------
describe('selectBestCandidate', () => {
  it('returns the candidate with the highest score', () => {
    const candidates = [
      { numbers: [1, 2, 3, 4, 5, 6], score: 0.3 },
      { numbers: [7, 8, 9, 10, 11, 12], score: 0.9 },
      { numbers: [13, 14, 15, 16, 17, 18], score: 0.5 },
    ];
    const best = selectBestCandidate(candidates);
    assert.deepStrictEqual(best.numbers, [7, 8, 9, 10, 11, 12]);
    assert.strictEqual(best.score, 0.9);
  });

  it('preserves first-collected candidate on tie', () => {
    const candidates = [
      { numbers: [1, 2, 3, 4, 5, 6], score: 0.7 },
      { numbers: [7, 8, 9, 10, 11, 12], score: 0.7 },
      { numbers: [13, 14, 15, 16, 17, 18], score: 0.7 },
    ];
    const best = selectBestCandidate(candidates);
    // First-collected wins on tie (stable: strict > not >=)
    assert.deepStrictEqual(best.numbers, [1, 2, 3, 4, 5, 6]);
  });
});

// ---------------------------------------------------------------------------
// T8: Model consistency — same input produces same output
// ---------------------------------------------------------------------------
describe('buildPatternModel', () => {
  it('returns identical models for same draws', () => {
    const m1 = buildPatternModel(FIXTURE_DRAWS);
    const m2 = buildPatternModel(FIXTURE_DRAWS);
    assert.strictEqual(m1.medianGap, m2.medianGap);
    assert.strictEqual(m1.pairPrior, m2.pairPrior);
    assert.deepStrictEqual(m1.shapeMed, m2.shapeMed);
    for (let i = 0; i < 45; i++) {
      assert.strictEqual(m1.decayedFreq[i], m2.decayedFreq[i]);
      assert.strictEqual(m1.lastSeenGap[i], m2.lastSeenGap[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// T-version: Algorithm version is v5.0
// ---------------------------------------------------------------------------
describe('version', () => {
  it('is v5.0', () => {
    assert.strictEqual(LOTTO_ALGORITHM_VERSION, 'v5.0');
  });
});
