
import React, { useState, useEffect } from 'react';
import { AnalysisResult, AnalysisStatus, UploadedFile, HistoryItem } from './types';
import { analyzeMedia } from './services/geminiService';
import FileUpload from './components/FileUpload';
import AnalysisView from './components/AnalysisView';
import { Loader2, AlertCircle, RefreshCw, X, Eye, WifiOff, KeyRound, FileWarning, ServerCrash, History, Scan, Calendar, Trash2, FileText, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('diso_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const addToHistory = (file: UploadedFile, analysis: AnalysisResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      fileName: file.file.name,
      fileType: file.mimeType,
      previewUrl: file.previewUrl,
      result: analysis
    };

    try {
      const updatedHistory = [newItem, ...history];
      localStorage.setItem('diso_history', JSON.stringify(updatedHistory));
      setHistory(updatedHistory);
    } catch (e) {
      console.warn("Storage quota exceeded. Saving history without image preview.");
      // Fallback: Save without the large previewUrl string
      const itemWithoutImage = { ...newItem, previewUrl: '' };
      const updatedHistory = [itemWithoutImage, ...history];
      try {
        localStorage.setItem('diso_history', JSON.stringify(updatedHistory));
        setHistory(updatedHistory);
      } catch (e2) {
        console.error("Failed to save history item", e2);
      }
    }
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('diso_history', JSON.stringify(updatedHistory));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    // Reconstruct a mock UploadedFile state
    setCurrentFile({
      file: new File([], item.fileName, { type: item.fileType }), // Mock file object
      previewUrl: item.previewUrl,
      base64: '', // Not needed for display
      mimeType: item.fileType,
    });
    setResult(item.result);
    setStatus(AnalysisStatus.COMPLETED);
    setActiveTab('analyze');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getFriendlyErrorMessage = (error: any): string => {
    const msg = (error?.message || '').toString();
    
    if (msg.includes('MISSING_API_KEY') || msg.includes('API key') || msg.includes('403')) {
      return 'Authentication Failed. Please check your API Key configuration.';
    }
    
    if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
      return 'Analysis Rejected. The media format might be unsupported or the file is corrupted.';
    }

    if (msg.includes('503') || msg.includes('500') || msg.includes('Overloaded')) {
      return 'System Overload. The AI forensic model is currently busy. Please try again in a moment.';
    }

    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      return 'Network Error. Please check your internet connection.';
    }
    
    if (msg.includes('File too large')) {
      return msg;
    }

    if (msg.includes('NO_RESPONSE_TEXT')) {
      return 'Analysis Error. The AI model failed to generate a structured report.';
    }

    return 'An unexpected error occurred during analysis. Please try again.';
  };

  const getErrorIcon = (errorMessage: string) => {
    if (errorMessage.includes('Authentication')) return <KeyRound className="text-red-500 shrink-0 mt-1" />;
    if (errorMessage.includes('Network')) return <WifiOff className="text-red-500 shrink-0 mt-1" />;
    if (errorMessage.includes('File')) return <FileWarning className="text-red-500 shrink-0 mt-1" />;
    if (errorMessage.includes('System')) return <ServerCrash className="text-red-500 shrink-0 mt-1" />;
    return <AlertCircle className="text-red-500 shrink-0 mt-1" />;
  };

  const processFile = async (file: File) => {
    try {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("File too large. Please upload media under 20MB.");
      }

      setStatus(AnalysisStatus.ANALYZING);
      setError(null);
      setResult(null);

      // Convert to Base64 for Preview and API
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Raw = e.target?.result as string;
        try {
          // Split for API (remove "data:image/jpeg;base64," or "data:video/mp4;base64,")
          const [meta, data] = base64Raw.split(',');
          const mimeType = meta.split(':')[1].split(';')[0];

          const uploadData = {
            file,
            previewUrl: base64Raw,
            base64: data,
            mimeType,
          };

          setCurrentFile(uploadData);

          // Call API
          const analysis = await analyzeMedia(data, mimeType);
          setResult(analysis);
          setStatus(AnalysisStatus.COMPLETED);
          addToHistory(uploadData, analysis); // Save to history
        } catch (apiError) {
          console.error(apiError);
          setError(getFriendlyErrorMessage(apiError));
          setStatus(AnalysisStatus.ERROR);
        }
      };
      
      reader.onerror = () => {
        setError("Failed to read file. Please try another file.");
        setStatus(AnalysisStatus.ERROR);
      };
      
      reader.readAsDataURL(file);

    } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
        setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleReset = () => {
    setStatus(AnalysisStatus.IDLE);
    setCurrentFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { handleReset(); setActiveTab('analyze'); }}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Eye className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
              DISO
            </h1>
          </div>
          <div className="hidden sm:block text-xs font-mono text-zinc-500 border border-zinc-800 rounded-full px-3 py-1">
             Detect & Inspect Synthetic Output
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-3xl mx-auto w-full px-6 mt-8">
        <div className="flex p-1 bg-zinc-900/50 rounded-xl border border-zinc-800 w-fit mx-auto sm:mx-0">
          <button
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'analyze' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Scan size={16} />
            New Analysis
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'history' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History size={16} />
            History
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        
        {/* VIEW: ANALYZE */}
        {activeTab === 'analyze' && (
          <>
            {/* Intro Text (only when Idle) */}
            {status === AnalysisStatus.IDLE && (
              <div className="text-center mb-10 space-y-4 animate-fade-in mt-8">
                <h2 className="text-4xl font-bold tracking-tight text-white">
                  Is it Real or <span className="text-emerald-400">Synthetic?</span>
                </h2>
                <p className="text-lg text-zinc-400 max-w-lg mx-auto leading-relaxed">
                  Upload an image or video to detect Generative AI artifacts. 
                  Our forensic engine analyzes lighting, physics, and synthetic patterns.
                </p>
              </div>
            )}

            {/* Upload Area */}
            {status === AnalysisStatus.IDLE && (
              <div className="animate-fade-in">
                 <FileUpload onFileSelect={processFile} />
              </div>
            )}

            {/* Active Analysis View */}
            {(status === AnalysisStatus.ANALYZING || status === AnalysisStatus.COMPLETED || status === AnalysisStatus.ERROR) && currentFile && (
              <div className="space-y-8 animate-fade-in">
                
                {/* Media Preview & Controls */}
                <div className="relative group rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl transition-all duration-500">
                    {currentFile.previewUrl ? (
                        currentFile.mimeType.startsWith('video/') ? (
                        <video 
                            src={currentFile.previewUrl} 
                            controls 
                            className={`w-full max-h-[500px] object-contain mx-auto transition-opacity duration-500 ${status === AnalysisStatus.ANALYZING ? 'opacity-50' : 'opacity-100'}`}
                        />
                        ) : (
                        <img 
                            src={currentFile.previewUrl} 
                            alt="Analysis Target" 
                            className={`w-full max-h-[500px] object-contain mx-auto transition-opacity duration-500 ${status === AnalysisStatus.ANALYZING ? 'opacity-50' : 'opacity-100'}`}
                        />
                        )
                    ) : (
                        <div className="w-full h-64 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900">
                            <FileText size={48} className="mb-2 opacity-50"/>
                            <p>Preview not available</p>
                        </div>
                    )}
                    
                    
                    {status === AnalysisStatus.ANALYZING && (
                      <div className="absolute inset-0 z-10 pointer-events-none">
                        <div className="scan-line"></div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                          <span className="text-emerald-400 font-mono tracking-widest text-sm uppercase animate-pulse">Scanning Data Stream...</span>
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handleReset}
                      className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-zinc-800 transition-colors border border-zinc-700/50 backdrop-blur-sm z-20"
                      title="Close and Reset"
                    >
                      <X size={20} />
                    </button>
                </div>

                {/* Error State */}
                {status === AnalysisStatus.ERROR && error && (
                  <div className="p-6 rounded-xl border border-red-900/50 bg-red-950/10 flex items-start gap-4 animate-in slide-in-from-bottom-2">
                    {getErrorIcon(error)}
                    <div className="space-y-2">
                       <h3 className="font-semibold text-red-200">Analysis Failed</h3>
                       <p className="text-red-200/60 text-sm leading-relaxed">{error}</p>
                       <button 
                        onClick={() => currentFile && processFile(currentFile.file)}
                        className="mt-3 text-sm text-red-400 hover:text-red-300 flex items-center gap-2 font-medium transition-colors"
                       >
                         <RefreshCw size={14} /> Retry Analysis
                       </button>
                    </div>
                  </div>
                )}

                {/* Success State */}
                {status === AnalysisStatus.COMPLETED && result && (
                   <AnalysisView result={result} />
                )}

              </div>
            )}
          </>
        )}

        {/* VIEW: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-6">Analysis History</h2>
            
            {history.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                <History className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">No analysis history yet</p>
                <p className="text-zinc-600 text-sm mt-1">Files you analyze will appear here.</p>
                <button 
                    onClick={() => setActiveTab('analyze')}
                    className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                >
                    Start a new analysis
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {history.map((item) => {
                  const isDanger = item.result.isAiGenerated && item.result.confidenceScore > 50;
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => loadHistoryItem(item)}
                      className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all cursor-pointer"
                    >
                      {/* Thumbnail / Icon */}
                      <div className="w-full sm:w-20 h-20 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 relative">
                        {item.previewUrl ? (
                             item.fileType.startsWith('video/') ? (
                                <video src={item.previewUrl} className="w-full h-full object-cover opacity-80" />
                             ) : (
                                <img src={item.previewUrl} alt="Thumbnail" className="w-full h-full object-cover opacity-80" />
                             )
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <FileText size={24} />
                            </div>
                        )}
                        {/* Type Badge */}
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] font-bold bg-black/70 text-zinc-300 rounded uppercase backdrop-blur-sm">
                            {item.fileType.startsWith('video/') ? 'Video' : 'Img'}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${isDanger ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {isDanger ? 'AI Detected' : 'Authentic'}
                            </span>
                            <span className="text-zinc-500 text-xs flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                        <h4 className="text-zinc-200 font-medium truncate pr-4">{item.fileName}</h4>
                        <p className="text-zinc-500 text-sm truncate">{item.result.verdict}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                         <div className="text-zinc-500 group-hover:text-emerald-400 transition-colors">
                            <ChevronRight size={20} />
                         </div>
                         <button 
                            onClick={(e) => deleteHistoryItem(e, item.id)}
                            className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                         >
                            <Trash2 size={18} />
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-zinc-800 mt-auto text-center text-zinc-600 text-sm">
        <p>AI Analysis is probabilistic. Results should be verified by human inspection.</p>
      </footer>
    </div>
  );
};

export default App;
