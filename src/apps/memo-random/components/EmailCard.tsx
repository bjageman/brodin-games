import type { ReactNode } from 'react';
import type { PlayerSheetResult } from '../types';
import { cn } from '../../../shared/utils/cn';
import { getTemplateById } from '../utils/matchmaking';
import { splitIntoSegments } from '../utils/templateSegments';
import { CATEGORY_STYLES } from '../utils/categoryColors';

function emailHandle(name: string): string {
  const handle = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return handle || 'employee';
}

interface EmailCardProps {
  sheet: PlayerSheetResult;
  accent?: 'none' | 'selected' | 'winner';
  badge?: ReactNode;
  className?: string;
}

export default function EmailCard({ sheet, accent = 'none', badge, className }: EmailCardProps) {
  const template = getTemplateById(sheet.templateId);
  const segments = splitIntoSegments(template);

  return (
    <div
      className={cn(
        'w-full rounded-lg overflow-hidden border-2 bg-gray-50 transition-colors',
        accent === 'none' && 'border-gray-300',
        accent === 'selected' && 'border-brodin-accent ring-2 ring-brodin-accent/30',
        accent === 'winner' && 'border-brodin-gold ring-2 ring-brodin-gold/30',
        className
      )}
    >
      <div className="bg-gray-200/80 px-3 py-1.5 flex items-center justify-between border-b border-gray-300">
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Inter-Office Memo</span>
        {badge}
      </div>
      <div className="px-3.5 pt-3 pb-1 space-y-0.5 font-mono text-[11px] text-gray-600">
        <p className="truncate">
          <span className="text-gray-400">From:</span> {sheet.playerName} &lt;{emailHandle(sheet.playerName)}@memo-random.biz&gt;
        </p>
        <p><span className="text-gray-400">To:</span> All-Staff</p>
        <p className="truncate"><span className="text-gray-400">Subject:</span> {template.title}</p>
      </div>
      <div className="mx-3.5 my-2 border-t border-dashed border-gray-300" />
      <p className="px-3.5 pb-3.5 text-sm leading-relaxed text-gray-800 font-serif">
        {segments.map((seg, i) =>
          seg.kind === 'text' ? (
            <span key={i}>{seg.value}</span>
          ) : (
            <span key={i} className={cn('font-bold', CATEGORY_STYLES[seg.category].textOnLight)}>
              {sheet.answers[seg.id] ?? '???'}
            </span>
          )
        )}
      </p>
    </div>
  );
}
