import { useState } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { cn } from '../utils/cn';

interface RoomCodeModalProps {
  gameCode: string;
  joinUrl: string;
  onClose: () => void;
}

export default function RoomCodeModal({ gameCode, joinUrl, onClose }: RoomCodeModalProps) {
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
        className={cn(
          'w-full max-w-xs rounded-xl shadow-2xl p-5 space-y-4 bg-brodin-panel border border-brodin-primary/30 text-gray-100'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-0.5 text-gray-400">
            Room Code
          </p>
          <p className="text-3xl font-mono font-bold tracking-widest text-brodin-accent">
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
            className="w-full px-3 py-2 rounded-md text-sm font-semibold border transition-colors bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            {copiedUrl ? '✓ Copied!' : 'Copy Join URL'}
          </button>
          <button
            onClick={() => copy(gameCode, 'code')}
            className="w-full px-3 py-2 rounded-md text-sm font-semibold border transition-colors bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            {copiedCode ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300 underline"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
