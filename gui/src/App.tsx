import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'manual'
  const [activePreset, setActivePreset] = useState('Загрузка...');
  const [allPresets, setAllPresets] = useState<string[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [notification, setNotification] = useState<{message: string, isError: boolean} | null>(null);
  const [showAutoSetupModal, setShowAutoSetupModal] = useState(false);
  const [selectedTestMode, setSelectedTestMode] = useState<'all' | 'custom'>('all');
  const [selectedTestPresets, setSelectedTestPresets] = useState<string[]>([]);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [isPowerToggling, setIsPowerToggling] = useState(false);
  const [autoSetupLog, setAutoSetupLog] = useState<string>('');
  const autoSetupRef = useRef<HTMLPreElement>(null);
  
  const [logsList, setLogsList] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const terminalRef = useRef<HTMLPreElement>(null);

  const showNotification = (message: string, isError = false) => {
    setNotification({ message, isError });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchPreset = async () => {
    try {
      const preset = await invoke<string>('get_active_preset');
      setActivePreset(preset);
      const presets = await invoke<string[]>('get_all_presets');
      setAllPresets(presets);
    } catch (e) {
      console.error(e);
      setActivePreset('01_Default');
    }
  };

  const checkStatus = async () => {
    try {
      const status = await invoke<boolean>('check_proxy_status');
      setIsConnected(status);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPreset();
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogsList = async () => {
    try {
      const logs = await invoke<string[]>('get_logs_list');
      setLogsList(logs);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogContent = async () => {
    if (!selectedLog) return;
    try {
      const content = await invoke<string>('read_log_file', { name: selectedLog });
      setLogContent(content);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogsList();
      const interval = setInterval(() => {
        fetchLogsList();
        fetchLogContent();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedLog]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logContent]);

  const handleConnect = async () => {
    if (isPowerToggling) return;
    setIsPowerToggling(true);
    try {
      if (!isConnected) {
        await invoke('start_proxy');
        setIsConnected(true);
      } else {
        await invoke('stop_proxy');
        setIsConnected(false);
      }
    } catch (e) {
      console.error("Ошибка переключения прокси:", e);
      showNotification("Ошибка: " + e, true);
    } finally {
      setIsPowerToggling(false);
    }
  };

  const executeCommand = async (cmd: string) => {
    if (runningCommand) return;
    console.log("Executing:", cmd);
    setRunningCommand(cmd);
    
    if (cmd.startsWith('auto-setup')) {
      setAutoSetupLog('Запуск умного авто-подбора...\n');
    } else if (cmd === 'update-lists') {
      setAutoSetupLog('Запуск обновления списков...\n');
    }
    
    try {
      showNotification(`Запуск: ${cmd}...`);
      if (cmd === 'stop-proxy') {
        await invoke('stop_proxy');
      } else {
        await invoke('execute_script', { command: cmd });
      }
      showNotification("Успешно выполнено!");
      
      // Обновляем пресет, если выполнялся авто-сетап
      if (cmd.startsWith('auto-setup')) {
         setTimeout(fetchPreset, 1000);
      }
    } catch (e: any) {
      console.error("Ошибка выполнения команды:", e);
      // Если прервали, не показываем как ошибку (если не хотим)
      if (e.toString().includes("Aborted") || e.toString().includes("Failed")) {
         showNotification("Отменено / Завершено с ошибкой", true);
      } else {
         showNotification("Ошибка: " + e, true);
      }
    } finally {
      setRunningCommand(null);
    }
  };

  const abortAutoSetup = async () => {
    try {
      showNotification("Останавливаем...");
      await invoke('abort_auto_setup');
    } catch (e) {
      console.error("Failed to abort:", e);
    }
  };

  useEffect(() => {
    if (runningCommand?.startsWith('auto-setup') || runningCommand === 'update-lists') {
      const interval = setInterval(async () => {
        try {
          const logs = await invoke<string[]>('get_logs_list');
          const filePrefix = runningCommand?.startsWith('auto-setup') ? 'auto-setup' : 'update-lists';
          const commandLogFile = logs.find(l => l.includes(filePrefix));
          if (commandLogFile) {
            const content = await invoke<string>('read_log_file', { name: commandLogFile });
            setAutoSetupLog(content);
            if (autoSetupRef.current) {
              autoSetupRef.current.scrollTop = autoSetupRef.current.scrollHeight;
            }
          }
        } catch (e) {}
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [runningCommand]);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {notification && (
        <div className={`toast-notification ${notification.isError ? 'error' : ''} fade-in`}>
          {notification.message}
        </div>
      )}

      {/* Top Header */}
      <div className="header">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          Zapret2
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {activeTab === 'connect' && (
          <div className="tab-connect fade-in">
            {showPresetMenu && (
              <div className="preset-modal-overlay" onClick={() => setShowPresetMenu(false)}>
                <div className="preset-modal fade-in" onClick={e => e.stopPropagation()}>
                  <div className="preset-modal-header">
                    <h3>Выберите пресет</h3>
                    <button className="close-btn" onClick={() => setShowPresetMenu(false)}>✕</button>
                  </div>
                  <div className="preset-list">
                    {allPresets.map(p => (
                      <div 
                        key={p} 
                        className={`preset-item ${p === activePreset ? 'selected' : ''}`}
                        onClick={async () => {
                          try {
                            await invoke('set_active_preset', { name: p });
                            setActivePreset(p);
                            setShowPresetMenu(false);
                            showNotification("Пресет изменен на " + p);
                            
                            // Автоматический перезапуск если прокси уже работает
                            if (isConnected) {
                               await invoke('stop_proxy');
                               setTimeout(() => invoke('start_proxy'), 500);
                            }
                          } catch (e) {
                            showNotification("Ошибка: " + e, true);
                          }
                        }}
                      >
                        {p}
                        {p === activePreset && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="status-badge">
              <div className={`status-dot ${isConnected ? 'active' : ''}`}></div>
              {isConnected ? 'Защита включена' : 'Защита выключена'}
            </div>

            <div className="power-btn-container">
              <button 
                className={`power-button ${isConnected ? 'on' : 'off'}`} 
                onClick={handleConnect}
                disabled={isPowerToggling}
              >
                {isPowerToggling ? (
                  <div className="spinner"></div>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                    <line x1="12" y1="2" x2="12" y2="12"></line>
                  </svg>
                )}
              </button>
            </div>

            <div className="active-preset-box interactive" onClick={() => setShowPresetMenu(true)} title="Нажмите, чтобы выбрать пресет">
              <div className="preset-label">ТЕКУЩИЙ ПРЕСЕТ</div>
              <div className="preset-value">
                {activePreset}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="tab-manual fade-in">
            <h2 className="tab-title">Ручная настройка</h2>
            <p className="tab-desc">Управление службами и скриптами</p>

            {runningCommand === 'auto-setup' || runningCommand === 'update-lists' ? (
              <div className="auto-setup-progress fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: '10px' }}>
                <div className="logs-header-controls" style={{ marginBottom: '10px' }}>
                  <h3 style={{ flex: 1, margin: 0, fontSize: '14px' }}>
                    {runningCommand === 'auto-setup' ? 'Идет авто-подбор пресетов...' : 'Идет обновление списков...'}
                  </h3>
                  <button className="clear-logs-btn" onClick={abortAutoSetup}>Остановить (Ctrl+C)</button>
                </div>
                <div className="logs-terminal" style={{ margin: 0 }}>
                  <pre className="terminal-content" ref={autoSetupRef}>
                    {autoSetupLog || 'Запуск...'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="action-list">
              <div className={`action-card ${runningCommand !== null ? 'disabled' : ''}`} onClick={() => setShowAutoSetupModal(true)}>
                <div className="action-icon">
                  {runningCommand !== null ? <div className="spinner"></div> : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                  )}
                </div>
                <div className="action-text">
                  <h3>Умный авто-подбор</h3>
                  <span>Тест всех пресетов и выбор лучшего</span>
                </div>
              </div>

              <div className={`action-card ${runningCommand !== null ? 'disabled' : ''}`} onClick={() => executeCommand('install-service')}>
                <div className="action-icon">
                  {runningCommand !== null ? <div className="spinner"></div> : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  )}
                </div>
                <div className="action-text">
                  <h3>Установить автозапуск</h3>
                  <span>Скрытый запуск вместе с Windows</span>
                </div>
              </div>

              <div className={`action-card ${runningCommand !== null ? 'disabled' : ''}`} onClick={() => executeCommand('remove-service')}>
                <div className="action-icon">
                  {runningCommand !== null ? <div className="spinner"></div> : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  )}
                </div>
                <div className="action-text">
                  <h3>Удалить автозапуск</h3>
                  <span>Удаление службы из системы</span>
                </div>
              </div>

              <div className={`action-card ${runningCommand !== null ? 'disabled' : ''}`} onClick={() => executeCommand('update-lists')}>
                <div className="action-icon">
                  {runningCommand !== null ? <div className="spinner"></div> : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6"></path>
                      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                      <path d="M3 22v-6h6"></path>
                      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                    </svg>
                  )}
                </div>
                <div className="action-text">
                  <h3>Обновить списки</h3>
                  <span>Скачать свежие базы доменов</span>
                </div>
              </div>

              <div className={`action-card ${runningCommand !== null ? 'disabled' : ''}`} onClick={() => executeCommand('stop-proxy')}>
                <div className="action-icon">
                  {runningCommand !== null ? <div className="spinner"></div> : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                    </svg>
                  )}
                </div>
                <div className="action-text">
                  <h3>Остановить процесс</h3>
                  <span>Принудительно закрыть winws2.exe</span>
                </div>
              </div>
              
              {/* Auto-setup Modal */}
              {showAutoSetupModal && (
                <div className="preset-modal-overlay" onClick={() => setShowAutoSetupModal(false)}>
                  <div className="preset-modal fade-in" onClick={e => e.stopPropagation()}>
                    <div className="preset-modal-header">
                      <h3>Умный авто-подбор</h3>
                      <button className="close-btn" onClick={() => setShowAutoSetupModal(false)}>✕</button>
                    </div>
                    
                    <div style={{ padding: '15px 15px 10px 15px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="radio" style={{ accentColor: 'var(--accent)' }} checked={selectedTestMode === 'all'} onChange={() => setSelectedTestMode('all')} />
                        Все стратегии ({allPresets.length} шт.)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="radio" style={{ accentColor: 'var(--accent)' }} checked={selectedTestMode === 'custom'} onChange={() => {
                           setSelectedTestMode('custom');
                           setSelectedTestPresets([...allPresets]);
                        }} />
                        На выбор
                      </label>
                    </div>

                    {selectedTestMode === 'custom' && (
                      <div className="preset-list" style={{ maxHeight: '250px', margin: '0 10px', fontSize: '14px' }}>
                        {allPresets.map(p => (
                          <div 
                            key={p} 
                            className="preset-item"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px' }}
                            onClick={() => {
                              if (selectedTestPresets.includes(p)) {
                                 setSelectedTestPresets(selectedTestPresets.filter(x => x !== p));
                              } else {
                                 setSelectedTestPresets([...selectedTestPresets, p]);
                              }
                            }}
                          >
                            <span>{p}</span>
                            <input type="checkbox" style={{ accentColor: 'var(--accent)', transform: 'scale(1.1)' }} checked={selectedTestPresets.includes(p)} readOnly />
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ padding: '15px' }}>
                      <button 
                        className="primary-button" 
                        style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600' }}
                        disabled={selectedTestMode === 'custom' && selectedTestPresets.length === 0}
                        onClick={() => {
                          setShowAutoSetupModal(false);
                          if (selectedTestMode === 'all') {
                             executeCommand('auto-setup');
                          } else {
                             executeCommand('auto-setup|' + selectedTestPresets.join(','));
                          }
                        }}
                      >
                        Начать тестирование
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'logs' && (
          <div className="tab-logs fade-in">
            <h2 className="tab-title">Терминал (Логи)</h2>
            <div className="logs-container">
              <div className="logs-header-controls">
                <select 
                  className="log-select" 
                  value={selectedLog || ''} 
                  onChange={(e) => {
                    setSelectedLog(e.target.value);
                    setLogContent('Загрузка...');
                    fetchLogContent();
                  }}
                >
                  <option value="" disabled>Выберите лог-файл...</option>
                  {logsList.map(log => (
                    <option key={log} value={log}>{log}</option>
                  ))}
                </select>
                <button className="clear-logs-btn" onClick={async () => {
                  try {
                    await invoke('clear_all_logs');
                    setLogsList([]);
                    setSelectedLog(null);
                    setLogContent('');
                    showNotification("Все логи очищены");
                  } catch (e) {
                    showNotification("Ошибка: " + e, true);
                  }
                }}>Очистить</button>
              </div>
              <div className="logs-terminal">
                {selectedLog ? (
                  <pre className="terminal-content" ref={terminalRef}>
                    {logContent || 'Файл пуст или загружается...'}
                  </pre>
                ) : (
                  <div className="terminal-placeholder">Выберите лог в меню выше</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="bottom-nav">
        <button 
          className={`nav-btn ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => setActiveTab('connect')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Подключение</span>
        </button>
        <button 
          className={`nav-btn ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>Настройки</span>
        </button>
        <button 
          className={`nav-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span>Логи</span>
        </button>
      </div>
    </div>
  );
}

export default App;
