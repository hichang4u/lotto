export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

export const PAGE_SIZE = 5;

export const FALLBACK_LABELS = ['홀짝 균형형', '연속 독립형', '합계 안정형', '구간 분포형', '끝수 균형형'];

export const LAST_SYNC_STORAGE_KEY = 'lotto-last-synced-at';
export const LAST_SYNC_DRAW_STORAGE_KEY = 'lotto-last-synced-draw';

export const LOTTO_RULE_LABELS: Record<string, string> = {
    'odd-balance': '홀짝 균형형',
    'no-consecutive-pair': '연속 독립형',
    'stable-sum': '합계 안정형',
    'zone-distribution': '구간 분포형',
    'tail-balance': '끝수 균형형',
};

export const PENSION_RULE_LABELS: Record<string, string> = {
    'balanced-core': '균형형 추천',
    'odd-focus': '홀수 집중형 추천',
    'unique-focus': '고유수 확장형 추천',
    'low-sum-stable': '저합계 안정형 추천',
};

export function getPageFromPath(pathname: string): import('../types').PageKey {
    return pathname === '/pension' ? 'pension' : 'lotto';
}
