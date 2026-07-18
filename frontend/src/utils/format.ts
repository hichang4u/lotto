import type { BallTheme } from '../types';

// 동행복권 공식 메인 카드의 단색 볼 팔레트 (구간별 채움색 + 흰 숫자)
export function getBallTheme(num: number): BallTheme {
    if (num <= 10) return { base: '#f2a413', mid: '#d98d0b', dark: '#b57306', text: '#ffffff' };
    if (num <= 20) return { base: '#2e6be6', mid: '#2456c2', dark: '#1b429c', text: '#ffffff' };
    if (num <= 30) return { base: '#d6455d', mid: '#b8354c', dark: '#96283c', text: '#ffffff' };
    if (num <= 40) return { base: '#6e7683', mid: '#59606c', dark: '#454b55', text: '#ffffff' };
    return { base: '#3fa55b', mid: '#328a4a', dark: '#266e3a', text: '#ffffff' };
}

export function formatMoneyKRW(amount: number) {
    if (!amount) return '-';
    const eok = amount / 100000000;
    return `${eok.toFixed(eok >= 100 ? 0 : 1).replace(/\.0$/, '')}억 원`;
}

export function formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(value);
}
