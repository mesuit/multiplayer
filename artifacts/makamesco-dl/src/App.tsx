import { useState } from 'react';
import { Download, Search, Music, RefreshCcw, ArrowLeft, Video, Headphones, AlertCircle } from 'lucide-react';
import axios from 'axios';

// ─── API Definitions ──────────────────────────────────────────────────────────
// Each API has its own base URL, endpoint map, and response normalizer.
// They are tried in order; first success wins.

interface NormalizedResult {
  title: string;
  thumbnail: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

interface ApiDef {
  base: string;
  endpoints: (type: string) => string[];
  paramKey?: string; // default 'url'
  normalize: (data: unknown, type: string) => NormalizedResult | null;
}

function safeStr(v: unknown): string { return typeof v === 'string' ? v : ''; }
function safeArr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function obj(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, unknown> : {};
}

// BK9 API — https://api.bk9.dev
const bk9Api: ApiDef = {
  base: 'https://api.bk9.dev',
  endpoints: (type) => ({
    tiktok:   ['/download/tiktok', '/download/tiktok2', '/download/tiktok3'],
    youtube:  ['/download/youtube'],
    ytaudio:  ['/download/ytmp3'],
    instagram:['/download/instagram', '/download/instagram2'],
    facebook: ['/download/fb', '/download/fb2', '/download/fb3'],
    twitter:  ['/download/twitter', '/download/twitter-2'],
  }[type] ?? []),
  normalize: (data, type) => {
    const d = obj(data);
    if (!d.status || !d.BK9) return null;
    const b = obj(d.BK9);

    if (type === 'youtube') {
      // YouTube: BK9 returns a formats array
      const formats = safeArr(b.formats).map(obj);
      const videoFmt = formats.find(f => f.has_video && f.has_audio) ??
                       formats.find(f => f.has_video);
      const audioFmt = formats.find(f => !f.has_video && f.has_audio);
      if (!videoFmt && !audioFmt) return null;
      return {
        title: safeStr(b.title) || 'YouTube Video',
        thumbnail: safeStr(b.thumbnail),
        videoUrl: safeStr(videoFmt?.url) || null,
        audioUrl: safeStr(audioFmt?.url) || null,
      };
    }

    if (type === 'ytaudio') {
      // ytmp3 endpoint — BK9 field may be the direct audio URL
      const audioUrl = safeStr(b.BK9) || safeStr(b.url) || safeStr(b.mp3) || null;
      return audioUrl ? {
        title: safeStr(b.title) || 'Audio',
        thumbnail: safeStr(b.thumbnail),
        videoUrl: null,
        audioUrl,
      } : null;
    }

    if (type === 'tiktok') {
      return {
        title: safeStr(b.desc) || safeStr(b.title) || 'TikTok Video',
        thumbnail: safeStr(b.thumb) || safeStr(b.thumbnail),
        videoUrl: safeStr(b.BK9) || safeStr(b.url) || null,
        audioUrl: safeStr(b.music) || safeStr(b.audio) || null,
      };
    }

    // Generic (instagram, facebook, twitter)
    const videoUrl =
      safeStr(b.BK9) || safeStr(b.url) || safeStr(b.link) ||
      safeStr(b.video) || safeStr(b.hd) || safeStr(b.sd) || null;
    const audioUrl = safeStr(b.mp3) || safeStr(b.audio) || safeStr(b.music) || null;
    if (!videoUrl && !audioUrl) return null;
    return {
      title: safeStr(b.title) || safeStr(b.desc) || safeStr(b.caption) || 'Media',
      thumbnail: safeStr(b.thumbnail) || safeStr(b.thumb) || safeStr(b.image) || '',
      videoUrl,
      audioUrl,
    };
  },
};

// KeithAPI — https://apiskeith.top (same /download/ pattern as bk9)
const keithApi: ApiDef = {
  base: 'https://apiskeith.top',
  endpoints: (type) => ({
    tiktok:   ['/api/tiktok', '/api/ttdl'],
    youtube:  ['/api/ytdl', '/api/ytmp4'],
    ytaudio:  ['/api/ytdl'],
    instagram:['/api/igdl', '/api/ig'],
    facebook: ['/api/facebook', '/api/fbdl'],
    twitter:  ['/api/twitter', '/api/twdownload'],
  }[type] ?? []),
  normalize: (data) => {
    const d = obj(data);
    if (!d.status && !d.result && !d.data) return null;
    const r = obj(d.result ?? d.data ?? d);
    const videoUrl =
      safeStr(r.url) || safeStr(r.video) || safeStr(r.hd) || safeStr(r.sd) ||
      safeStr(r.nowm) || safeStr(r.link) || null;
    const audioUrl = safeStr(r.mp3) || safeStr(r.audio) || safeStr(r.music) || null;
    if (!videoUrl && !audioUrl) return null;
    return {
      title: safeStr(r.title) || safeStr(r.desc) || 'Media',
      thumbnail: safeStr(r.thumbnail) || safeStr(r.thumb) || safeStr(r.cover) || '',
      videoUrl,
      audioUrl,
    };
  },
};

// XWolf API — https://apis.xwolf.space
const xwolfApi: ApiDef = {
  base: 'https://apis.xwolf.space',
  endpoints: (type) => ({
    tiktok:   ['/api/tiktok', '/api/ttdl'],
    youtube:  ['/api/ytdl', '/api/ytmp4'],
    ytaudio:  ['/api/ytdl'],
    instagram:['/api/igdl', '/api/ig'],
    facebook: ['/api/facebook', '/api/fbdl'],
    twitter:  ['/api/twitter', '/api/twdownload'],
  }[type] ?? []),
  normalize: (data) => {
    const d = obj(data);
    if (!d.status && !d.result && !d.data) return null;
    const r = obj(d.result ?? d.data ?? d);
    const videoUrl =
      safeStr(r.url) || safeStr(r.video) || safeStr(r.hd) || safeStr(r.sd) ||
      safeStr(r.nowm) || safeStr(r.link) || null;
    const audioUrl = safeStr(r.mp3) || safeStr(r.audio) || safeStr(r.music) || null;
    if (!videoUrl && !audioUrl) return null;
    return {
      title: safeStr(r.title) || safeStr(r.desc) || 'Media',
      thumbnail: safeStr(r.thumbnail) || safeStr(r.thumb) || safeStr(r.cover) || '',
      videoUrl,
      audioUrl,
    };
  },
};

// Vreden API
const vredenApi: ApiDef = {
  base: 'https://api.vreden.my.id',
  endpoints: (type) => ({
    tiktok:   ['/api/tiktok', '/api/ttdl'],
    youtube:  ['/api/ytdl', '/api/ytmp4'],
    ytaudio:  ['/api/ytdl'],
    instagram:['/api/igdl'],
    facebook: ['/api/facebook', '/api/fbdl'],
    twitter:  ['/api/twitter'],
  }[type] ?? []),
  normalize: (data) => {
    const d = obj(data);
    const r = obj(d.result ?? d.data ?? d);
    const videoUrl =
      safeStr(r.url) || safeStr(r.video) || safeStr(r.hd) || safeStr(r.sd) ||
      safeStr(r.nowm) || null;
    const audioUrl = safeStr(r.mp3) || safeStr(r.audio) || null;
    if (!videoUrl && !audioUrl) return null;
    return {
      title: safeStr(r.title) || safeStr(r.desc) || 'Media',
      thumbnail: safeStr(r.thumbnail) || safeStr(r.thumb) || '',
      videoUrl,
      audioUrl,
    };
  },
};

// Rebix API
const rebixApi: ApiDef = {
  base: 'https://api-rebix.zone.id',
  endpoints: (type) => ({
    tiktok:   ['/api/tiktok', '/api/ttdl'],
    youtube:  ['/api/ytdl', '/api/ytmp4'],
    ytaudio:  ['/api/ytdl'],
    instagram:['/api/igdl'],
    facebook: ['/api/facebook', '/api/fbdl'],
    twitter:  ['/api/twitter'],
  }[type] ?? []),
  normalize: (data) => {
    const d = obj(data);
    const r = obj(d.result ?? d.data ?? d);
    const videoUrl =
      safeStr(r.url) || safeStr(r.video) || safeStr(r.hd) || safeStr(r.sd) ||
      safeStr(r.nowm) || null;
    const audioUrl = safeStr(r.mp3) || safeStr(r.audio) || null;
    if (!videoUrl && !audioUrl) return null;
    return {
      title: safeStr(r.title) || safeStr(r.desc) || 'Media',
      thumbnail: safeStr(r.thumbnail) || safeStr(r.thumb) || '',
      videoUrl,
      audioUrl,
    };
  },
};

const ALL_APIS: ApiDef[] = [bk9Api, keithApi, xwolfApi, vredenApi, rebixApi];

// ─── Core Download Logic ──────────────────────────────────────────────────────

async function fetchDownload(
  type: string,  // 'tiktok' | 'youtube' | 'ytaudio' | 'instagram' | 'facebook' | 'twitter'
  mediaUrl: string,
): Promise<NormalizedResult | null> {
  for (const api of ALL_APIS) {
    const endpoints = api.endpoints(type);
    for (const endpoint of endpoints) {
      try {
        const paramKey = api.paramKey ?? 'url';
        const extraParams = type === 'ytaudio' ? '&type=mp3' : '';
        const reqUrl = `${api.base}${endpoint}?${paramKey}=${encodeURIComponent(mediaUrl)}${extraParams}`;
        const res = await axios.get(reqUrl, { timeout: 12000 });
        if (res.data) {
          const result = api.normalize(res.data, type);
          if (result && (result.videoUrl || result.audioUrl)) {
            return result;
          }
        }
      } catch {
        // Try next
      }
    }
  }
  return null;
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
  // Try multiple search endpoints
  const attempts = [
    () => axios.get(`https://my-rest-apis-six.vercel.app/yts?q=${encodeURIComponent(query)}`, { timeout: 10000 }),
    () => axios.get(`https://apiskeith.top/api/ytsearch?query=${encodeURIComponent(query)}`, { timeout: 10000 }),
    () => axios.get(`https://apiskeith.top/search/youtube?q=${encodeURIComponent(query)}`, { timeout: 10000 }),
  ];

  for (const attempt of attempts) {
    try {
      const res = await attempt();
      const raw = res.data;
      if (!raw) continue;

      // Handle various response shapes
      const list: unknown[] =
        Array.isArray(raw) ? raw :
        Array.isArray(raw.result) ? raw.result :
        Array.isArray(raw.data) ? raw.data :
        Array.isArray(raw.results) ? raw.results :
        [];

      if (list.length === 0) continue;

      return list.map((item) => {
        const it = obj(item);
        return {
          title: safeStr(it.title),
          thumbnail: safeStr(it.thumbnail) || safeStr(it.thumb) || safeStr(it.image),
          url: safeStr(it.url) || safeStr(it.link) || safeStr(it.videoId ? `https://youtu.be/${it.videoId}` : ''),
          duration: safeStr(it.duration),
          channel: safeStr(it.channel) || safeStr(it.author),
        };
      }).filter(r => r.title && r.url);
    } catch {
      // Try next
    }
  }
  return [];
}

// ─── Platform Config ──────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const PLATFORMS: Platform[] = [
  { id: 'tiktok',    name: 'TikTok',     icon: '📱', color: 'from-pink-600 to-rose-700' },
  { id: 'youtube',   name: 'YouTube',    icon: '📺', color: 'from-red-600 to-red-800' },
  { id: 'instagram', name: 'Instagram',  icon: '📸', color: 'from-purple-600 via-pink-600 to-orange-500' },
  { id: 'facebook',  name: 'Facebook',   icon: '👥', color: 'from-blue-700 to-blue-900' },
  { id: 'twitter',   name: 'X / Twitter',icon: '🐦', color: 'from-gray-800 to-black' },
];

// ─── App ──────────────────────────────────────────────────────────────────────

type View = 'home' | 'input' | 'search';

export default function App() {
  const [view, setView]                     = useState<View>('home');
  const [platform, setPlatform]             = useState<Platform | null>(null);
  const [input, setInput]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState<NormalizedResult | null>(null);
  const [searchResults, setSearchResults]   = useState<SearchResult[]>([]);
  const [error, setError]                   = useState('');
  const [activeSearchItem, setActiveSearchItem] = useState<NormalizedResult | null>(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [itemLoading, setItemLoading]       = useState<number | null>(null);

  function resetState() {
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
      setError('Could not download. Check the link or try again — all backup servers were tried.');
    }
    setLoading(false);
  }

  async function handleSearch() {
    if (!input.trim()) return;
    setLoading(true);
    setSearchResults([]);
    setError('');
    setActiveSearchItem(null);
    setActiveSearchIndex(null);
    const results = await searchYouTube(input.trim());
    if (results.length > 0) {
      setSearchResults(results);
    } else {
      setError('No results found. Try a different search term.');
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
      // For audio mode, clear videoUrl so only audio button shows
      if (mode === 'audio') {
        setActiveSearchItem({ ...res, videoUrl: null });
      } else {
        setActiveSearchItem(res);
      }
      setActiveSearchIndex(index);
    } else {
      setError('Could not get download link for this video.');
    }
    setItemLoading(null);
  }

  const isSearchView = view === 'search';

  return (
    <div className="min-h-screen bg-[#05070a] text-white p-4 sm:p-8 font-sans">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          MAKAMESCO DL
        </h1>
        <div className="flex justify-center items-center gap-2 mt-2">
          <span className="h-[1px] w-10 bg-slate-800"></span>
          <p className="text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase">Powered by Spicetech</p>
          <span className="h-[1px] w-10 bg-slate-800"></span>
        </div>
      </div>

      {/* Home Grid */}
      {view === 'home' && (
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-6">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPlatform(p); setView('input'); resetState(); }}
              className={`bg-gradient-to-br ${p.color} p-8 rounded-[2.5rem] shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center group active:scale-95`}
            >
              <span className="text-5xl mb-3 group-hover:scale-110 transition-transform">{p.icon}</span>
              <span className="font-black text-sm uppercase tracking-widest">{p.name}</span>
            </button>
          ))}
          <button
            onClick={() => { setView('search'); resetState(); }}
            className="bg-slate-900/40 border-2 border-dashed border-slate-700 p-8 rounded-[2.5rem] hover:bg-slate-800 transition-all flex flex-col items-center group active:scale-95"
          >
            <Music className="mb-3 text-cyan-400 group-hover:rotate-12 transition-transform" size={40} />
            <span className="font-black text-sm uppercase text-cyan-400">Music / Search</span>
          </button>
        </div>
      )}

      {/* Download / Search Panel */}
      {view !== 'home' && (
        <div className="max-w-xl mx-auto">
          <div className="bg-[#0f1420] border border-slate-800/50 p-8 rounded-[3rem] shadow-2xl">
            {/* Back button */}
            <button
              onClick={() => { setView('home'); resetState(); }}
              className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Back to Hub</span>
            </button>

            {/* Title */}
            <h2 className="text-3xl font-black mb-6 uppercase italic flex items-center gap-3">
              {isSearchView ? <Search className="text-cyan-400" /> : platform?.icon}
              {isSearchView ? 'Music / Search' : platform?.name}
            </h2>

            {/* Input */}
            <div className="relative">
              <input
                type="text"
                placeholder={isSearchView
                  ? 'Song name, artist, or YouTube URL...'
                  : `Paste ${platform?.name} link...`}
                className="w-full bg-[#161d2f] border-2 border-slate-700 p-5 rounded-2xl outline-none focus:border-cyan-500 text-lg transition-all pr-20"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  if (isSearchView) {
                    // If it looks like a YouTube URL, download directly
                    if (input.includes('youtube.com') || input.includes('youtu.be')) {
                      handleDownload('youtube', input);
                    } else {
                      handleSearch();
                    }
                  } else {
                    handleDownload(platform!.id, input);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (isSearchView) {
                    if (input.includes('youtube.com') || input.includes('youtu.be')) {
                      handleDownload('youtube', input);
                    } else {
                      handleSearch();
                    }
                  } else {
                    handleDownload(platform!.id, input);
                  }
                }}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 bottom-2 bg-cyan-500 px-6 rounded-xl hover:bg-cyan-400 disabled:opacity-20 transition-all shadow-lg text-black font-bold"
              >
                {loading
                  ? <RefreshCcw className="animate-spin" />
                  : (isSearchView ? <Search size={20} /> : <Download size={20} />)
                }
              </button>
            </div>

            {/* Search hint */}
            {isSearchView && (
              <p className="text-slate-600 text-[11px] mt-2 ml-1">
                Paste a YouTube link to download directly, or type a song name to search.
              </p>
            )}

            {/* Error */}
            {error && (
              <div className="mt-5 flex items-start gap-3 bg-red-950/40 border border-red-800/50 rounded-2xl p-4">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Download Result Card */}
            {result && <ResultCard result={result} />}

            {/* Search Results List */}
            {isSearchView && searchResults.length > 0 && (
              <div className="mt-8 space-y-3 overflow-y-auto max-h-[500px] pr-1">
                {searchResults.map((video, i) => (
                  <div key={i}>
                    <div className="flex gap-4 p-3 bg-[#161d2f] rounded-2xl items-center border border-slate-700/50 hover:border-cyan-500/30 transition-all group">
                      {/* Thumbnail */}
                      <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-slate-800">
                        {video.thumbnail && (
                          <img src={video.thumbnail} className="w-full h-full object-cover" alt={video.title} />
                        )}
                      </div>
                      {/* Info + buttons */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] leading-tight line-clamp-2 group-hover:text-cyan-400 transition-colors">{video.title}</p>
                        {video.channel && (
                          <p className="text-slate-500 text-[11px] mt-0.5 truncate">{video.channel}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSearchItemDownload(video, 'video', i)}
                            disabled={itemLoading === i}
                            className="flex items-center gap-1 text-[10px] bg-cyan-500 text-black font-black px-3 py-1.5 rounded-md uppercase disabled:opacity-50 hover:bg-cyan-400 transition-colors"
                          >
                            {itemLoading === i ? <RefreshCcw size={10} className="animate-spin" /> : <Video size={10} />}
                            Video
                          </button>
                          <button
                            onClick={() => handleSearchItemDownload(video, 'audio', i)}
                            disabled={itemLoading === i}
                            className="flex items-center gap-1 text-[10px] bg-slate-700 text-white font-black px-3 py-1.5 rounded-md uppercase disabled:opacity-50 hover:bg-slate-600 transition-colors"
                          >
                            {itemLoading === i ? <RefreshCcw size={10} className="animate-spin" /> : <Headphones size={10} />}
                            Audio
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Inline result for this search item */}
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

      {/* Footer */}
      <footer className="mt-20 pb-10 text-center opacity-40">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">
          &copy; 2026 MAKAMESCO &bull; SPICETECH &bull; KENYA
        </p>
      </footer>
    </div>
  );
}

// ─── Result Card Component ────────────────────────────────────────────────────

function ResultCard({ result, compact = false }: { result: NormalizedResult; compact?: boolean }) {
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
        <div className="flex flex-col gap-2">
          {result.videoUrl && (
            <a
              href={result.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-cyan-500 text-black py-4 rounded-xl text-center font-black uppercase text-xs hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
            >
              <Video size={14} /> Download Video
            </a>
          )}
          {result.audioUrl && (
            <a
              href={result.audioUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-slate-700 text-white py-4 rounded-xl text-center font-black uppercase text-xs hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <Headphones size={14} /> Download Audio
            </a>
          )}
          {!result.videoUrl && !result.audioUrl && (
            <p className="text-slate-500 text-xs text-center py-2">No download links available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
