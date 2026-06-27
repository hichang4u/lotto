export function PensionDigitBall({ value, color }: { value: string; color: string }) {
    return (
        <div
            className="flex h-[clamp(50px,8.6vw,78px)] w-[clamp(50px,8.6vw,78px)] items-center justify-center rounded-full border-[4px] bg-white text-[clamp(24px,4vw,40px)] font-semibold text-slate-950"
            style={{ borderColor: color }}
        >
            {value}
        </div>
    );
}

const DIGIT_COLORS = ['#d1d5db', '#ea580c', '#fb8c00', '#fbbc04', '#2d9cdb', '#a06cd5', '#b0b7c3'];

export function PensionNumberRow({
    label,
    subtitle,
    number,
    band,
    showBand = true,
    prefixLabel,
}: {
    label: string;
    subtitle: string;
    number: string;
    band?: string;
    showBand?: boolean;
    prefixLabel?: string;
}) {
    const digits = number.padStart(6, '0').slice(-6).split('');

    return (
        <div className="grid gap-5 border-t border-slate-100 py-6 lg:grid-cols-[1.05fr_1.55fr] lg:items-center lg:gap-12">
            <div className="text-center lg:text-left">
                <div className="text-[24px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[34px] lg:text-[38px]">
                    {label} <span className="mx-1.5 text-slate-300">|</span> {subtitle}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
                {showBand && band ? (
                    <div className="text-center">
                        <PensionDigitBall value={band} color={DIGIT_COLORS[0]} />
                        <div className="mt-2 text-sm font-medium text-slate-500">조</div>
                    </div>
                ) : prefixLabel ? (
                    <div className="px-1 text-base font-medium text-slate-500 sm:text-lg">{prefixLabel}</div>
                ) : null}
                {digits.map((digit, index) => (
                    <PensionDigitBall
                        key={`${label}-${index}`}
                        value={digit}
                        color={DIGIT_COLORS[Math.min(index + (showBand ? 1 : 0), DIGIT_COLORS.length - 1)]}
                    />
                ))}
            </div>
        </div>
    );
}
