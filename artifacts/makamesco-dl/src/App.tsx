import { useState, useEffect } from 'react';
import { Download, Search, Music, RefreshCcw, ArrowLeft, Video, Headphones, AlertCircle, X } from 'lucide-react';
import axios from 'axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStr(v: unknown): string { return typeof v === 'string' && v.length > 0 ? v : ''; }
function safeArr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function o(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Race an array of async factories — resolve with the first non-null value. */
function raceFirst<T>(fns: Array<() => Promise<T | null>>): Promise<T | null> {
  return new Promise(resolve => {
    if (fns.length === 0) { resolve(null); return; }
    let pending = fns.length;
    for (const fn of fns) {
      fn()
        .then(v => { if (v !== null) resolve(v); else if (--pending === 0) resolve(null); })
        .catch(() => { if (--pending === 0) resolve(null); });
    }
  });
}

/** Build a proxied download URL so the browser saves the file instead of opening it. */
function dlUrl(mediaUrl: string, filename: string): string {
  return `/api/dl?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DownloadResult {
  title: string;
  thumbnail: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

// ─── BK9 response parser (shared) ─────────────────────────────────────────────

function parseBk9(platform: string, raw: unknown): DownloadResult | null {
  if (platform === 'youtube' || platform === 'ytaudio') {
    if (Array.isArray(raw)) return null;
    const b = o(raw);
    if (platform === 'ytaudio') {
      const audioUrl = safeStr(b.BK9) || safeStr(b.url) || safeStr(b.mp3) || null;
      if (!audioUrl) return null;
      return { title: safeStr(b.title) || 'Audio', thumbnail: safeStr(b.thumbnail), videoUrl: null, audioUrl };
    }
    const formats = safeArr(b.formats).map(o);
    const videoFmt = formats.find(f => f.has_video && f.has_audio) ?? formats.find(f => f.has_video);
    const audioFmt = formats.find(f => !f.has_video && f.has_audio);
    const videoUrl = safeStr(videoFmt?.url) || null;
    const audioUrl = safeStr(audioFmt?.url) || null;
    if (!videoUrl && !audioUrl) return null;
    return { title: safeStr(b.title) || 'YouTube Video', thumbnail: safeStr(b.thumbnail), videoUrl, audioUrl };
  }

  if (platform === 'tiktok') {
    if (Array.isArray(raw)) return null;
    const b = o(raw);
    const videoUrl = safeStr(b.BK9) || safeStr(b.url) || null;
    if (!videoUrl) return null;
    return {
      title: safeStr(b.desc) || safeStr(o(b.music_info).title) || 'TikTok Video',
      thumbnail: safeStr(b.thumb) || safeStr(b.thumbnail),
      videoUrl, audioUrl: null,
    };
  }

  if (platform === 'twitter') {
    if (Array.isArray(raw)) return null;
    const b = o(raw);
    const videoUrl = safeStr(b.HD) || safeStr(b.SD) || safeStr(b.url) || safeStr(b.BK9) || null;
    if (!videoUrl) return null;
    return { title: safeStr(b.caption) || safeStr(b.desc) || 'X / Twitter Video', thumbnail: safeStr(b.thumbnail) || safeStr(b.thumb), videoUrl, audioUrl: null };
  }

  if (platform === 'instagram') {
    if (Array.isArray(raw)) {
      const items = raw.map(o);
      const videoItem = items.find(it => it.type === 'unknown' || it.type === 'video');
      const videoUrl = safeStr(videoItem?.url) || safeStr(items[0]?.url) || null;
      if (!videoUrl) return null;
      return { title: 'Instagram Video', thumbnail: '', videoUrl, audioUrl: null };
    }
    const b = o(raw);
    const videoUrl = safeStr(b.url) || safeStr(b.BK9) || safeStr(b.video) || null;
    if (!videoUrl) return null;
    return { title: safeStr(b.title) || 'Instagram Video', thumbnail: safeStr(b.thumbnail), videoUrl, audioUrl: null };
  }

  if (platform === 'facebook') {
    if (Array.isArray(raw)) {
      const items = raw.map(o);
      const videoUrl = safeStr(items.find(it => it.type === 'unknown' || it.type === 'video')?.url) || safeStr(items[0]?.url) || null;
      if (!videoUrl) return null;
      return { title: 'Facebook Video', thumbnail: '', videoUrl, audioUrl: null };
    }
    const b = o(raw);
    if (Array.isArray(b.formats)) {
      const formats = safeArr(b.formats).map(o);
      const videoFmt = formats.find(f => f.has_video && f.has_audio) ?? formats.find(f => f.has_video);
      const audioFmt = formats.find(f => !f.has_video && f.has_audio);
      const videoUrl = safeStr(videoFmt?.url) || null;
      const audioUrl = safeStr(audioFmt?.url) || null;
      if (!videoUrl && !audioUrl) return null;
      return { title: safeStr(b.title) || 'Facebook Video', thumbnail: safeStr(b.thumbnail) || safeStr(b.thumb), videoUrl, audioUrl };
    }
    const videoUrl = safeStr(b.hd) || safeStr(b.sd) || safeStr(b.BK9) || safeStr(b.url) || null;
    if (!videoUrl) return null;
    return { title: safeStr(b.title) || 'Facebook Video', thumbnail: safeStr(b.thumbnail) || safeStr(b.thumb), videoUrl, audioUrl: null };
  }

  return null;
}

// ─── BK9 API (primary) ────────────────────────────────────────────────────────

async function bk9Download(platform: string, url: string): Promise<DownloadResult | null> {
  const endpointMap: Record<string, string[]> = {
    tiktok:    ['/download/tiktok', '/download/tiktok2', '/download/tiktok3'],
    youtube:   ['/download/youtube'],
    ytaudio:   ['/download/ytmp3'],
    instagram: ['/download/instagram', '/download/instagram2'],
    // fb3 first — most reliable for share URLs
    facebook:  ['/download/fb3', '/download/fb', '/download/fb2'],
    twitter:   ['/download/twitter', '/download/twitter-2'],
  };

  const endpoints = endpointMap[platform] ?? [];

  // Race all endpoints in parallel — return whichever succeeds first
  return raceFirst(endpoints.map(ep => async () => {
    try {
      const extra = platform === 'ytaudio' ? '&type=mp3' : '';
      const res = await axios.get(
        `https://api.bk9.dev${ep}?url=${encodeURIComponent(url)}${extra}`,
        { timeout: 10000 }
      );
      const d = o(res.data);
      if (!d.status) return null;
      return parseBk9(platform, d.BK9);
    } catch {
      return null;
    }
  }));
}

// ─── KeithAPI (fallback for Twitter only) ─────────────────────────────────────

async function keithDownload(_platform: string, url: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      `https://apiskeith.top/download/twitter?url=${encodeURIComponent(url)}`,
      { timeout: 10000 }
    );
    const d = o(res.data);
    if (!d.status) return null;
    const r = o(d.result);
    const videoUrl = safeStr(r.video_hd) || safeStr(r.video_sd) || null;
    const audioUrl = safeStr(r.audio) || null;
    if (!videoUrl && !audioUrl) return null;
    return { title: safeStr(r.desc) || 'X / Twitter Video', thumbnail: safeStr(r.thumb) || safeStr(r.thumbnail), videoUrl, audioUrl };
  } catch {
    return null;
  }
}

// ─── XWolf API (fallback for TikTok only) ────────────────────────────────────

async function xwolfDownload(_platform: string, url: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      `https://apis.xwolf.space/api/downloader/tiktok?url=${encodeURIComponent(url)}`,
      { timeout: 10000 }
    );
    const d = o(res.data);
    if (!d.success) return null;
    const videoUrl = safeStr(d.videoUrlNoWatermark) || safeStr(d.videoUrl) || null;
    if (!videoUrl) return null;
    return { title: safeStr(d.title) || 'TikTok Video', thumbnail: safeStr(d.thumbnail) || safeStr(d.cover) || '', videoUrl, audioUrl: null };
  } catch {
    return null;
  }
}

// ─── Main download orchestrator ───────────────────────────────────────────────
// Twitter + TikTok: race primary & fallback simultaneously for speed

async function fetchDownload(platform: string, url: string): Promise<DownloadResult | null> {
  if (platform === 'twitter') {
    return raceFirst([
      () => bk9Download(platform, url),
      () => keithDownload(platform, url),
    ]);
  }
  if (platform === 'tiktok') {
    return raceFirst([
      () => bk9Download(platform, url),
      () => xwolfDownload(platform, url),
    ]);
  }
  return bk9Download(platform, url);
}

// ─── YouTube Search ───────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  thumbnail: string;
  url: string;
  duration?: string;
  channel?: string;
}

async function searchYouTube(query: string): Promise<SearchResult[]> {
  try {
    const res = await axios.get(
      `/api/ytsearch?query=${encodeURIComponent(query)}`,
      { timeout: 16000 }
    );
    const raw = res.data;
    if (!raw) return [];

    const list: unknown[] =
      Array.isArray(raw.results) ? raw.results :
      Array.isArray(raw.result)  ? raw.result :
      Array.isArray(raw.data)    ? raw.data :
      Array.isArray(raw)         ? raw : [];

    return list.map((item) => {
      const it = o(item);
      const videoId = safeStr(it.videoId);
      return {
        title: safeStr(it.title),
        thumbnail: safeStr(it.thumbnail) || safeStr(it.thumb) || safeStr(it.image),
        url: safeStr(it.url) || safeStr(it.link) || (videoId ? `https://youtu.be/${videoId}` : ''),
        duration: safeStr(it.duration),
        channel: safeStr(it.author) || safeStr(it.channel),
      };
    }).filter(r => r.title && r.url);
  } catch {
    return [];
  }
}

// ─── Platform Config ──────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const PLATFORMS: Platform[] = [
  { id: 'tiktok',    name: 'TikTok',      icon: '📱', color: 'from-pink-600 to-rose-700' },
  { id: 'youtube',   name: 'YouTube',     icon: '📺', color: 'from-red-600 to-red-800' },
  { id: 'instagram', name: 'Instagram',   icon: '📸', color: 'from-purple-600 via-pink-600 to-orange-500' },
  { id: 'facebook',  name: 'Facebook',    icon: '👥', color: 'from-blue-700 to-blue-900' },
  { id: 'twitter',   name: 'X / Twitter', icon: '🐦', color: 'from-gray-800 to-black' },
];

// ─── App ──────────────────────────────────────────────────────────────────────

type View = 'home' | 'input' | 'search';

// ─── PWA Install Prompt ───────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-[#0f1420] border border-cyan-500/40 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-black font-black text-lg">
          M
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-white uppercase tracking-wide">Install App</p>
          <p className="text-slate-400 text-[11px] mt-0.5">Add MAKAMESCO DL to your home screen for quick access</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={install}
            className="bg-cyan-500 text-black font-black text-xs px-4 py-2 rounded-xl hover:bg-cyan-400 transition-colors uppercase"
          >
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]                 = useState<View>('home');
  const [platform, setPlatform]         = useState<Platform | null>(null);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<DownloadResult | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError]               = useState('');
  const [activeSearchItem, setActiveSearchItem] = useState<DownloadResult | null>(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [itemLoading, setItemLoading]   = useState<number | null>(null);

  function reset() {
    setResult(null);
    setInput('');
    setSearchResults([]);
    setError('');
    setActiveSearchItem(null);
    setActiveSearchIndex(null);
  }

  async function handleDownload(type: string, url: string) {
    if (!url.trim()) { setError('Please paste a valid link.'); return; }
    setLoading(true);
    setResult(null);
    setError('');
    const res = await fetchDownload(type, url.trim());
    if (res) {
      setResult(res);
    } else {
      setError('Could not fetch download links. The video may be private, or all servers timed out. Try again.');
    }
    setLoading(false);
  }

  async function handleSearch() {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setSearchResults([]);
    setError('');
    setActiveSearchItem(null);
    setActiveSearchIndex(null);
    const results = await searchYouTube(q);
    if (results.length > 0) {
      setSearchResults(results);
    } else {
      setError('No results found. Try different keywords.');
    }
    setLoading(false);
  }

  async function handleSearchItemDownload(item: SearchResult, mode: 'video' | 'audio', index: number) {
    setItemLoading(index);
    setActiveSearchItem(null);
    setActiveSearchIndex(null);
    const type = mode === 'audio' ? 'ytaudio' : 'youtube';
    const res = await fetchDownload(type, item.url);
    if (res) {
      setActiveSearchItem(mode === 'audio' ? { ...res, videoUrl: null } : res);
      setActiveSearchIndex(index);
    } else {
      setError('Could not get download link. Try again.');
    }
    setItemLoading(null);
  }

  const isSearch = view === 'search';
  const isYouTube = view === 'input' && platform?.id === 'youtube';

  function handleAction() {
    if (isSearch) {
      if (input.includes('youtube.com') || input.includes('youtu.be')) {
        handleDownload('youtube', input);
      } else {
        handleSearch();
      }
    } else {
      handleDownload(platform!.id, input);
    }
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-white p-4 sm:p-8 font-sans">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          MAKAMESCO DL
        </h1>
        <div className="flex justify-center items-center gap-2 mt-2">
          <span className="h-[1px] w-10 bg-slate-800" />
          <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase">Powered by Spicetech</p>
          <span className="h-[1px] w-10 bg-slate-800" />
        </div>
      </div>

      {/* Home Grid */}
      {view === 'home' && (
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-6">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPlatform(p); setView('input'); reset(); }}
              className={`bg-gradient-to-br ${p.color} p-8 rounded-[2.5rem] shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center group active:scale-95`}
            >
              <span className="text-5xl mb-3 group-hover:scale-110 transition-transform">{p.icon}</span>
              <span className="font-black text-sm uppercase tracking-widest">{p.name}</span>
            </button>
          ))}
          <button
            onClick={() => { setView('search'); reset(); }}
            className="bg-slate-900/40 border-2 border-dashed border-slate-700 p-8 rounded-[2.5rem] hover:bg-slate-800 transition-all flex flex-col items-center group active:scale-95"
          >
            <Music className="mb-3 text-cyan-400 group-hover:rotate-12 transition-transform" size={40} />
            <span className="font-black text-sm uppercase text-cyan-400">Music / Search</span>
          </button>
        </div>
      )}

      {/* Input / Search Panel */}
      {view !== 'home' && (
        <div className="max-w-xl mx-auto">
          <div className="bg-[#0f1420] border border-slate-800/50 p-8 rounded-[3rem] shadow-2xl">
            {/* Back */}
            <button
              onClick={() => { setView('home'); reset(); }}
              className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Back to Hub</span>
            </button>

            <h2 className="text-3xl font-black mb-6 uppercase italic flex items-center gap-3">
              {isSearch ? <Search className="text-cyan-400" /> : platform?.icon}
              {isSearch ? 'Music / Search' : platform?.name}
            </h2>

            {/* Input bar */}
            <div className="relative">
              <input
                type="text"
                placeholder={
                  isSearch
                    ? 'Song name, artist, or YouTube URL...'
                    : `Paste ${platform?.name} link...`
                }
                className="w-full bg-[#161d2f] border-2 border-slate-700 p-5 rounded-2xl outline-none focus:border-cyan-500 text-base transition-all pr-20"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAction()}
              />
              <button
                onClick={handleAction}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 bottom-2 bg-cyan-500 px-6 rounded-xl hover:bg-cyan-400 disabled:opacity-20 transition-all shadow-lg text-black font-bold"
              >
                {loading
                  ? <RefreshCcw className="animate-spin" size={20} />
                  : (isSearch ? <Search size={20} /> : <Download size={20} />)
                }
              </button>
            </div>

            {/* Hints */}
            {isSearch && (
              <p className="text-slate-600 text-[11px] mt-2 ml-1">
                Paste a YouTube link to download directly, or type a song/artist name to search.
              </p>
            )}
            {isYouTube && (
              <p className="text-slate-600 text-[11px] mt-2 ml-1">
                Supports youtube.com and youtu.be short links.
              </p>
            )}

            {/* Error */}
            {error && (
              <div className="mt-5 flex items-start gap-3 bg-red-950/40 border border-red-800/50 rounded-2xl p-4">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Download result */}
            {result && <ResultCard result={result} />}

            {/* Search results list */}
            {isSearch && searchResults.length > 0 && (
              <div className="mt-8 space-y-3 overflow-y-auto max-h-[520px] pr-1">
                {searchResults.map((video, i) => (
                  <div key={i}>
                    <div className="flex gap-4 p-3 bg-[#161d2f] rounded-2xl items-center border border-slate-700/50 hover:border-cyan-500/30 transition-all group">
                      <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-slate-800">
                        {video.thumbnail && (
                          <img
                            src={video.thumbnail}
                            className="w-full h-full object-cover"
                            alt=""
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] leading-tight line-clamp-2 group-hover:text-cyan-400 transition-colors">
                          {video.title}
                        </p>
                        {video.channel && (
                          <p className="text-slate-500 text-[11px] mt-0.5 truncate">{video.channel}</p>
                        )}
                        {video.duration && (
                          <p className="text-slate-600 text-[10px] mt-0.5">{video.duration}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSearchItemDownload(video, 'video', i)}
                            disabled={itemLoading === i}
                            className="flex items-center gap-1 text-[10px] bg-cyan-500 text-black font-black px-3 py-1.5 rounded-md uppercase disabled:opacity-50 hover:bg-cyan-400 transition-colors"
                          >
                            {itemLoading === i
                              ? <RefreshCcw size={10} className="animate-spin" />
                              : <Video size={10} />
                            } Video
                          </button>
                          <button
                            onClick={() => handleSearchItemDownload(video, 'audio', i)}
                            disabled={itemLoading === i}
                            className="flex items-center gap-1 text-[10px] bg-slate-700 text-white font-black px-3 py-1.5 rounded-md uppercase disabled:opacity-50 hover:bg-slate-600 transition-colors"
                          >
                            {itemLoading === i
                              ? <RefreshCcw size={10} className="animate-spin" />
                              : <Headphones size={10} />
                            } Audio
                          </button>
                        </div>
                      </div>
                    </div>
                    {activeSearchIndex === i && activeSearchItem && (
                      <div className="mt-2 ml-2">
                        <ResultCard result={activeSearchItem} compact />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="mt-20 pb-10 text-center">
        <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.5em]">
          &copy; 2026 MAKAMESCO &bull; SPICETECH &bull; KENYA
        </p>
      </footer>

      <InstallBanner />
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result, compact = false }: { result: DownloadResult; compact?: boolean }) {
  const hasLinks = result.videoUrl || result.audioUrl;

  function ext(url: string, type: 'video' | 'audio') {
    if (type === 'audio') return 'mp3';
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.webm')) return 'webm';
    return 'mp4';
  }

  function filename(type: 'video' | 'audio', url: string) {
    const base = result.title
      ? result.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 60) || 'download'
      : 'download';
    return `${base}.${ext(url, type)}`;
  }

  return (
    <div className={`${compact ? 'mt-2' : 'mt-8'} bg-[#161d2f] rounded-3xl overflow-hidden border border-slate-700 shadow-2xl`}>
      {!compact && result.thumbnail && (
        <img
          src={result.thumbnail}
          className="w-full aspect-video object-cover"
          alt="Media thumbnail"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="p-5">
        {result.title && (
          <p className="font-bold text-sm mb-4 line-clamp-2 text-slate-200">{result.title}</p>
        )}
        {hasLinks ? (
          <div className="flex flex-col gap-2">
            {result.videoUrl && (
              <a
                href={dlUrl(result.videoUrl, filename('video', result.videoUrl))}
                download={filename('video', result.videoUrl)}
                className="w-full bg-cyan-500 text-black py-4 rounded-xl text-center font-black uppercase text-xs hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
              >
                <Video size={14} /> Download Video
              </a>
            )}
            {result.audioUrl && (
              <a
                href={dlUrl(result.audioUrl, filename('audio', result.audioUrl))}
                download={filename('audio', result.audioUrl)}
                className="w-full bg-slate-700 text-white py-4 rounded-xl text-center font-black uppercase text-xs hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <Headphones size={14} /> Download Audio
              </a>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-xs text-center py-2">No download links found for this media.</p>
        )}
      </div>
    </div>
  );
}
