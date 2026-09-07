// src/components/common/PWAInstallButton.tsx - PWA Install Trigger with iOS Modal
import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  if (!isInstallable && !isIOS) return null;

  return (
    <>
      <button
        id="btn-pwa-install"
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95"
        title="Uygulamayı Cihaza Yükle"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Uygulamayı Yükle</span>
      </button>

      {/* iOS Safari Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 max-w-sm w-full text-slate-200 relative shadow-2xl">
            <button
              id="btn-close-ios-pwa-modal"
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-400" />
              iPhone / iPad'e Yükleme
            </h3>

            <p className="text-xs text-slate-400 mb-4">
              MAÇ ANALİZ PRO uygulamasını ana ekranınıza ekleyerek tam ekran deneyimiyle kullanabilirsiniz:
            </p>

            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0">1</span>
                <span>Safari tarayıcısının altındaki <Share2 className="inline w-3.5 h-3.5 mx-1 text-sky-400" /> <strong>Paylaş</strong> simgesine dokunun.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0">2</span>
                <span>Menüyü aşağı kaydırıp <PlusSquare className="inline w-3.5 h-3.5 mx-1 text-emerald-400" /> <strong>Ana Ekrana Ekle</strong> seçeneğini seçin.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0">3</span>
                <span>Sağ üstteki <strong>Ekle</strong> butonuna basarak kurulumu tamamlayın.</span>
              </li>
            </ol>

            <button
              id="btn-dismiss-ios-guide"
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};
