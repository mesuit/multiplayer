import React, { useState } from 'react';
import { Download, Search, Music, RefreshCcw, ArrowLeft } from 'lucide-react';
import axios from 'axios';

// Updated Working API List for 2026
const API_LIST = [
  "https://api-rebix.zone.id/api/",
  "https://apiskeith.top/api/",
  "https://apis.xwolf.space/api/",
  "https://api.vreden.my.id/api/"
];

export default function App() {
  const [view, setView] = useState('home');
  const [platform, setPlatform] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  // Corrected Logic: Uses proper endpoints for each service
  const getDownloadData = async (type, param) => {
    setLoading(true);
    const endpoints = {
      tiktok: "tiktok",
      youtube: "ytdl",       // Changed from ytmp4
      facebook: "facebook",  // Changed from fbdl
      instagram: "igdl",
      twitter: "twitter"
    };

    const target = endpoints[type] || "downloader"; // Fallback to universal

    for (let base of API_LIST) {
      try {
        // Essential: encodeURIComponent handles the '?' and '&' in social links
        const url = `${base}${target}?url=${encodeURIComponent(param)}`;
        const res = await axios.get(url);
        
        if (res.data.status || res.data.result) {
          setData(res.data.result || res.data);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn(`Server ${base} busy, rotating...`);
      }
    }
    alert("Servers are currently rate-limited. Please try again in 1 minute.");
    setLoading(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    for (let base of API_LIST) {
      try {
        const res = await axios.get(`${base}ytsearch?query=${encodeURIComponent(input)}`);
        if (res.data.result) {
          setSearchResults(res.data.result);
          setLoading(false);
          return;
        }
      } catch (e) { continue; }
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
    <div className="min-h-screen bg-[#05070a] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          MAKAMESCO DL
        </h1>
        <p className="text-slate-500 text-xs font-bold tracking-[0.4em] mt-2">POWERED BY SPICETECH</p>
      </div>

      {view === 'home' ? (
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-6">
          {platforms.map(p => (
            <button key={p.id} onClick={() => { setPlatform(p); setView('input'); }} 
              className={`bg-gradient-to-br ${p.color} p-8 rounded-[2.5rem] shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center group`}>
              <span className="text-5xl mb-3 group-hover:scale-110 transition-transform">{p.icon}</span>
              <span className="font-black text-sm uppercase">{p.name}</span>
            </button>
          ))}
          <button onClick={() => setView('search')} className="bg-slate-900/50 border-2 border-dashed border-slate-700 p-8 rounded-[2.5rem] hover:bg-slate-800 transition-all flex flex-col items-center">
            <Music className="mb-3 text-emerald-400" size={40} />
            <span className="font-black text-sm uppercase text-emerald-400">Search Music</span>
          </button>
        </div>
      ) : (
        <div className="max-w-xl mx-auto bg-[#0f1420] border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
          <button onClick={() => {setView('home'); setData(null); setInput(''); setSearchResults([]);}} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18}/> <span className="text-sm font-bold uppercase tracking-wider">Back to Hub</span>
          </button>
          
          <h2 className="text-3xl font-black mb-6 uppercase italic">
            {view === 'search' ? 'YouTube Search' : platform?.name}
          </h2>

          <div className="relative group">
            <input 
              type="text" 
              placeholder={view === 'search' ? "Enter song or artist name..." : "Paste link here..."}
              className="w-full bg-[#161d2f] border-2 border-slate-700 p-5 rounded-2xl outline-none focus:border-emerald-500 text-lg transition-all"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button 
              onClick={view === 'search' ? handleSearch : () => getDownloadData(platform.id, input)}
              disabled={loading || !input}
              className="absolute right-2 top-2 bottom-2 bg-emerald-500 px-6 rounded-xl hover:bg-emerald-400 disabled:opacity-30 transition-all shadow-lg"
            >
              {loading ? <RefreshCcw className="animate-spin" /> : (view === 'search' ? <Search /> : <Download />)}
            </button>
          </div>

          {/* Download Results */}
          {data && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative group overflow-hidden rounded-3xl border-2 border-emerald-500/20">
                <img src={data.thumbnail || data.thumb || 'https://via.placeholder.com/500x300?text=Media+Ready'} className="w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
                  <p className="font-bold text-lg leading-tight mb-4">{data.title || "Ready for Download"}</p>
                  <div className="flex gap-3">
                    <a href={data.url || data.nowm || data.link} target="_blank" rel="noreferrer" className="flex-1 bg-emerald-500 py-4 rounded-xl text-center font-black uppercase text-xs hover:bg-emerald-400 transition-colors shadow-xl">Get Video</a>
                    {(data.mp3 || data.audio) && <a href={data.mp3 || data.audio} target="_blank" rel="noreferrer" className="flex-1 bg-white text-black py-4 rounded-xl text-center font-black uppercase text-xs hover:bg-slate-200 transition-colors shadow-xl">Get Audio</a>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search List */}
          {view === 'search' && searchResults.length > 0 && (
            <div className="mt-8 space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {searchResults.map((video, i) => (
                <div key={i} className="flex gap-4 p-3 bg-[#161d2f] rounded-2xl items-center border border-slate-700/50 hover:border-emerald-500/50 transition-all">
                  <img src={video.thumbnail} className="w-24 rounded-xl shadow-md" />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-sm truncate uppercase tracking-tighter">{video.title}</p>
                    <button onClick={() => getDownloadData('youtube', video.url)} className="mt-2 text-[10px] bg-emerald-500 text-black font-black px-4 py-2 rounded-lg uppercase hover:bg-emerald-400 transition-colors">Select</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="mt-20 pb-8 text-center">
        <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.5em]">
          &copy; 2026 MAKAMESCO TECH SOLUTIONS &bull; SPICETECH KENYA
        </p>
      </footer>
    </div>
  );
}