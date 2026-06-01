import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'manual'

  const handleConnect = async () => {
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
      alert("Ошибка: " + e);
    }
  };

  const executeCommand = async (cmd: string) => {
    console.log("Executing:", cmd);
    try {
      await invoke('execute_script', { command: cmd });
      alert("Команда " + cmd + " успешно выполнена!");
    } catch (e) {
      console.error("Ошибка выполнения команды:", e);
      alert("Ошибка: " + e);
    }
  };

  return (
    <div className="app-container">
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
            <div className="status-badge">
              <div className={`status-dot ${isConnected ? 'active' : ''}`}></div>
              {isConnected ? 'Защита включена' : 'Защита выключена'}
            </div>

            <div className="power-btn-container">
              <button 
                className={`power-button ${isConnected ? 'on' : 'off'}`} 
                onClick={handleConnect}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
              </button>
            </div>

            <div className="active-preset-box">
              <div className="preset-label">ТЕКУЩИЙ ПРЕСЕТ</div>
              <div className="preset-value">
                11_General_ALT10
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

            <div className="action-list">
              <div className="action-card" onClick={() => executeCommand('auto-setup')}>
                <div className="action-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </div>
                <div className="action-text">
                  <h3>Умный авто-подбор</h3>
                  <span>Тест всех пресетов и выбор лучшего</span>
                </div>
              </div>

              <div className="action-card" onClick={() => executeCommand('install-service')}>
                <div className="action-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div className="action-text">
                  <h3>Установить автозапуск</h3>
                  <span>Скрытый запуск вместе с Windows</span>
                </div>
              </div>

              <div className="action-card" onClick={() => executeCommand('remove-service')}>
                <div className="action-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <div className="action-text">
                  <h3>Удалить автозапуск</h3>
                  <span>Удаление службы из системы</span>
                </div>
              </div>

              <div className="action-card" onClick={() => executeCommand('update-lists')}>
                <div className="action-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6"></path>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                    <path d="M3 22v-6h6"></path>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                  </svg>
                </div>
                <div className="action-text">
                  <h3>Обновить списки</h3>
                  <span>Скачать свежие базы доменов</span>
                </div>
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
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Настройки</span>
        </button>
      </div>
    </div>
  );
}

export default App;
