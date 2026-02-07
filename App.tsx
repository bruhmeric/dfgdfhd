import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_USER, DEFAULT_PASS, LOCAL_STORAGE_KEYS } from './constants';
import { PikPakService } from './services/pikpakService';
import { TaskStatus, PikPakFile } from './types';

// Icons
const MagnetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magnetLink, setMagnetLink] = useState('');
  const [myFiles, setMyFiles] = useState<TaskStatus[]>([]);
  
  // Login State
  const [email, setEmail] = useState(DEFAULT_USER);
  const [password, setPassword] = useState(DEFAULT_PASS);

  // Load My Files from Local Storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.MY_FILES);
    if (saved) {
      try {
        setMyFiles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved files", e);
      }
    }
  }, []);

  // Save My Files to Local Storage whenever changed
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.MY_FILES, JSON.stringify(myFiles));
  }, [myFiles]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await PikPakService.login(email, password);
      setToken(data.access_token);
      localStorage.setItem(LOCAL_STORAGE_KEYS.TOKEN, data.access_token);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMagnet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !magnetLink) return;

    setLoading(true);
    setError(null);

    try {
      const result = await PikPakService.addMagnet(magnetLink, token);
      
      const newTask: TaskStatus = {
        id: result.task.id,
        fileId: result.task.file_id,
        name: result.task.file_name || result.task.name || "Unknown File",
        status: 'pending',
        progress: 0,
        magnet: magnetLink,
        timestamp: Date.now()
      };

      setMyFiles(prev => [newTask, ...prev]);
      setMagnetLink('');
    } catch (err: any) {
      setError(err.message || "Failed to add magnet");
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = useCallback(async (task: TaskStatus) => {
      if (!token) return task;
      
      // If complete and has fileId, we might want to refresh file details or just leave it
      if (task.status === 'complete' && task.fileId) {
          return task; 
      }

      try {
          const statusData = await PikPakService.getTaskStatus(task.id, token);
          const phase = statusData.task.phase;
          const progress = statusData.task.progress;
          
          let newStatus: TaskStatus['status'] = 'downloading';
          if (phase === 'PHASE_TYPE_COMPLETE') newStatus = 'complete';
          if (phase === 'PHASE_TYPE_ERROR') newStatus = 'error';

          return {
              ...task,
              status: newStatus,
              progress: progress,
              fileId: statusData.task.file_id || task.fileId,
              name: statusData.task.file_name || statusData.task.name || task.name
          };
      } catch (e) {
          console.error("Error updating task", e);
          return task;
      }
  }, [token]);

  const refreshAllFiles = async () => {
      if (!token) return;
      setLoading(true);
      const updatedTasks = await Promise.all(myFiles.map(updateTaskStatus));
      setMyFiles(updatedTasks);
      setLoading(false);
  };

  // Poll for updates on pending/downloading tasks
  useEffect(() => {
      if (!token) return;
      const interval = setInterval(async () => {
          setMyFiles(currentFiles => {
              const needsUpdate = currentFiles.some(f => f.status === 'pending' || f.status === 'downloading');
              if (!needsUpdate) return currentFiles;
              
              // We can't use async in setState easily without a wrapper, 
              // but for simplicity in this structure, we trigger a side effect or separate the polling logic.
              // To avoid complexity, we'll just trigger a manual refresh logic here:
              return currentFiles;
          });
          
          // Actually perform the update
          const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.MY_FILES) || '[]');
          const toUpdate = current.filter((f: TaskStatus) => f.status !== 'complete' && f.status !== 'error');
          
          if (toUpdate.length > 0) {
             Promise.all(toUpdate.map((t: TaskStatus) => updateTaskStatus(t))).then(updates => {
                 setMyFiles(prev => prev.map(p => {
                     const updated = updates.find((u: TaskStatus) => u.id === p.id);
                     return updated || p;
                 }));
             });
          }

      }, 5000);
      return () => clearInterval(interval);
  }, [token, updateTaskStatus]);


  // When a task completes, we need to fetch the Web Link (download link) if not already present.
  // Actually, PikPak tasks don't return the web_content_link directly. We need to fetch file details.
  const [fileDetails, setFileDetails] = useState<Record<string, PikPakFile>>({});

  const fetchFileDetail = async (fileId: string) => {
      if (!token || fileDetails[fileId]) return;
      try {
          const file = await PikPakService.getFile(fileId, token);
          setFileDetails(prev => ({ ...prev, [fileId]: file }));
      } catch (e) {
          console.error("Could not fetch file details for " + fileId);
      }
  };

  const removeTask = (taskId: string) => {
      setMyFiles(prev => prev.filter(t => t.id !== taskId));
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-500 mb-2">MagnetPak</h1>
            <p className="text-gray-400">Login to your centralized node.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Initialize Session'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-primary-500 tracking-tighter">MagnetPak</span>
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">v1.0.0</span>
            </div>
            <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400 hidden sm:block">{email}</span>
                <button 
                    onClick={() => {
                        setToken(null);
                        localStorage.removeItem(LOCAL_STORAGE_KEYS.TOKEN);
                    }}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                    Logout
                </button>
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Add Magnet Section */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
                <MagnetIcon />
                <span className="ml-2">Add Magnet Link</span>
            </h2>
            <form onSubmit={handleAddMagnet} className="flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="magnet:?xt=urn:btih:..."
                    value={magnetLink}
                    onChange={(e) => setMagnetLink(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder-gray-500"
                />
                <button 
                    type="submit"
                    disabled={!magnetLink || loading}
                    className="bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 px-8 rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {loading ? 'Processing...' : 'Start Download'}
                </button>
            </form>
            {error && (
                <div className="mt-4 text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900/30">
                    Error: {error}
                </div>
            )}
        </section>

        {/* File List */}
        <section>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">My Downloads</h2>
                <button 
                    onClick={refreshAllFiles}
                    className="p-2 text-gray-400 hover:text-white transition-colors bg-gray-800 rounded hover:bg-gray-700 border border-gray-700"
                    title="Refresh Status"
                >
                    <RefreshIcon spinning={loading} />
                </button>
            </div>

            {myFiles.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
                    <p className="text-gray-500">No downloads active. Add a magnet link above.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {myFiles.map(task => {
                        const file = task.fileId ? fileDetails[task.fileId] : null;
                        
                        // Auto fetch file details if complete and missing
                        if (task.status === 'complete' && task.fileId && !file) {
                            fetchFileDetail(task.fileId);
                        }

                        return (
                            <div key={task.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-gray-600">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-white truncate pr-4" title={task.name}>
                                        {task.name}
                                    </h3>
                                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-400">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide
                                            ${task.status === 'complete' ? 'bg-green-900/30 text-green-400' : ''}
                                            ${task.status === 'downloading' ? 'bg-blue-900/30 text-blue-400' : ''}
                                            ${task.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' : ''}
                                            ${task.status === 'error' ? 'bg-red-900/30 text-red-400' : ''}
                                        `}>
                                            {task.status} {task.status === 'downloading' && `${task.progress}%`}
                                        </span>
                                        {file && <span>{PikPakService.formatBytes(file.size)}</span>}
                                        <span className="text-gray-600 text-xs">{new Date(task.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    {task.status === 'downloading' && (
                                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-3 overflow-hidden">
                                            <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }}></div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                                    {task.status === 'complete' && file && file.web_content_link && (
                                        <a 
                                            href={file.web_content_link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors shadow-lg shadow-green-900/20"
                                        >
                                            <DownloadIcon />
                                            <span>Direct Download</span>
                                        </a>
                                    )}
                                    
                                    <button 
                                        onClick={() => removeTask(task.id)}
                                        className="p-2 text-gray-500 hover:text-red-400 transition-colors hover:bg-red-900/10 rounded"
                                        title="Remove from history"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>

      </main>
    </div>
  );
}
