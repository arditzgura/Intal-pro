
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, QrCode, Camera, CheckCircle2, AlertCircle, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import QRCode from 'qrcode';
import LZString from 'lz-string';
// @ts-ignore
import jsQR from 'jsqr';

interface BackupData {
  invoices: any[];
  clients: any[];
  items: any[];
  stock_entries: any[];
  config: any;
}

interface Props {
  backupData: BackupData;
  onClose: () => void;
  onRestoreData: (data: BackupData) => void;
}

const CHUNK_SIZE = 1500; // karaktere per QR
const CHUNK_INTERVAL = 2200; // ms mes QR-ve

const QRSyncModal: React.FC<Props> = ({ backupData, onClose, onRestoreData }) => {
  const [mode, setMode] = useState<'choose' | 'export' | 'import'>('choose');

  // ─── EXPORT state ───────────────────────────────────────────────
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── IMPORT state ───────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<Record<number, string>>({});
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedRef = useRef<string>('');

  // ─── Gjenero chunks nga backup data ─────────────────────────────
  useEffect(() => {
    if (mode !== 'export') return;
    setIsGenerating(true);
    try {
      const json = JSON.stringify(backupData);
      const compressed = LZString.compressToBase64(json);
      const total = Math.ceil(compressed.length / CHUNK_SIZE);
      const newChunks: string[] = [];
      for (let i = 0; i < total; i++) {
        const slice = compressed.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        // Format: INTAL|v1|index/total|data
        newChunks.push(`INTAL|v1|${i}/${total}|${slice}`);
      }
      setChunks(newChunks);
      setCurrentChunk(0);
    } finally {
      setIsGenerating(false);
    }
  }, [mode, backupData]);

  // ─── Gjenero QR për chunk aktual ────────────────────────────────
  useEffect(() => {
    if (!chunks.length) return;
    QRCode.toDataURL(chunks[currentChunk], {
      errorCorrectionLevel: 'L',
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(setQrDataUrl).catch(console.error);
  }, [chunks, currentChunk]);

  // ─── Kiko automatikisht ndërmjet QR-ve ──────────────────────────
  useEffect(() => {
    if (mode !== 'export' || chunks.length <= 1) return;
    chunkTimerRef.current = setInterval(() => {
      setCurrentChunk(c => (c + 1) % chunks.length);
    }, CHUNK_INTERVAL);
    return () => { if (chunkTimerRef.current) clearInterval(chunkTimerRef.current); };
  }, [mode, chunks.length]);

  // ─── Nis kamerën për skanim ──────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
    } catch (e) {
      setImportError('Kamera nuk u gjet ose nuk ka leje.');
    }
  }, []);

  // ─── Ndalo kamerën ──────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  // ─── Skano frame nga kamera ──────────────────────────────────────
  useEffect(() => {
    if (!scanning) return;
    scanTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (!code?.data) return;
      const raw = code.data;
      if (raw === lastScannedRef.current) return;
      lastScannedRef.current = raw;

      // Parsim: INTAL|v1|index/total|data
      const parts = raw.split('|');
      if (parts.length < 4 || parts[0] !== 'INTAL' || parts[1] !== 'v1') return;
      const [idxStr, totalStr] = parts[2].split('/');
      const idx = parseInt(idxStr);
      const total = parseInt(totalStr);
      if (isNaN(idx) || isNaN(total)) return;
      const data = parts.slice(3).join('|');

      setTotalChunks(total);
      setScannedChunks(prev => {
        const updated = { ...prev, [idx]: data };
        // Kontrollo nëse kemi të gjitha chunks
        if (Object.keys(updated).length === total) {
          stopCamera();
          // Rindërtoje dhe importo
          try {
            const fullCompressed = Array.from({ length: total }, (_, i) => updated[i]).join('');
            const json = LZString.decompressFromBase64(fullCompressed);
            if (!json) throw new Error('Decompression failed');
            const parsed = JSON.parse(json) as BackupData;
            setImportDone(true);
            setTimeout(() => {
              onRestoreData(parsed);
              onClose();
            }, 1200);
          } catch {
            setImportError('Të dhënat janë të dëmtuara. Provo sërish.');
          }
        }
        return updated;
      });
    }, 150);

    return () => { if (scanTimerRef.current) clearInterval(scanTimerRef.current); };
  }, [scanning, stopCamera, onRestoreData, onClose]);

  // ─── Cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCamera(); if (chunkTimerRef.current) clearInterval(chunkTimerRef.current); };
  }, [stopCamera]);

  const scannedCount = Object.keys(scannedChunks).length;
  const progress = totalChunks ? Math.round((scannedCount / totalChunks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl"><QrCode size={22} className="text-white"/></div>
            <div>
              <h2 className="text-white font-black uppercase tracking-tight text-sm">QR Sinkronizim</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Desktop ↔ Mobil</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-all p-1"><X size={20}/></button>
        </div>

        <div className="p-6">

          {/* ── Zgjidh modalitetin ── */}
          {mode === 'choose' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest text-center mb-6">
                Çfarë dëshiron të bësh?
              </p>
              <button
                onClick={() => setMode('export')}
                className="w-full flex items-center gap-4 p-5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-100 transition-all group"
              >
                <div className="bg-indigo-600 p-3 rounded-xl text-white group-hover:scale-110 transition-transform">
                  <QrCode size={24}/>
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-900 uppercase text-sm">Eksporto QR</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">Gjenero QR code nga ky desktop</p>
                </div>
                <ChevronRight size={18} className="ml-auto text-slate-400"/>
              </button>
              <button
                onClick={() => { setMode('import'); setTimeout(startCamera, 300); }}
                className="w-full flex items-center gap-4 p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-100 transition-all group"
              >
                <div className="bg-emerald-600 p-3 rounded-xl text-white group-hover:scale-110 transition-transform">
                  <Camera size={24}/>
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-900 uppercase text-sm">Skano QR</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">Importo të dhëna nga një pajisje tjetër</p>
                </div>
                <ChevronRight size={18} className="ml-auto text-slate-400"/>
              </button>
            </div>
          )}

          {/* ── Eksport: shfaq QR ── */}
          {mode === 'export' && (
            <div className="space-y-4">
              {isGenerating ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Loader2 size={36} className="animate-spin text-indigo-600"/>
                  <p className="text-[11px] font-black text-slate-400 uppercase">Po kompresoj të dhënat...</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-3">
                    {qrDataUrl && (
                      <div className="border-4 border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                        <img src={qrDataUrl} alt="QR Code" className="w-64 h-64"/>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">
                        {currentChunk + 1} / {chunks.length}
                      </span>
                      {chunks.length > 1 && (
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Auto ↻ {CHUNK_INTERVAL/1000}s</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    {chunks.length > 1 && (
                      <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${((currentChunk + 1) / chunks.length) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Udhëzime</p>
                    <ul className="text-[10px] text-amber-600 font-bold space-y-1">
                      <li>1. Hap aplikacionin në pajisjen mobile</li>
                      <li>2. Shko te Cilësimet → QR Sinkronizim → Skano QR</li>
                      {chunks.length > 1 && <li>3. Skano të gjithë {chunks.length} QR kodet radhazi</li>}
                      {chunks.length === 1 && <li>3. Skano QR kodin</li>}
                      <li>4. Të dhënat do transferohen automatikisht</li>
                    </ul>
                  </div>

                  {chunks.length > 1 && (
                    <button
                      onClick={() => setCurrentChunk(c => (c + 1) % chunks.length)}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-all"
                    >
                      <RefreshCw size={14}/> Tjetri Manual
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Import: skano QR ── */}
          {mode === 'import' && (
            <div className="space-y-4">
              {importDone ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <div className="bg-emerald-100 p-4 rounded-full">
                    <CheckCircle2 size={40} className="text-emerald-600"/>
                  </div>
                  <p className="text-sm font-black text-emerald-700 uppercase">Importimi u krye!</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Po rifreskon aplikacionin...</p>
                </div>
              ) : importError ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="bg-rose-100 p-4 rounded-full">
                    <AlertCircle size={40} className="text-rose-600"/>
                  </div>
                  <p className="text-sm font-black text-rose-700 uppercase text-center">{importError}</p>
                  <button
                    onClick={() => { setImportError(''); setScannedChunks({}); setTotalChunks(null); lastScannedRef.current = ''; startCamera(); }}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all"
                  >
                    Provo Sërish
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900" style={{ height: 240 }}>
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover"/>
                    <canvas ref={canvasRef} className="hidden"/>
                    {/* Vizier */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-44 h-44 border-4 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"/>
                    </div>
                    {!scanning && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 size={32} className="text-white animate-spin"/>
                      </div>
                    )}
                  </div>

                  {/* Progres skanimi */}
                  {totalChunks && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-600 uppercase">Progres</span>
                        <span className="text-[10px] font-black text-indigo-600">{scannedCount} / {totalChunks} QR</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: totalChunks }, (_, i) => (
                          <div
                            key={i}
                            className={`w-5 h-5 rounded text-[8px] font-black flex items-center justify-center ${scannedChunks[i] ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!totalChunks && scanning && (
                    <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                      Duke skanuar... drejto kamerën te QR kodi
                    </p>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button onClick={() => { stopCamera(); onClose(); }} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
            Mbyll
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRSyncModal;
