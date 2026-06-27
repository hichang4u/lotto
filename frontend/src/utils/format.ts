import type { BallTheme } from '../types';

export function getBallTheme(num: number): BallTheme {
    if (num <= 10) return { base: '#fdd835', mid: '#f6c21a', dark: '#d59b00', text: '#5b4300' };
    if (num <= 20) return { base: '#6ec6ff', mid: '#3aa0eb', dark: '#1976d2', text: '#ffffff' };
    if (num <= 30) return { base: '#ff7b6e', mid: '#f25545', dark: '#d83929', text: '#ffffff' };
    if (num <= 40) return { base: '#cfd8dc', mid: '#a7b2b9', dark: '#7b8790', text: '#ffffff' };
    return { base: '#8bd76d', mid: '#58b947', dark: '#2e8b2e', text: '#ffffff' };
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
