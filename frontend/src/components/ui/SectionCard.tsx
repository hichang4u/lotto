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
    return (
        <section className={`rounded-3xl border border-slate-200/60 bg-white shadow-sm ${accent === 'soft' ? 'bg-slate-50/50' : ''}`}>
            <div className={`flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6 ${headerClassName}`.trim()}>
                <div>
                    {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{eyebrow}</p>}
                    <h2 className="mt-1 text-xl font-bold text-slate-800">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    {action}
                    {icon && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-2.5 text-slate-500">{icon}</div>}
                </div>
            </div>
            <div className={`px-5 py-6 sm:px-6 ${bodyClassName}`.trim()}>{children}</div>
        </section>
    );
}
