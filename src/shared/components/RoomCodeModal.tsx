import { useState } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { cn } from '../utils/cn';
import { DEFAULT_THEME, type GameTheme } from '../games';

interface RoomCodeModalProps {
  gameCode: string;
  joinUrl: string;
  onClose: () => void;
  /** Falls back to the default (dark blue) palette. */
  theme?: GameTheme;
}

export default function RoomCodeModal({ gameCode, joinUrl, onClose, theme }: RoomCodeModalProps) {
  const t = theme ?? DEFAULT_THEME;
  useScrollLock();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSuccess = (which: 'url' | 'code') => {
    if (which === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const fallbackCopy = (text: string, which: 'url' | 'code') => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        handleSuccess(which);
      } else {
        console.error('Fallback copy command was unsuccessful');
      }
    } catch (err) {
      console.error('Fallback copy failed: ', err);
    }
  };

  const copy = (text: string, which: 'url' | 'code') => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => handleSuccess(which))
        .catch(err => {
          console.error('Failed to copy text: ', err);
          fallbackCopy(text, which);
        });
    } else {
      fallbackCopy(text, which);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn('w-full max-w-xs rounded-xl shadow-2xl p-5 space-y-4 border', t.panel)}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <p className={cn('text-xs font-semibold uppercase tracking-widest mb-0.5', t.muted)}>
            Room Code
          </p>
          <p className={cn('text-3xl font-mono font-bold tracking-widest', t.code)}>
            {gameCode}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-lg">
            <QRCode value={joinUrl} size={160} />
          </div>
        </div>

        {/* Copy buttons */}
        <div className="space-y-2">
          <button
            onClick={() => copy(joinUrl, 'url')}
            className={cn('w-full px-3 py-2 rounded-md text-sm font-semibold transition-colors', t.accent)}
          >
            {copiedUrl ? '✓ Copied!' : 'Copy Join URL'}
          </button>
          <button
            onClick={() => copy(gameCode, 'code')}
            className={cn('w-full px-3 py-2 rounded-md text-sm font-semibold border transition-opacity hover:opacity-80', t.field)}
          >
            {copiedCode ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>

        <button
          onClick={onClose}
          className={cn('w-full text-center text-xs underline hover:opacity-80', t.muted)}
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
