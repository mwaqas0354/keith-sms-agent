import { useEffect, useRef, useState } from 'react';
import {
  UploadCloud, X, Download, Plus, Archive, Radio,
} from 'lucide-react';
import { keithApi, CompressionPreset, CompressResult } from '../keithApi';
import './PdfCompressor.css';

const MAX_FILES = 15;

const PRESETS: { value: CompressionPreset; name: string; desc: string; use: string; detail: string }[] = [
  {
    value: 'light',
    name: 'Light',
    desc: '200 DPI · 85%',
    use: 'Minimal loss',
    detail: 'Images stay crisp and print-ready. Best if you still need to share high quality files. Expect 30–50% size reduction.',
  },
  {
    value: 'balanced',
    name: 'Balanced',
    desc: '150 DPI · 75%',
    use: 'Recommended',
    detail: 'The sweet spot. Looks sharp on screen and in email. Typically cuts flattened PDFs by 60–75% with no visible loss.',
  },
  {
    value: 'aggressive',
    name: 'Aggressive',
    desc: '120 DPI · 60%',
    use: 'Big wins',
    detail: 'Slight softness on close inspection, but files shrink dramatically. Great for web uploads or email attachments.',
  },
  {
    value: 'maximum',
    name: 'Maximum',
    desc: '96 DPI · 45%',
    use: 'Smallest file',
    detail: 'Smallest possible output. Images will look soft — use for quick previews or when file size is the only priority.',
  },
];

const INFO_CARDS = [
  {
    icon: '💥',
    title: 'Why files explode',
    body: 'Flattening merges layers into full-page bitmaps. Aqua and CMYK conversions add high-res image data. A 300 KB vector file can become 7+ MB overnight.',
  },
  {
    icon: '⚡',
    title: 'What Keith does',
    body: 'Re-encodes embedded images at your target DPI, strips duplicates with pikepdf, and runs Ghostscript when available for maximum compression savings.',
  },
  {
    icon: '🚀',
    title: 'Next phase',
    body: 'AWS S3 storage, async batch processing, and authenticated multi-file jobs — all coming in the next version of Keith.',
  },
];

interface QueueEntry {
  id: string;
  file: File;
  status: 'pending' | 'compressing' | 'done' | 'error';
  jobId?: string;
  result?: CompressResult;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0))} ${sizes[i]}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function PdfCompressor() {
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [ghostscript, setGhostscript] = useState(false);
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    keithApi.health()
      .then((h) => { setHealth('online'); setGhostscript(h.ghostscript_available); })
      .catch(() => setHealth('offline'));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const pdfs = incoming.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const nonPdfCount = incoming.length - pdfs.length;

    if (nonPdfCount > 0) setToast({ text: `${nonPdfCount} non-PDF file(s) skipped`, type: 'error' });

    const remaining = MAX_FILES - queue.length;
    if (pdfs.length > remaining) setToast({ text: `Max ${MAX_FILES} files. Only added first ${remaining}.`, type: 'error' });

    const toAdd = pdfs.slice(0, remaining);
    setQueue((q) => [...q, ...toAdd.map((file) => ({ id: uid(), file, status: 'pending' as const }))]);
  };

  const removeFile = (id: string) => setQueue((q) => q.filter((e) => e.id !== id));
  const clearAll = () => setQueue([]);

  const compressAll = async () => {
    const pending = queue.filter((e) => e.status === 'pending');
    if (pending.length === 0) return;

    setCompressing(true);
    setQueue((q) => q.map((e) => (e.status === 'pending' ? { ...e, status: 'compressing' } : e)));

    await Promise.all(
      pending.map(async (entry) => {
        try {
          const result = await keithApi.compress(entry.file, preset);
          setQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, status: 'done', jobId: result.job_id, result } : e)));
        } catch (err) {
          setQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, status: 'error', error: err instanceof Error ? err.message : 'Failed' } : e)));
        }
      })
    );

    setCompressing(false);
    setToast({ text: `${pending.length} file${pending.length !== 1 ? 's' : ''} compressed successfully!`, type: 'success' });
  };

  const downloadOne = (jobId: string, originalName: string) => {
    const a = document.createElement('a');
    a.href = keithApi.downloadUrl(jobId);
    a.download = originalName.replace(/\.pdf$/i, '') + '_compressed.pdf';
    a.click();
  };

  const downloadAll = async () => {
    const jobIds = queue.filter((e) => e.status === 'done' && e.jobId).map((e) => e.jobId!) as string[];
    if (jobIds.length === 0) return;
    try {
      const blob = await keithApi.batchDownload(jobIds);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'keith_compressed.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ text: 'Batch download failed', type: 'error' });
    }
  };

  const done = queue.filter((e) => e.status === 'done');
  const failed = queue.filter((e) => e.status === 'error');
  const pendingCount = queue.filter((e) => e.status === 'pending').length;
  const totalBytes = queue.reduce((s, e) => s + e.file.size, 0);
  const totalOriginal = done.reduce((s, e) => s + (e.result?.original_bytes ?? 0), 0);
  const totalCompressed = done.reduce((s, e) => s + (e.result?.compressed_bytes ?? 0), 0);
  const overallPct = totalOriginal > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0;

  return (
    <div className="keith-page space-y-4 max-w-4xl">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-luxury-900">PDF Compressor</h3>
          <p className="text-sm text-luxury-500">Powered by Keith — drop up to {MAX_FILES} PDFs, compress, and download</p>
        </div>
        <span className={`keith-status-pill ${health}`}>
          <Radio className="w-3 h-3" />
          {health === 'checking' ? 'Checking…' : health === 'online' ? `Online${ghostscript ? ' · GS ready' : ''}` : 'Offline'}
        </span>
      </div>

      <div className="card p-5 space-y-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
          className={`keith-upload-zone ${dragOver ? 'dragover' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="keith-upload-icon">
            <UploadCloud className="w-full h-full" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-luxury-800">Drop your PDFs here</p>
          <p className="text-sm text-luxury-500 mt-0.5">
            or{' '}
            <button
              type="button"
              className="keith-link-btn"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              browse files
            </button>
          </p>
          <p className="text-xs text-luxury-400 mt-2">PDF only · Max {MAX_FILES} files · 100 MB each</p>
        </div>

        {queue.length > 0 && (
          <div className="keith-file-queue">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="flex items-center gap-2">
                <span className="keith-queue-count">{queue.length} file{queue.length !== 1 ? 's' : ''}</span>
                <span className="keith-queue-size">· {formatBytes(totalBytes)} total</span>
              </div>
              <button className="keith-clear-all-btn" onClick={clearAll}>Clear all</button>
            </div>

            <div className="keith-queue-list">
              {queue.map((entry) => (
                <div key={entry.id} className={`keith-queue-item ${entry.status}`}>
                  <div className="keith-qi-icon">
                    {entry.status === 'done' ? '✓' : entry.status === 'error' ? '✕' : 'PDF'}
                  </div>
                  <div className="keith-qi-info">
                    <div className="keith-qi-name">{entry.file.name}</div>
                    <div className="keith-qi-meta">
                      {entry.result ? (
                        <>
                          <span>{formatBytes(entry.result.original_bytes)}</span>
                          <span className="text-luxury-400">→</span>
                          <span style={{ color: '#047857' }}>{formatBytes(entry.result.compressed_bytes)}</span>
                        </>
                      ) : (
                        <span>{formatBytes(entry.file.size)}</span>
                      )}
                    </div>
                  </div>

                  {entry.status === 'pending' && <span className="keith-qi-status pending">Queued</span>}
                  {entry.status === 'compressing' && (
                    <span className="keith-qi-status compressing"><span className="keith-qi-spinner" /> Compressing…</span>
                  )}
                  {entry.status === 'done' && entry.result && (
                    <span className="keith-qi-status done">−{entry.result.reduction_percent}%</span>
                  )}
                  {entry.status === 'error' && <span className="keith-qi-status error">Failed</span>}

                  {entry.status === 'done' && entry.jobId && (
                    <button className="keith-qi-download" title="Download compressed file" onClick={() => downloadOne(entry.jobId!, entry.file.name)}>
                      <Download />
                    </button>
                  )}
                  {entry.status === 'pending' && (
                    <button className="keith-qi-delete" title="Remove" onClick={() => removeFile(entry.id)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" className="keith-add-more-btn" onClick={() => fileInputRef.current?.click()}>
              <Plus className="w-3.5 h-3.5" /> Add more files
            </button>
          </div>
        )}

        <div>
          <label className="text-xs uppercase tracking-wider text-luxury-400 font-semibold">Compression preset</label>
          <div className="keith-preset-grid mt-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`keith-preset-card ${preset === p.value ? 'active' : ''}`}
                onClick={() => setPreset(p.value)}
              >
                <span className="keith-preset-name">{p.name}</span>
                <span className="keith-preset-desc">{p.desc}</span>
                <span className="keith-preset-use">{p.use}</span>
                <span className="keith-preset-detail">{p.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn-primary keith-compress-btn flex items-center justify-center gap-2"
          disabled={pendingCount === 0 || compressing}
          onClick={compressAll}
        >
          {compressing ? <span className="keith-btn-spinner" /> : <UploadCloud className="w-4 h-4" />}
          {compressing ? 'Compressing…' : pendingCount === 0 ? 'Compress Files' : `Compress ${pendingCount} File${pendingCount !== 1 ? 's' : ''}`}
        </button>
      </div>

      {(done.length > 0 || failed.length > 0) && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-luxury-400 font-semibold">Compression complete</p>
              <p className="text-sm font-medium text-luxury-900">
                {done.length > 0 ? (
                  <>{formatBytes(totalOriginal)} → <span style={{ color: '#047857' }}>{formatBytes(totalCompressed)}</span> · {overallPct}% smaller</>
                ) : (
                  `${failed.length} file(s) failed`
                )}
              </p>
            </div>
            {done.length > 1 && (
              <button onClick={downloadAll} className="btn-secondary text-sm flex items-center gap-2">
                <Archive className="w-4 h-4" /> Download All ZIP
              </button>
            )}
          </div>

          <div className="keith-results-list">
            {queue.filter((e) => e.status === 'done' || e.status === 'error').map((entry) => (
              <div key={entry.id} className={`keith-result-row ${entry.status === 'error' ? 'error' : ''}`}>
                <div className="keith-rr-icon">{entry.status === 'done' ? 'PDF' : '!'}</div>
                <div className="keith-rr-info">
                  <div className="keith-rr-name">{entry.file.name}</div>
                  {entry.status === 'done' && entry.result ? (
                    <div className="keith-rr-sizes">
                      <span>{formatBytes(entry.result.original_bytes)}</span>
                      <span className="keith-rr-arrow">→</span>
                      <span className="keith-rr-after">{formatBytes(entry.result.compressed_bytes)}</span>
                      <span className="text-luxury-400">· {entry.result.page_count} page{entry.result.page_count !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div className="keith-rr-sizes" style={{ color: 'var(--danger)' }}>{entry.error || 'Compression failed'}</div>
                  )}
                </div>
                {entry.status === 'done' && entry.result ? (
                  <>
                    <span className="keith-rr-badge">−{entry.result.reduction_percent}%</span>
                    <button className="keith-rr-dl" title="Download" onClick={() => downloadOne(entry.jobId!, entry.file.name)}>
                      <Download />
                    </button>
                  </>
                ) : (
                  <span className="keith-rr-badge">Error</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="keith-info-grid">
        {INFO_CARDS.map((card) => (
          <article key={card.title} className="card keith-info-card p-5">
            <span className="keith-info-card-icon">{card.icon}</span>
            <h4 className="text-sm font-semibold text-luxury-900 mb-1.5">{card.title}</h4>
            <p className="text-sm text-luxury-500 leading-relaxed">{card.body}</p>
          </article>
        ))}
      </div>

      {toast && (
        <div className={`keith-toast ${toast.type}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
