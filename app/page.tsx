'use client';

import { useState, useEffect } from 'react';
import { Settings, MessageSquare, FileText, Download, Plus, Loader2, Play, AlertCircle, Trash2 } from 'lucide-react';

export default function Home() {
    const [activeTab, setActiveTab] = useState<'chat' | 'preview'>('chat');
    const [currentInput, setCurrentInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const [pdfName, setPdfName] = useState('ZeraNotes');

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [apiProvider, setApiProvider] = useState<'google' | 'openrouter'>('google');
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [openRouterApiKey, setOpenRouterApiKey] = useState('');
    const [googleModel, setGoogleModel] = useState('gemini-3.5-flash');
    const [openRouterModel, setOpenRouterModel] = useState('anthropic/claude-3-haiku');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    const [logs, setLogs] = useState<{ id: number; message: string; type: 'info' | 'success' | 'error' }[]>([]);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            const savedProvider = localStorage.getItem('API_PROVIDER') as 'google' | 'openrouter';
            const savedGoogleKey = localStorage.getItem('GOOGLE_API_KEY') || localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('API_KEY') || '';
            const savedOpenRouterKey = localStorage.getItem('OPENROUTER_API_KEY') || '';
            const savedGoogleModel = localStorage.getItem('GOOGLE_MODEL') || localStorage.getItem('GEMINI_MODEL') || localStorage.getItem('API_MODEL') || 'gemini-3.5-flash';
            const savedOpenRouterModel = localStorage.getItem('OPENROUTER_MODEL') || 'anthropic/claude-3-haiku';
            const savedTheme = localStorage.getItem('THEME') as 'light' | 'dark';
            const savedLogs = localStorage.getItem('CHAT_LOGS');
            const savedPdfUrl = localStorage.getItem('CHAT_PDF_URL');
            const savedInput = localStorage.getItem('CHAT_INPUT');

            if (savedProvider) setApiProvider(savedProvider);
            setGoogleApiKey(savedGoogleKey);
            setOpenRouterApiKey(savedOpenRouterKey);
            setGoogleModel(savedGoogleModel);
            setOpenRouterModel(savedOpenRouterModel);

            if (savedTheme) {
                setTheme(savedTheme);
                if (savedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }

            if (savedLogs) {
                try { setLogs(JSON.parse(savedLogs)); } catch (e) {}
            }
            if (savedPdfUrl) setPdfUrl(savedPdfUrl);
            if (savedInput) setCurrentInput(savedInput);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('THEME', newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const saveSettings = () => {
        localStorage.setItem('API_PROVIDER', apiProvider);
        localStorage.setItem('GOOGLE_API_KEY', googleApiKey);
        localStorage.setItem('OPENROUTER_API_KEY', openRouterApiKey);
        localStorage.setItem('GOOGLE_MODEL', googleModel);
        localStorage.setItem('OPENROUTER_MODEL', openRouterModel);
        setIsSettingsOpen(false);
    };

    const handleClearChat = () => {
        setLogs([]);
        setPdfUrl(null);
        setCurrentInput('');
        setProgress(0);
        localStorage.removeItem('CHAT_LOGS');
        localStorage.removeItem('CHAT_PDF_URL');
        localStorage.removeItem('CHAT_INPUT');
    };

    useEffect(() => {
        localStorage.setItem('CHAT_LOGS', JSON.stringify(logs));
    }, [logs]);

    useEffect(() => {
        if (pdfUrl) {
            try {
                localStorage.setItem('CHAT_PDF_URL', pdfUrl);
            } catch (e) {
                console.warn('PDF exceeds localStorage quota.', e);
            }
        } else {
            localStorage.removeItem('CHAT_PDF_URL');
        }
    }, [pdfUrl]);

    useEffect(() => {
        localStorage.setItem('CHAT_INPUT', currentInput);
    }, [currentInput]);

    const handleGenerate = async () => {
        const inputText = currentInput.trim();
        if (!inputText) return;
        
        const allWords = inputText.split(/\s+/);
        let chunks: string[] = [];
        
        // 1. Try grouping by Page Number (3 pages per chunk)
        const pageRegex = /\[?\b(?:Page Number|PAGE|Page)\s*:?\s*\d+\b\]?/gi;
        const pageMatches = Array.from(inputText.matchAll(pageRegex));
        
        if (pageMatches.length >= 2) {
            let currentChunkStart = 0;
            let pagesInCurrentChunk = 0;
            for (let i = 0; i < pageMatches.length; i++) {
                pagesInCurrentChunk++;
                if (pagesInCurrentChunk === 3 || i === pageMatches.length - 1) {
                    const nextMatchIndex = (i + 1 < pageMatches.length) ? pageMatches[i+1].index : inputText.length;
                    chunks.push(inputText.substring(currentChunkStart, nextMatchIndex).trim());
                    currentChunkStart = nextMatchIndex || inputText.length;
                    pagesInCurrentChunk = 0;
                }
            }
        } else {
            // 2. Fallback: Group by Main Concept (3 concepts per chunk)
            const conceptRegex = /(?:Main Concept|Concept|Topic)\s*[:\-\d]*/gi;
            const conceptMatches = Array.from(inputText.matchAll(conceptRegex));
            
            if (conceptMatches.length >= 2) {
                let currentChunkStart = 0;
                let conceptsInCurrentChunk = 0;
                for (let i = 0; i < conceptMatches.length; i++) {
                    conceptsInCurrentChunk++;
                    if (conceptsInCurrentChunk === 3 || i === conceptMatches.length - 1) {
                        const nextMatchIndex = (i + 1 < conceptMatches.length) ? conceptMatches[i+1].index : inputText.length;
                        chunks.push(inputText.substring(currentChunkStart, nextMatchIndex).trim());
                        currentChunkStart = nextMatchIndex || inputText.length;
                        conceptsInCurrentChunk = 0;
                    }
                }
            } else {
                // 3. Fallback: Word counter limit
                const MAX_WORDS = 800;
                for (let i = 0; i < allWords.length; i += MAX_WORDS) {
                    chunks.push(allWords.slice(i, i + MAX_WORDS).join(' '));
                }
            }
        }

        chunks = chunks.filter(c => c.length > 0);

        const currentApiKey = apiProvider === 'google' ? googleApiKey : openRouterApiKey;
        const currentModel = apiProvider === 'google' ? googleModel : openRouterModel;

        if (!currentApiKey || currentApiKey.trim() === '') {
            setLogs([{ id: Date.now(), message: "API Key is missing. Please configure it in Settings first.", type: 'error' }]);
            setIsSettingsOpen(true);
            return;
        }

        setIsLoading(true);
        setActiveTab('chat');
        setPdfUrl(null);
        setCurrentInput('');
        
        setLogs([{ id: Date.now() + Math.random(), message: "Starting Post-Mortem Sequence...", type: 'info' }]);
        setProgress(0);
        
        try {
            const htmlContents: string[] = [];
            
            for (let i = 0; i < chunks.length; i++) {
                setLogs(prev => [...prev, { id: Date.now() + Math.random(), message: `Analyzing Chunk ${i + 1} of ${chunks.length}...`, type: 'info' }]);
                setProgress(((i) / (chunks.length + 1)) * 100);

                const res = await fetch('/api/generate-chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: chunks[i], apiKey: currentApiKey, model: currentModel, apiProvider })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || `Failed on chunk ${i + 1}`);
                }
                
                const data = await res.json();
                htmlContents.push(data.html);

                setLogs(prev => [...prev, { id: Date.now() + Math.random(), message: `Chunk ${i + 1} processed successfully.`, type: 'success' }]);

                if (i < chunks.length - 1) {
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

            setLogs(prev => [...prev, { id: Date.now() + Math.random(), message: `Compiling layout and generating Infinite PDF...`, type: 'info' }]);
            setProgress((chunks.length / (chunks.length + 1)) * 100);

            const summaryHtml = `<div style="margin-top: 40px; padding: 20px; text-align: center; font-family: monospace; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; page-break-inside: avoid;">
                <strong>Document Processing Complete</strong><br/>
                Total Words Processed: ${allWords.length}<br/>
                Total Chunks Generated: ${chunks.length}
            </div>`;

            const pdfRes = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ htmlContents: [...htmlContents, summaryHtml] })
            });

            if (!pdfRes.ok) {
                const err = await pdfRes.json();
                throw new Error(err.error || 'Failed to compile PDF');
            }

            const blob = await pdfRes.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                setPdfUrl(base64data);
                
                setProgress(100);
                setLogs(prev => [...prev, { id: Date.now() + Math.random(), message: `PDF is Ready! Displaying preview...`, type: 'success' }]);
                
                setTimeout(() => {
                    setActiveTab('preview');
                    setIsLoading(false);
                }, 1000);
            };
            reader.readAsDataURL(blob);

        } catch (error: any) {
            setLogs(prev => [...prev, { id: Date.now() + Math.random(), message: `Error: ${error.message}`, type: 'error' }]);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
            {/* Desktop Sidebar */}
            <nav className="hidden md:flex w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex-col items-start overflow-hidden shrink-0 z-50">
                <div className="p-4 font-bold text-2xl tracking-tighter text-blue-900 dark:text-blue-100 w-full text-left flex items-center justify-start gap-2">
                   <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">Z</div>
                   <span>ZeraNotes</span>
                </div>
                
                <div className="flex-1 w-full mt-8 flex flex-col gap-2 px-2">
                    <button 
                        onClick={() => setActiveTab('chat')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                    >
                        <MessageSquare size={20} className={activeTab === 'chat' ? 'text-blue-600 dark:text-blue-400' : ''} />
                        <span className="font-medium">Input Data</span>
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('preview')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'preview' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                    >
                        <FileText size={20} className={activeTab === 'preview' ? 'text-blue-600 dark:text-blue-400' : ''} />
                        <span className="font-medium">PDF Preview</span>
                    </button>
                </div>

                <div className="p-4 w-full border-t dark:border-gray-700 flex flex-col gap-1">
                    <button 
                        onClick={handleClearChat}
                        className="w-full flex items-center justify-start gap-3 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 transition-all font-medium"
                    >
                        <Trash2 size={20} />
                        <span>Clear Data</span>
                    </button>
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-full flex items-center justify-start gap-3 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-all font-medium"
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                    </button>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden pb-[70px] md:pb-0">
                {/* Mobile Top Bar */}
                <div className="md:hidden p-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex justify-between items-center z-10 shrink-0">
                    <div className="font-bold text-xl tracking-tighter text-blue-900 dark:text-blue-100 flex items-center gap-2">
                       <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm">Z</div>
                       <span>ZeraNotes</span>
                    </div>
                    <button onClick={handleClearChat} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full">
                        <Trash2 size={20} />
                    </button>
                </div>

                {activeTab === 'chat' ? (
                    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-2 md:p-4 h-full overflow-hidden">
                        <header className="shrink-0 mb-4 md:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2 px-2">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold tracking-tight">Generate Notes</h1>
                            </div>
                            <button 
                                onClick={handleGenerate}
                                disabled={currentInput.trim() === ''}
                                className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-full shadow-sm flex items-center gap-2 transition-all mt-2 sm:mt-0 whitespace-nowrap"
                            >
                                <Play size={16} className="fill-current" />
                                Generate Post-Mortem
                            </button>
                        </header>
                        
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-4 rounded-xl min-h-0">
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 space-y-4 animate-in fade-in duration-500">
                                    <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-300 dark:text-blue-400 shadow-sm">
                                        <FileText size={28} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-gray-600 dark:text-gray-300">No active process</h3>
                                        <p className="text-sm">Paste raw study material below and hit Generate.<br/>The AI will automatically chunk, process, and compile the PDF.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {logs.map((log) => (
                                        <div key={log.id} className="pt-2 pb-2">
                                            <div className={`p-4 rounded-2xl shadow-sm border text-sm leading-relaxed max-w-[85%] mr-auto flex items-start gap-3 break-words
                                                ${log.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-300' : 
                                                  log.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-300' : 
                                                  'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                                {log.type === 'info' && <Loader2 size={16} className="animate-spin mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                                                {log.type === 'success' && <div className="w-4 h-4 rounded-full bg-green-500 shrink-0 flex items-center justify-center mt-0.5"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>}
                                                {log.type === 'error' && <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />}
                                                <div>
                                                    <div className="font-semibold text-xs opacity-70 mb-1">System</div>
                                                    {log.message}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {pdfUrl && !isLoading && (
                                        <div className="pt-2 pb-2">
                                            <div className="p-4 rounded-2xl shadow-sm border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30 text-sm leading-relaxed max-w-[85%] mr-auto flex flex-col gap-3 break-words">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-4 h-4 rounded-full bg-blue-500 shrink-0 flex items-center justify-center mt-0.5">
                                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                    </div>
                                                    <div className="font-medium text-blue-900 dark:text-blue-200">
                                                        PDF generated successfully. Choose a file name to download.
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-blue-100 dark:border-gray-700">
                                                    <input
                                                        type="text"
                                                        value={pdfName}
                                                        onChange={(e) => setPdfName(e.target.value)}
                                                        placeholder="Chemistry"
                                                        className="flex-1 min-w-0 outline-none text-sm text-gray-800 dark:text-gray-200 bg-transparent"
                                                    />
                                                    <span className="text-gray-500 dark:text-gray-400 text-sm font-medium pr-1">.pdf</span>
                                                </div>
                                                <a
                                                    href={pdfUrl}
                                                    download={`${pdfName || 'Document'}.pdf`}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm transition-colors"
                                                >
                                                    <Download size={18} />
                                                    Download PDF
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="shrink-0 flex flex-col gap-1 mt-2 mx-2 z-20">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex items-end gap-2">
                                <textarea 
                                    value={currentInput}
                                    onChange={(e) => setCurrentInput(e.target.value)}
                                    placeholder="Paste raw text here and hit Generate..."
                                    className="flex-1 max-h-[160px] min-h-[44px] bg-transparent outline-none resize-none px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                                    onKeyDown={(e) => {
                                        if(e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGenerate();
                                        }
                                    }}
                                />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 text-right px-2 pb-2 mt-1">
                                {currentInput.length} chars • {currentInput.trim() ? currentInput.trim().split(/\s+/).length : 0} words
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 h-full relative">
                        {isLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 max-w-2xl mx-auto w-full">
                                <Loader2 size={48} className="animate-spin text-blue-600 dark:text-blue-400 mb-6" />
                                <h3 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-200 mb-6 text-center">Processing Document</h3>
                                
                                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 mb-6 overflow-hidden">
                                    <div 
                                        className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out" 
                                        style={{ width: `${Math.max(5, progress)}%` }}
                                    ></div>
                                </div>
                                <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700 h-64 overflow-y-auto p-4 flex flex-col space-y-3 font-mono text-xs max-h-[40vh]">
                                    {logs.map(log => (
                                        <div key={log.id} className={`flex items-start gap-2 ${
                                            log.type === 'error' ? 'text-red-600 dark:text-red-400' : 
                                            log.type === 'success' ? 'text-green-600 dark:text-green-400' : 
                                            'text-gray-600 dark:text-gray-400'
                                        }`}>
                                            <span className="opacity-50 shrink-0">[{new Date(log.id).toLocaleTimeString()}]</span>
                                            <span>{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : pdfUrl ? (
                            <div className="flex-1 relative flex flex-col pb-4 md:pb-0 h-full">
                                <div className="p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center shrink-0">
                                    <h2 className="font-bold text-gray-800 dark:text-gray-100">Your Document is Ready</h2>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-full pl-3 pr-1 py-1 w-full sm:w-auto">
                                        <input
                                            type="text"
                                            value={pdfName}
                                            onChange={(e) => setPdfName(e.target.value)}
                                            placeholder="Chemistry"
                                            className="bg-transparent outline-none text-sm text-gray-700 dark:text-gray-200 w-24 sm:w-32"
                                        />
                                        <span className="text-gray-400 text-sm font-medium mr-2">.pdf</span>
                                        <a 
                                            href={pdfUrl}
                                            download={`${pdfName || 'Document'}.pdf`}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 text-sm transition-colors whitespace-nowrap"
                                        >
                                            <Download size={16} />
                                            Download
                                        </a>
                                    </div>
                                </div>
                                {/* Mobile might struggle with iframe for PDF. Give clear download fallback */}
                                <div className="flex-1 p-2 bg-gray-200 dark:bg-gray-900 overflow-hidden relative">
                                    <iframe src={pdfUrl} className="w-full h-full border-none bg-white rounded-lg shadow-sm" />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none md:hidden bg-transparent">
                                        {/* On mobile, if iframe fails, they still have the big button at the top */}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-6 text-center">
                                <FileText size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
                                <p>No PDF generated yet. Go to the input data tab first.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex flex-row items-center justify-around h-16 z-50 px-2 select-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={() => setActiveTab('chat')}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'chat' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                    <MessageSquare size={22} className={activeTab === 'chat' ? 'fill-blue-50/50 dark:fill-blue-900/50' : ''} />
                    <span className="text-[10px] font-medium">Input Data</span>
                </button>
                
                <button 
                    onClick={() => setActiveTab('preview')}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'preview' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                    <FileText size={22} className={activeTab === 'preview' ? 'fill-blue-50/50 dark:fill-blue-900/50' : ''} />
                    <span className="text-[10px] font-medium">PDF Preview</span>
                </button>

                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex flex-col items-center justify-center w-full h-full gap-1 transition-all text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <Settings size={22} />
                    <span className="text-[10px] font-medium">Settings</span>
                </button>
            </nav>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4 tracking-tight dark:text-white">Configuration</h2>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Dark Theme</label>
                                <button 
                                    onClick={toggleTheme}
                                    className={`w-11 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>

                            <div className="pb-4 border-b dark:border-gray-700">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">API Provider</label>
                                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                    <button
                                        onClick={() => setApiProvider('google')}
                                        className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${apiProvider === 'google' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
                                    >Google AI Studio</button>
                                    <button
                                        onClick={() => setApiProvider('openrouter')}
                                        className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${apiProvider === 'openrouter' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
                                    >OpenRouter</button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                    {apiProvider === 'google' ? 'Google AI Studio API Key' : 'OpenRouter API Key'}
                                </label>
                                <input 
                                    type="password" 
                                    value={apiProvider === 'google' ? googleApiKey : openRouterApiKey}
                                    onChange={(e) => apiProvider === 'google' ? setGoogleApiKey(e.target.value) : setOpenRouterApiKey(e.target.value)}
                                    placeholder={apiProvider === 'google' ? 'AIzaSy...' : 'sk-or-v1-...'}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave blank to use environment default securely.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Model Selection</label>
                                {apiProvider === 'google' ? (
                                    <select 
                                        value={googleModel}
                                        onChange={(e) => setGoogleModel(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 dark:bg-gray-800"
                                    >
                                        <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fastest)</option>
                                        <option value="gemini-3.5-pro">Gemini 3.5 Pro (Powerful)</option>
                                        <option value="gemini-3.1-pro">Gemini 3.1 Pro (Deep Thought)</option>
                                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Efficient)</option>
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                        <option value="gemini-2.0-flash-lite-preview-02-05">Gemini 2.0 Flash Lite</option>
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        value={openRouterModel}
                                        onChange={(e) => setOpenRouterModel(e.target.value)}
                                        placeholder="e.g. anthropic/claude-3-haiku"
                                        className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 dark:bg-gray-800"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={saveSettings}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
