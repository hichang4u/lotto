import React from 'react';

export function SectionCard({
    title,
    icon,
    eyebrow,
    action,
    children,
    accent = 'default',
    headerClassName = '',
    bodyClassName = '',
}: {
    title: string;
    icon?: React.ReactNode;
    eyebrow?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    accent?: 'default' | 'soft';
    headerClassName?: string;
    bodyClassName?: string;
}) {
    // 네오 브루탈리즘 카드 클래스 매핑
    const cardClass = `neo-card ${accent === 'soft' ? 'neo-card--soft' : ''}`.trim();

    return (
        <section className={cardClass}>
            {/* 헤더 영역 경계선 블랙 실선 적용 */}
            <div className={`flex items-start justify-between gap-3 border-b-3 border-black px-5 py-4 sm:px-6 ${headerClassName}`.trim()}>
                <div>
                    {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">{eyebrow}</p>}
                    <h2 className="mt-1.5 text-xl font-black text-black sm:text-2xl">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    {action}
                    {icon && (
                        /* 아이콘 역시 네오 미니 박스 스타일로 구현 */
                        <div className="rounded-xl border-2 border-black bg-white p-2 text-black shadow-[2px_2px_0px_0px_#000]">
                            {icon}
                        </div>
                    )}
                </div>
            </div>
            <div className={`px-5 py-5 sm:px-6 ${bodyClassName}`.trim()}>{children}</div>
        </section>
    );
}
