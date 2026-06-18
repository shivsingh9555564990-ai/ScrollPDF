'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('ServiceWorker registration failed: ', err);
        });
      });
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Don't show immediately all the time, let the timer decide, 
      // but showing immediately on first detect is fine too.
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Initial popup after a short delay if prompt is available
    const initialTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    // Recurring popup every 5 minutes if prompt is still available
    const recurringTimer = setInterval(() => {
      setShowPrompt(true);
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(initialTimer);
      clearInterval(recurringTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!deferredPrompt || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl p-4 rounded-xl z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between">
         <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">Z</div>
             <div>
                <h3 className="font-bold text-gray-900 dark:text-white leading-tight">Install ZeraNotes</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Add to home screen for quick access</p>
             </div>
         </div>
         <button onClick={() => setShowPrompt(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
             <X size={18} />
         </button>
      </div>
      <button 
        onClick={handleInstallClick}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
      >
          <Download size={18} />
          Install App
      </button>
    </div>
  );
}
