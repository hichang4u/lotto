const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPensionPatternModel,
  buildPensionRecommendations,
  scorePensionCombination,
  selectBestPensionCandidate,
  selectFeaturedPensionRecommendation,
  PENSION_ALGORITHM_VERSION,
} = require('../test-build/algorithms/pension.js');
const { createSeededRng, shrinkRate } = require('../test-build/algorithms/statistics.js');

const MATCHING_HISTORY = Array.from({ length: 60 }, () => '174962');
const OTHER_HISTORY = Array.from({ length: 60 }, () => '805437');
const EXPECTED_RULE_IDS = new Set([
  'balanced-core', 'odd-focus', 'unique-focus', 'low-sum-stable',
]);

describe('buildPensionRecommendations', () => {
  it('is deterministic for the same history and seed', () => {
    const first = buildPensionRecommendations(MATCHING_HISTORY, createSeededRng(42));
    const second = buildPensionRecommendations(MATCHING_HISTORY, createSeededRng(42));
    assert.deepStrictEqual(first, second);
  });

  it('returns four valid profiles with distinct last digits', () => {
    const sets = buildPensionRecommendations(MATCHING_HISTORY, createSeededRng(42));
    assert.strictEqual(sets.length, 4);

    const ruleIds = new Set();
    const lastDigits = new Set();
    for (const set of sets) {
      assert.match(set.number, /^\d{6}$/);
      assert.ok(EXPECTED_RULE_IDS.has(set.meta.ruleId));
      assert.ok(set.meta.sum >= 22 && set.meta.sum <= 34);
      assert.ok(set.meta.oddCount >= 2 && set.meta.oddCount <= 4);
      assert.ok(set.meta.uniqueDigitCount >= 4);
      assert.ok(set.meta.maxDuplicateCount <= 2);
      assert.strictEqual(set.meta.hasThreeConsecutive, false);
      assert.strictEqual(typeof set.meta.patternScore, 'number');
      assert.ok(set.meta.patternScore >= 0 && set.meta.patternScore <= 1);
      ruleIds.add(set.meta.ruleId);
      lastDigits.add(set.number[5]);
    }

    assert.deepStrictEqual(ruleIds, EXPECTED_RULE_IDS);
    assert.strictEqual(lastDigits.size, 4);

    for (let left = 0; left < sets.length; left += 1) {
      for (let right = left + 1; right < sets.length; right += 1) {
        let positionOverlap = 0;
        for (let position = 0; position < 6; position += 1) {
          if (sets[left].number[position] === sets[right].number[position]) positionOverlap += 1;
        }
        assert.ok(positionOverlap <= 3, `position overlap ${positionOverlap} exceeds limit`);
      }
    }
  });

  it('keeps data-free generation deterministic and valid', () => {
    const first = buildPensionRecommendations([], createSeededRng(7));
    const second = buildPensionRecommendations([], createSeededRng(7));
    assert.deepStrictEqual(first, second);
    assert.strictEqual(first.length, 4);
    assert.strictEqual(new Set(first.map(set => set.number[5])).size, 4);
    assert.ok(first.every(set => set.meta.patternScore === null));
  });

  it('changes generated recommendations when the learned history changes', () => {
    const matching = buildPensionRecommendations(MATCHING_HISTORY, createSeededRng(99));
    const other = buildPensionRecommendations(OTHER_HISTORY, createSeededRng(99));
    assert.notDeepStrictEqual(
      matching.map(set => set.number),
      other.map(set => set.number),
    );
  });

  it('keeps constraints and portfolio diversity under strongly repeated history', () => {
    const history = Array.from({ length: 400 }, () => '174962');
    for (let seed = 0; seed < 50; seed += 1) {
      const sets = buildPensionRecommendations(history, createSeededRng(seed));
      for (let left = 0; left < sets.length; left += 1) {
        const meta = sets[left].meta;
        assert.ok(meta.sum >= 22 && meta.sum <= 34);
        assert.ok(meta.oddCount >= 2 && meta.oddCount <= 4);
        assert.ok(meta.uniqueDigitCount >= 4);
        assert.ok(meta.maxDuplicateCount <= 2);
        assert.strictEqual(meta.hasThreeConsecutive, false);
        for (let right = left + 1; right < sets.length; right += 1) {
          let overlap = 0;
          for (let position = 0; position < 6; position += 1) {
            if (sets[left].number[position] === sets[right].number[position]) overlap += 1;
          }
          assert.ok(overlap <= 3, `seed ${seed}: position overlap ${overlap}`);
        }
      }
    }
  });
});

describe('buildPensionPatternModel', () => {
  it('shrinks unobserved position digits and suffixes to exact posteriors', () => {
    const history = ['174962', '174962', '174962'];
    const model = buildPensionPatternModel(history);
    const totalWeight = history.reduce((sum, _value, index) => (
      sum + Math.pow(0.5, index / 52)
    ), 0);

    const expectedPosition = shrinkRate(0, totalWeight, 1 / 10, 16);
    const expectedSuffix = shrinkRate(0, totalWeight, 1 / 100, 24);
    assert.ok(Math.abs(model.positionRates[0][9] - expectedPosition) < 1e-15);
    assert.ok(Math.abs(model.suffixPairRates[99] - expectedSuffix) < 1e-15);
    assert.strictEqual(model.digitPrior, 1 / 10);
    assert.strictEqual(model.suffixPairPrior, 1 / 100);
  });
});

describe('scorePensionCombination', () => {
  it('scores a matching position and suffix pattern higher', () => {
    const matchingModel = buildPensionPatternModel(MATCHING_HISTORY);
    const otherModel = buildPensionPatternModel(OTHER_HISTORY);
    const digits = [1, 7, 4, 9, 6, 2];
    assert.ok(
      scorePensionCombination(digits, matchingModel)
        > scorePensionCombination(digits, otherModel),
    );
  });

  it('always returns a score in [0, 1]', () => {
    const model = buildPensionPatternModel(MATCHING_HISTORY);
    const rng = createSeededRng(123);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const digits = Array.from({ length: 6 }, () => Math.floor(rng() * 10));
      const score = scorePensionCombination(digits, model);
      assert.ok(score >= 0 && score <= 1, `score ${score} out of range`);
    }
  });
});

describe('selectBestPensionCandidate', () => {
  it('selects the highest score and preserves the first candidate on ties', () => {
    const first = { digits: [1, 2, 3, 4, 5, 6], score: 0.7 };
    const highest = { digits: [6, 5, 4, 3, 2, 1], score: 0.9 };
    assert.strictEqual(selectBestPensionCandidate([first, highest]), highest);

    const tied = { digits: [9, 8, 7, 6, 5, 4], score: 0.7 };
    assert.strictEqual(selectBestPensionCandidate([first, tied]), first);
  });
});

describe('selectFeaturedPensionRecommendation', () => {
  function recommendation(number, patternScore, ruleWeight) {
    return {
      label: number,
      number,
      meta: { patternScore, ruleWeight },
    };
  }

  it('selects the highest statistical score across the four completed sets', () => {
    const history = Array.from({ length: 120 }, (_, index) => String(100000 + ((index * 7919) % 900000)));
    const sets = buildPensionRecommendations(history, createSeededRng(0));
    const featured = selectFeaturedPensionRecommendation(sets);
    const maxScore = Math.max(...sets.map(set => set.meta.patternScore));

    assert.strictEqual(featured.meta.patternScore, maxScore);
    assert.ok(sets.includes(featured));
    assert.notStrictEqual(featured, sets[0]);
  });

  it('uses rule weight as the tie-breaker and otherwise preserves generation order', () => {
    const first = recommendation('111111', 0.8, 1.1);
    const higherWeight = recommendation('222222', 0.8, 1.2);
    const sameTie = recommendation('333333', 0.8, 1.2);

    assert.strictEqual(
      selectFeaturedPensionRecommendation([first, higherWeight, sameTie]),
      higherWeight,
    );
    assert.strictEqual(selectFeaturedPensionRecommendation([]), null);
  });
});

describe('version', () => {
  it('is pension-multi-set-v5.0', () => {
    assert.strictEqual(PENSION_ALGORITHM_VERSION, 'pension-multi-set-v5.0');
  });
});
