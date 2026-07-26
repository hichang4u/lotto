import type { PensionPurchaseGameResult } from '../types';
import { PENSION_BANDS_PER_TICKET } from '../constants';

// 각조 구매의 조 번호 1~5
export const PENSION_BAND_NUMBERS = Array.from(
    { length: PENSION_BANDS_PER_TICKET },
    (_, index) => index + 1,
);

// 추천 카드와 동일한 자리별 링 색상 (1~6자리)
export const PENSION_DIGIT_COLORS = ['#e2502b', '#f07e26', '#f2c024', '#3379e3', '#9a6bd0', '#9aa3ad'];

export function toSixDigits(value: string) {
    return value.padStart(6, '0').slice(-6);
}

// 줄(조) 하나의 등수. 낙첨이거나 추첨 전이면 null.
// 6자리 전장 일치일 때만 조가 등수를 가른다 — 당첨 조가 1등, 나머지 4조가 2등.
// winningBand가 1~5 정수로 파싱되지 않으면 1등 줄을 특정할 수 없으므로 전부 2등으로 본다.
export function deriveBandRank(
    game: PensionPurchaseGameResult,
    winningBand: string | null,
    band: number,
): number | null {
    const suffixMatches = game.suffixMatches;
    if (suffixMatches === null || suffixMatches === 0) return null;
    if (suffixMatches < 6) return 8 - suffixMatches;

    const winner = Number(winningBand);
    if (!Number.isInteger(winner) || winner < 1 || winner > PENSION_BANDS_PER_TICKET) return 2;
    return band === winner ? 1 : 2;
}

export type PensionBandRow = {
    band: number;
    digits: string[];
    rank: number | null;
    bonus: boolean;
    judged: boolean;
    // 이 인덱스부터 끝까지가 일치한 자리 (원색 유지), 앞쪽은 회색조 처리
    matchedFrom: number;
};

export function buildPensionBandRows(
    game: PensionPurchaseGameResult,
    winningBand: string | null,
): PensionBandRow[] {
    const digits = toSixDigits(game.number).split('');
    const judged = game.suffixMatches !== null;
    const bonus = game.bonusMatched === true;
    // 보너스 전장 일치면 6자리 모두 맞은 것으로 보여준다
    const matchedFrom = bonus ? 0 : 6 - (game.suffixMatches ?? 0);

    return PENSION_BAND_NUMBERS.map(band => ({
        band,
        digits,
        rank: deriveBandRank(game, winningBand, band),
        bonus,
        judged,
        matchedFrom,
    }));
}
