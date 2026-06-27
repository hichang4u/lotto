import { getBallTheme } from '../../utils/format';

export function Ball({ num, size = 'md', delay = 0 }: { num: number; size?: 'sm' | 'md' | 'responsive'; delay?: number }) {
    const t = getBallTheme(num);
    const dimensions = size === 'sm'
        ? { width: 38, height: 38, fontSize: 12 }
        : size === 'responsive'
            ? { width: 'clamp(38px, 8.4vw, 52px)', height: 'clamp(38px, 8.4vw, 52px)', fontSize: 'clamp(12px, 3.7vw, 16px)' }
            : { width: 52, height: 52, fontSize: 16 };

    return (
        <div
            className="ball-pop"
            style={{
                animationDelay: `${delay}ms`,
                width: dimensions.width,
                height: dimensions.height,
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: dimensions.fontSize,
                color: t.text,
                flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.92)',
                background: [
                    'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.7) 18%, rgba(255,255,255,0.18) 34%, transparent 42%)',
                    'radial-gradient(circle at 70% 74%, rgba(0,0,0,0.16) 0%, transparent 46%)',
                    `linear-gradient(180deg, ${t.base} 0%, ${t.mid} 62%, ${t.dark} 100%)`,
                ].join(', '),
                boxShadow: [
                    '0 10px 18px rgba(15, 23, 42, 0.12)',
                    'inset 0 -4px 6px rgba(0,0,0,0.14)',
                    'inset 0 2px 3px rgba(255,255,255,0.42)',
                    '0 0 0 1px rgba(15,23,42,0.04)',
                ].join(', '),
                textShadow: num <= 10 ? '0 1px 1px rgba(0,0,0,0.16)' : '0 1px 2px rgba(0,0,0,0.32)',
            }}
        >
            {num}
        </div>
    );
}

export function BonusBadge({ compact = false }: { compact?: boolean }) {
    return (
        <span
            className="absolute -right-1 -top-1 flex items-center justify-center rounded-full border border-white/90 bg-emerald-600 font-bold text-white shadow-[0_4px_10px_rgba(22,101,52,0.28)]"
            style={{
                width: compact ? 15 : 16,
                height: compact ? 15 : 16,
                fontSize: compact ? 8 : 9,
                letterSpacing: '-0.02em',
            }}
        >
            B
        </span>
    );
}
