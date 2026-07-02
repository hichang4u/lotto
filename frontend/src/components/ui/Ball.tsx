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
                fontWeight: 700,
                fontSize: dimensions.fontSize,
                color: t.text,
                flexShrink: 0,
                background: `linear-gradient(135deg, ${t.base} 0%, ${t.dark} 100%)`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            }}
        >
            {num}
        </div>
    );
}

export function BonusBadge({ compact = false }: { compact?: boolean }) {
    return (
        <span
            className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-slate-800 font-bold text-white shadow-sm ring-2 ring-white"
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
