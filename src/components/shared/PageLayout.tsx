import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface PageLayoutProps {
  title?: string;
  titleContent?: ReactNode;
  backHref?: string;
  contentClassName?: string;
  children: ReactNode;
}

export default function PageLayout({ title, titleContent, backHref, contentClassName, children }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-brodin-bg text-gray-100 mx-auto max-w-xl md:max-w-2xl">
      <header className="relative flex flex-col items-center justify-center pb-3 w-full pt-6">
        <div className="relative flex justify-center items-center w-full min-h-[36px] px-4">
          {backHref && (
            <a href={backHref} className="absolute left-4 text-sm text-gray-400 hover:text-gray-100">
              ← Back
            </a>
          )}
          {titleContent ?? (
            <h1 className="font-display text-xl font-bold text-brodin-accent tracking-wide text-center px-10">
              {title}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2.5 w-full px-4 mt-3">
          <div className="flex-1 h-px bg-brodin-primary/30" />
          <span className="text-[8px] leading-none text-brodin-primary/50">◆</span>
          <div className="flex-1 h-px bg-brodin-primary/30" />
        </div>
      </header>

      <div className={cn(contentClassName ?? "flex-1 flex flex-col pt-6 px-4 pb-4")}>
        {children}
      </div>

      <footer className="flex justify-center items-center py-4 px-4 border-t border-brodin-primary/20">
        <p className="text-xs text-gray-500">Brodin Games</p>
      </footer>
    </div>
  );
}
