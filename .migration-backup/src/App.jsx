import React, { useState } from 'react';
import { Download, Search, Music, RefreshCcw, ArrowLeft, AlertTriangle } from 'lucide-react';
import axios from 'axios';

// The "Reliable" List - prioritize Keith and Rebix for DL, your Vercel for Search
const API_LIST = [
  "https://apiskeith.top/api/",
  "https://api-rebix.zone.id/api/",
  "https://api.vreden.my.id/api/",
  "https://apis.xwolf.space/api/"
];

export default function App() {
  const [view, setView] = useState('home');
  const [platform, setPlatform] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  // Fix 1: Universal Downloader Logic (Solves the "Stuck" Issue)
  const getDownloadData = async (type, param) => {
    if (!param) return alert("Please paste a link first!");
    setLoading(true);
    setData(null);

    // Map types to the most successful endpoint names
    const endpointMap = {
      tiktok: ['tiktok', 'ttdl'],
      youtube: ['ytdl', 'ytmp4'],
      facebook: ['facebook', 'fbdl'],
      instagram: ['igdl', 'ig'],
      twitter: ['twitter', 'twdownload']
    };

    const targets = endpointMap[type] || ['downloader'];

    for (let base of API_LIST) {
      for (let target of targets) {
        try {
          const url = `${base}${target}?url=${encodeURIComponent(param)}`;
          const res = await axios.get(url, { timeout: 10000 }); // 10s timeout
          
          if (res.data && (res.data.status || res.data.result)) {
            setData(res.data.result || res.data);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn(`Rotation: ${base}${target} failed. Trying next...`);
        }
      }
    }
    
    alert("All servers are busy. This usually happens with private videos or server maintenance.");
    setLoading(false);
  };

  // Fix 2: Your Custom Vercel Search Endpoint
  const handleSearch = async () => {
    if (!input) return;
    setLoading(true);
    setSearchResults([]);
    try {
      // Prioritizing your new custom endpoint
      const res = await axios.get(`https://my-rest-apis-six.vercel.app/yts?q=${encodeURIComponent(input)}`);
      const results = res.data.result || res.data.data || res.data;
      
      if (Array.isArray(results)) {
        setSearchResults(results);
      } else {
        throw new Error("Invalid format");
      }
    } catch (e) {
      // Fallback search if yours is down
      try {
        const fallback = await axios.get(`${API_LIST[0]}ytsearch?query=${encodeURIComponent(input)}`);
        setSearchResults(fallback.data.result || []);
      } catch (err) {
        alert("Music search is currently unavailable.");
      }
    }
    setLoading(false);
  };

  const platforms = [
    { id: 'tiktok', name: 'TikTok', icon: '📱', color: 'from-pink-600 to-rose-700' },
    { id: 'youtube', name: 'YouTube', icon: '📺', color: 'from-red-600 to-red-800' },
    { id: 'instagram', name: 'Instagram', icon: '📸', color: 'from-purple-600 via-pink-600 to-orange-500' },
    { id: 'facebook', name: 'Facebook', icon: '👥', color: 'from-blue-700 to-blue-900' },
    { id: 'twitter', name: 'X / Twitter', icon: '🐦', color: 'from-gray-800 to-black' }
  ];

  return (
    <div className="min-h-screen bg-[#05070a] text-white p-4 sm:p-8 font-sans">
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

      {view === 'home' ? (
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-6">
          {platforms.map(p => (
            <button key={p.id} onClick={() => { setPlatform(p); setView('input'); }} 
              className={`bg-gradient-to-br ${p.color} p-8 rounded-[2.5rem] shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center group active:scale-95`}>
              <span className="text-5xl mb-3 group-hover:scale-110 transition-transform">{p.icon}</span>
              <span className="font-black text-sm uppercase tracking-widest">{p.name}</span>
            </button>
          ))}
          <button onClick={() => setView('search')} className="bg-slate-900/40 border-2 border-dashed border-slate-700 p-8 rounded-[2.5rem] hover:bg-slate-800 transition-all flex flex-col items-center group active:scale-95">
            <Music className="mb-3 text-cyan-400 group-hover:rotate-12 transition-transform" size={40} />
            <span className="font-black text-sm uppercase text-cyan-400">Music Search</span>
          </button>
        </div>
      ) : (
        <div className="max-w-xl mx-auto bg-[#0f1420] border border-slate-800/50 p-8 rounded-[3rem] shadow-2xl animate-in fade-in zoom-in duration-300">
          <button onClick={() => {setView('home'); setData(null); setInput(''); setSearchResults([]);}} className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18}/> <span className="text-xs font-bold uppercase tracking-wider">Back to Hub</span>
          </button>
          
          <h2 className="text-3xl font-black mb-6 uppercase italic flex items-center gap-3">
            {view === 'search' ? <Search className="text-cyan-400"/> : platform?.icon}
            {view === 'search' ? 'Music' : platform?.name}
          </h2>

          <div className="relative">
            <input 
              type="text" 
              placeholder={view === 'search' ? "Song name or YouTube URL..." : `Paste ${platform?.name} link...`}
              className="w-full bg-[#161d2f] border-2 border-slate-700 p-5 rounded-2xl outline-none focus:border-cyan-500 text-lg transition-all pr-20"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (view === 'search' ? handleSearch() : getDownloadData(platform.id, input))}
            />
            <button 
              onClick={view === 'search' ? handleSearch : () => getDownloadData(platform.id, input)}
              disabled={loading || !input}
              className="absolute right-2 top-2 bottom-2 bg-cyan-500 px-6 rounded-xl hover:bg-cyan-400 disabled:opacity-20 transition-all shadow-lg text-black font-bold"
            >
              {loading ? <RefreshCcw className="animate-spin" /> : (view === 'search' ? <Search size={20}/> : <Download size={20}/>)}
            </button>
          </div>

          {/* Download Card */}
          {data && (
            <div className="mt-8 animate-in slide-in-from-bottom-5 duration-500">
              <div className="bg-[#161d2f] rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
                <img src={data.thumbnail || data.thumb || 'https://via.placeholder.com/500x300?text=Media+Found'} className="w-full aspect-video object-cover" />
                <div className="p-5">
                  <p className="font-bold text-sm mb-4 line-clamp-2">{data.title || "Your file is ready"}</p>
                  <div className="flex flex-col gap-2">
                    <a href={data.url || data.nowm || data.link} target="_blank" rel="noreferrer" className="w-full bg-cyan-500 text-black py-4 rounded-xl text-center font-black uppercase text-xs hover:scale-[1.02] transition-transform">Download HD Video</a>
                    {(data.mp3 || data.audio) && <a href={data.mp3 || data.audio} target="_blank" rel="noreferrer" className="w-full bg-slate-800 text-white py-4 rounded-xl text-center font-black uppercase text-xs hover:bg-slate-700 transition-colors">Download MP3 Audio</a>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Results List */}
          {view === 'search' && searchResults.length > 0 && (
            <div className="mt-8 space-y-3 overflow-y-auto max-h-[450px] pr-2">
              {searchResults.map((video, i) => (
                <div key={i} className="flex gap-4 p-3 bg-[#161d2f] rounded-2xl items-center border border-slate-700/50 hover:border-cyan-500/30 transition-all group">
                  <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden">
                     <img src={video.thumbnail} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] leading-tight line-clamp-2 group-hover:text-cyan-400 transition-colors uppercase">{video.title}</p>
                    <div className="flex gap-2 mt-2">
                       <button onClick={() => getDownloadData('youtube', video.url)} className="text-[10px] bg-cyan-500 text-black font-black px-3 py-1.5 rounded-md uppercase">Video</button>
                       <button onClick={() => getDownloadData('youtube', video.url)} className="text-[10px] bg-white text-black font-black px-3 py-1.5 rounded-md uppercase">Audio</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="mt-20 pb-10 text-center opacity-40">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">
          &copy; 2026 MAKAMESCO &bull; SPICETECH &bull; KENYA
        </p>
      </footer>
    </div>
  );
}
