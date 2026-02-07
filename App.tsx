import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_USER, DEFAULT_PASS, LOCAL_STORAGE_KEYS } from './constants';
import { PikPakService, VerificationError } from './services/pikpakService';
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

  // Captcha State
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [captchaSign, setCaptchaSign] = useState<string>(''); // The 'token' from init
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
      type: 'LOGIN' | 'ADD_MAGNET';
      args: any[];
  } | null>(null);


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

  // Generic Error Handler for Captcha
  const handleApiError = async (err: any, actionType: 'LOGIN' | 'ADD_MAGNET', args: any[]) => {
      if (err instanceof VerificationError) {
          console.log("Captcha required", err);
          setPendingAction({ type: actionType, args });
          // Initialize captcha
          try {
              setCaptchaLoading(true);
              setCaptchaOpen(true);
              // Small delay to ensure modal renders if needed, but mainly fetch data
              const initData = await PikPakService.initCaptcha();
              setCaptchaImage(initData.url);
              setCaptchaSign(initData.captcha_token);
              setCaptchaInput('');
              setError(null);
          } catch (initErr: any) {
              setError("Failed to load captcha: " + initErr.message);
              setCaptchaOpen(false);
          } finally {
              setCaptchaLoading(false);
          }
      } else {
          setError(err.message || "Operation failed");
      }
  };

  const handleLogin = async (e?: React.FormEvent, captchaToken?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await PikPakService.login(email, password, captchaToken);
      setToken(data.access_token);
      localStorage.setItem(LOCAL_STORAGE_KEYS.TOKEN, data.access_token);
      setCaptchaOpen(false); // Close modal if open
    } catch (err: any) {
      if (!captchaToken) {
          // Only handle captcha flow if we haven't already tried WITH a token
          // (prevents infinite loops if captcha is wrong)
          await handleApiError(err, 'LOGIN', [email, password]);
      } else {
          setError(err.message || "Login failed even with captcha");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMagnet = async (e?: React.FormEvent, captchaToken?: string) => {
    if (e) e.preventDefault();
    if (!token || !magnetLink) return;

    setLoading(true);
    setError(null);

    try {
      const result = await PikPakService.addMagnet(magnetLink, token, captchaToken);
      
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
      setCaptchaOpen(false);
    } catch (err: any) {
       if (!captchaToken) {
           await handleApiError(err, 'ADD_MAGNET', [magnetLink, token]);
       } else {
           setError(err.message || "Failed to add magnet with captcha");
       }
    } finally {
      setLoading(false);
    }
  };

  const submitCaptcha = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!captchaInput || !pendingAction) return;
      
      setCaptchaLoading(true);
      try {
          // 1. Verify the code
          const verifyData = await PikPakService.verifyCaptcha(captchaInput, captchaSign);
          const verificationToken = verifyData.verification_token;

          // 2. Retry pending action
          if (pendingAction.type === 'LOGIN') {
              await handleLogin(undefined, verificationToken);
          } else if (pendingAction.type === 'ADD_MAGNET') {
              // Usually magnet link needs re-input or state persistence? 
              // We have 'magnetLink' state, but ensure it wasn't cleared.
              // Actually, the args are saved in pendingAction.
              // Note: handleAddMagnet relies on `magnetLink` state and `token` state.
              // We should probably pass args explicitly to handleAddMagnet, but for now we rely on closure/state.
              // To be safe, let's update handleAddMagnet signature? 
              // Actually, simpler: just call handleAddMagnet(undefined, verificationToken)
              // It uses current state `magnetLink`. 
              await handleAddMagnet(undefined, verificationToken);
          }

      } catch (err: any) {
          setError("Captcha error: " + err.message);
          // Refresh captcha on error
          try {
             const initData = await PikPakService.initCaptcha();
             setCaptchaImage(initData.url);
             setCaptchaSign(initData.captcha_token);
             setCaptchaInput('');
          } catch (e) {
              setCaptchaOpen(false);
          }
      } finally {
          setCaptchaLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans relative">
      
      {/* Captcha Modal */}
      {captchaOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 max-w-sm w-full p-6 animate-fade-in">
                  <h3 className="text-xl font-bold mb-4 text-white">Security Check</h3>
                  <p className="text-gray-400 mb-4 text-sm">Please enter the code shown below to continue.</p>
                  
                  <div className="bg-white rounded p-2 mb-4 flex justify-center h-24 items-center">
                      {captchaImage ? (
                          <img src={captchaImage} alt="Captcha" className="max-h-full object-contain" />
                      ) : (
                          <span className="text-gray-500 text-sm">Loading image...</span>
                      )}
                  </div>
                  
                  <form onSubmit={submitCaptcha} className="space-y-4">
                      <input 
                          type="text" 
                          value={captchaInput}
                          onChange={(e) => setCaptchaInput(e.target.value)}
                          placeholder="Enter code"
                          className="w-full bg-gray-900 border border-gray-600 rounded px-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none text-center font-mono text-lg tracking-widest uppercase"
                          autoFocus
                      />
                      <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={() => {
                                setCaptchaOpen(false);
                                setCaptchaLoading(false);
                                setPendingAction(null);
                            }}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={captchaLoading || !captchaInput}
                            className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded transition-colors disabled:opacity-50"
                        >
                            {captchaLoading ? 'Verifying...' : 'Submit'}
                        </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-primary-500 tracking-tighter">MagnetPak</span>
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">v1.0.0</span>
            </div>
            {token && (
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
            )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {!token ? (
            <div className="flex items-center justify-center py-10">
                <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary-500 mb-2">Welcome Back</h1>
                    <p className="text-gray-400">Login to access your node.</p>
                  </div>
                  
                  <form onSubmit={(e) => handleLogin(e)} className="space-y-6">
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
        ) : (
            <>
                {/* Add Magnet Section */}
                <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                    <h2 className="text-lg font-semibold mb-4 flex items-center">
                        <MagnetIcon />
                        <span className="ml-2">Add Magnet Link</span>
                    </h2>
                    <form onSubmit={(e) => handleAddMagnet(e)} className="flex flex-col md:flex-row gap-4">
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
            </>
        )}
      </main>
    </div>
  );
}
