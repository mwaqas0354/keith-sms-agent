// In dev, Vite proxies /keith-api to localhost:8000 (see vite.config.ts).
// In production there's no dev proxy, so VITE_KEITH_API_URL must point
// directly at Keith's deployed URL (e.g. https://keith-pdf-backend.onrender.com).
const KEITH_BASE = import.meta.env.VITE_KEITH_API_URL
  ? `${import.meta.env.VITE_KEITH_API_URL}/api`
  : '/keith-api';

export type CompressionPreset = 'light' | 'balanced' | 'aggressive' | 'maximum';

export interface CompressResult {
  job_id: string;
  status: string;
  original_filename: string;
  original_bytes: number;
  compressed_bytes: number;
  reduction_percent: number;
  size_multiplier: number;
  page_count: number;
  method: string;
  preset: string;
  created_at: string;
  download_url: string;
}

export const keithApi = {
  health: async (): Promise<{ status: string; ghostscript_available: boolean }> => {
    const res = await fetch(`${KEITH_BASE}/health`);
    if (!res.ok) throw new Error('Keith is offline');
    return res.json();
  },

  compress: async (file: File, preset: CompressionPreset): Promise<CompressResult> => {
    const form = new FormData();
    form.append('file', file);
    form.append('preset', preset);
    const res = await fetch(`${KEITH_BASE}/compress`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Compression failed');
    return data;
  },

  downloadUrl: (jobId: string) => `${KEITH_BASE}/download/${jobId}`,

  batchDownload: async (jobIds: string[]): Promise<Blob> => {
    const res = await fetch(`${KEITH_BASE}/batch-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobIds),
    });
    if (!res.ok) throw new Error('Batch download failed');
    return res.blob();
  },
};
