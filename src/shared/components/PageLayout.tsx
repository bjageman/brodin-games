import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

// Back and Quit used to be bare grey text and read as decoration rather than
// controls. They're pills now — the tone follows the header, since a page that
// paints its own light background (Fake It) needs ink, not grey-on-dark.
const CHROME_BUTTON =
  'rounded-full border-2 px-3.5 py-1 text-sm font-bold transition-colors';

interface PageLayoutProps {
  title?: string;
  titleContent?: ReactNode;
  backHref?: string;
  onQuit?: () => void;
  contentClassName?: string;
  bgClassName?: string;
  headerClassName?: string;
  dividerClassName?: string;
  footerClassName?: string;
  children: ReactNode;
}

export default function PageLayout({
  title,
  titleContent,
  backHref,
  onQuit,
  contentClassName,
  bgClassName,
  headerClassName,
  dividerClassName,
  footerClassName,
  children,
}: PageLayoutProps) {
  // A page whose content owns its own header (Fake It's lobby, say) passes none
  // of these. Rendering the chrome anyway leaves an empty band and a stray
  // divider above the real header.
  const hasHeader = Boolean(title || titleContent || backHref || onQuit);

  // headerClassName is only set by a game that paints its own background, and
  // it already carries that theme's readable ink colour.
  const chromeTone = headerClassName
    ? cn('border-current hover:opacity-70', headerClassName)
    : 'border-gray-500 text-gray-200 hover:border-red-400 hover:bg-red-500/10 hover:text-red-300';

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col font-sans text-gray-100 mx-auto w-full max-w-[1600px] px-2 sm:px-6 lg:px-10",
        bgClassName ?? "bg-brodin-bg"
      )}
    >
      {hasHeader && (
      <header className="relative flex flex-col items-center justify-center pb-3 w-full pt-6">
        <div className="relative flex justify-center items-center w-full min-h-[36px] px-4">
          {backHref && (
            <a href={backHref} className={cn('absolute left-4', CHROME_BUTTON, chromeTone)}>
              ← Back
            </a>
          )}
          {onQuit && (
            <button
              type="button"
              onClick={onQuit}
              className={cn('absolute left-4', CHROME_BUTTON, chromeTone)}
            >
              Quit
            </button>
          )}
          {titleContent ?? (
            <h1
              className={cn(
                "font-display text-xl font-bold tracking-wide text-center px-10",
                headerClassName ?? "text-brodin-accent"
              )}
            >
              {title}
            </h1>
          )}
        </div>
        <div className={cn("flex items-center gap-2.5 w-full px-4 mt-3", dividerClassName ?? "text-brodin-primary")}>
          <div className="flex-1 h-px bg-current opacity-30" />
          <span className="text-[8px] leading-none opacity-50">◆</span>
          <div className="flex-1 h-px bg-current opacity-30" />
        </div>
      </header>
      )}

      <div className={cn(contentClassName ?? "flex-1 flex flex-col pt-6 px-4 pb-4")}>
        {children}
      </div>

      <footer className="flex justify-center items-center py-4 px-4 border-t border-brodin-primary/20">
        <p className={cn("text-xs", footerClassName ?? "text-gray-500")}>Brodin Games</p>
      </footer>
    </div>
  );
}
