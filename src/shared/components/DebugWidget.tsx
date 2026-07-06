import { useState } from 'react';
import { Settings, ChevronDown, Users, Shield, Cpu, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';

export interface DebugAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'warning' | 'danger' | 'success';
  disabled?: boolean;
}

interface DebugWidgetProps {
  code: string;
  phase: string;
  isHost: boolean;
  rosterCount: number;
  isConnected: boolean;
  actions: DebugAction[];
}

export default function DebugWidget({
  code,
  phase,
  isHost,
  rosterCount,
  isConnected,
  actions,
}: DebugWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem('brodin_debug_expanded') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      try {
        localStorage.setItem('brodin_debug_expanded', String(!prev));
      } catch {
        // Ignore storage errors in private browsing modes
      }
      return !prev;
    });
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-sans">
      {/* Collapsed view (just a button) */}
      {!isExpanded ? (
        <button
          onClick={toggleExpand}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/90 text-yellow-400 shadow-2xl border border-yellow-500/40 hover:scale-105 hover:bg-slate-800 transition-all backdrop-blur-md"
          title="Open Debug Panel"
        >
          <Settings className="h-6 w-6 animate-pulse" />
        </button>
      ) : (
        /* Expanded panel */
        <div className="w-80 rounded-xl border border-slate-700/60 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-md overflow-hidden animate-scaleIn">
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-850 px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-yellow-400" />
              <span className="font-display font-extrabold text-sm tracking-wide text-yellow-400">
                🛠️ DEBUG PANEL
              </span>
            </div>
            <button
              onClick={toggleExpand}
              className="text-slate-400 hover:text-white hover:bg-slate-800/80 p-1 rounded transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="bg-slate-950/40 px-4 py-3 grid grid-cols-2 gap-2 text-xs border-b border-slate-800/60">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield className="h-3.5 w-3.5" />
              <span>Role: <strong className="text-slate-200">{isHost ? 'Host' : 'Player'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Users className="h-3.5 w-3.5" />
              <span>Players: <strong className="text-slate-200">{rosterCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Cpu className="h-3.5 w-3.5" />
              <span>Room: <strong className="text-slate-200">{code}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <RefreshCw className={cn("h-3.5 w-3.5", isConnected ? "text-emerald-400" : "text-rose-400 animate-spin")} />
              <span>Status: <strong className={isConnected ? "text-emerald-400" : "text-rose-400"}>{isConnected ? 'Connected' : 'Offline'}</strong></span>
            </div>
            <div className="col-span-2 mt-1 pt-1 border-t border-slate-800/30 text-slate-400 flex items-center gap-1">
              <span>Phase: </span>
              <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-yellow-300 font-bold uppercase tracking-wider">
                {phase}
              </span>
            </div>
          </div>

          {/* Actions Section */}
          <div className="p-4 max-h-60 overflow-y-auto space-y-3">
            {actions.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-2">
                No debug actions available for this screen.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {actions.map((act, idx) => (
                  <button
                    key={idx}
                    onClick={act.onClick}
                    disabled={act.disabled}
                    className={cn(
                      "w-full rounded-lg py-2 px-3 text-xs font-bold text-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900",
                      act.disabled
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                        : act.variant === 'primary'
                        ? "bg-sky-600 hover:bg-sky-500 text-white focus:ring-sky-500"
                        : act.variant === 'warning'
                        ? "bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500"
                        : act.variant === 'danger'
                        ? "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500"
                        : act.variant === 'success'
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500"
                        : "bg-slate-700 hover:bg-slate-650 text-slate-100 focus:ring-slate-600"
                    )}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
