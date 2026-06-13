import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ConceptReader from './components/ConceptReader';
import KnowledgeGraph from './components/KnowledgeGraph';
import QuizEngine from './components/QuizEngine';
import IngestionTerminal from './components/IngestionTerminal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [llmStatus, setLlmStatus] = useState({ online: false, type: '', models: [] });
  
  // Quiz configuration
  const [quizConfig, setQuizConfig] = useState({ type: 'all', id: null });
  // Active chunk in reader
  const [activeChunkId, setActiveChunkId] = useState(null);

  const fetchDatabase = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/src/database.json');
      if (!response.ok) {
        throw new Error('Database file not initialized.');
      }
      const data = await response.json();
      setDb(data);
      if (data.chunks && data.chunks.length > 0) {
        setActiveChunkId(data.chunks[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  useEffect(() => {
    const checkLocalLLMs = async () => {
      // 1. Try LM Studio (port 1234 via Vite proxy)
      try {
        const res = await fetch('/llm-studio/v1/models');
        if (res.ok) {
          const data = await res.json();
          const models = data.data ? data.data.map(m => m.id.split('/').pop()) : [];
          setLlmStatus({ online: true, type: 'LM Studio', models });
          return;
        }
      } catch (e) {}

      // 2. Try Ollama (port 11434 via Vite proxy)
      try {
        const res = await fetch('/ollama/api/tags');
        if (res.ok) {
          const data = await res.json();
          const models = data.models ? data.models.map(m => m.name) : [];
          setLlmStatus({ online: true, type: 'Ollama', models });
          return;
        }
      } catch (e) {}

      setLlmStatus({ online: false, type: '', models: [] });
    };

    checkLocalLLMs();
    const interval = setInterval(checkLocalLLMs, 10000);
    return () => clearInterval(interval);
  }, []);

  const getSystemTime = () => {
    const d = new Date();
    return `STARDATE ${d.getFullYear() - 1900}.${Math.floor(d.getMonth() * 8.3)}.${d.getDate()}`;
  };

  return (
    <div className="lcars-container">
      
      {/* Sidebar LCARS Controls */}
      <div className="lcars-sidebar">
        
        {/* Top Elbow element */}
        <div className="lcars-elbow-top">
          <span className="lcars-sidebar-title">HOLODECK</span>
          <span className="lcars-sidebar-code">SYS-994</span>
        </div>
        
        {/* Nav Links */}
        <div className="lcars-nav-menu">
          <button 
            className={`lcars-nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            data-number="01"
            style={{ backgroundColor: 'var(--lcars-gold)' }}
          >
            Dashboard
          </button>
          
          <button 
            className={`lcars-nav-button ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
            data-number="02"
            style={{ backgroundColor: 'var(--lcars-blue)' }}
          >
            Synapse Graph
          </button>
          
          <button 
            className={`lcars-nav-button ${activeTab === 'reader' ? 'active' : ''}`}
            onClick={() => setActiveTab('reader')}
            data-number="03"
            style={{ backgroundColor: 'var(--lcars-orange)' }}
          >
            Concept Core
          </button>
          
          <button 
            className={`lcars-nav-button ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiz')}
            data-number="04"
            style={{ backgroundColor: 'var(--lcars-violet)' }}
          >
            Training Deck
          </button>
          
          <button 
            className={`lcars-nav-button ${activeTab === 'ingestion' ? 'active' : ''}`}
            onClick={() => setActiveTab('ingestion')}
            data-number="05"
            style={{ backgroundColor: 'var(--lcars-peach)' }}
          >
            Ingestion Link
          </button>
        </div>
        
        {/* Bottom Elbow element */}
        <div className="lcars-elbow-bottom">
          <span className="lcars-sidebar-footer">NCC-1701-E</span>
        </div>

      </div>

      {/* Header bar */}
      <div className="lcars-header">
        <h1 className="lcars-header-title">Enterprise Knowledge Core</h1>
        <div className="lcars-header-subtitle">
          <div>SECTOR 001 | MATRIX ACTIVE</div>
          <div>{getSystemTime()}</div>
        </div>
      </div>

      {/* Main Screen Content */}
      <div className="lcars-main">
        {loading ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ fontSize: '32px' }} className="blink">🖖</span>
            <h3 style={{ color: 'var(--lcars-gold)', marginTop: '20px', fontFamily: 'var(--font-mono)' }}>
              UPLINKING TO COGNITIVE CORES...
            </h3>
          </div>
        ) : error ? (
          <div className="lcars-panel" style={{ textAlign: 'center', margin: '40px', padding: '40px' }}>
            <h2 style={{ color: 'var(--lcars-red)' }}>DATABASE CORE LINK ERROR</h2>
            <p style={{ margin: '20px 0', color: '#ccc' }}>
              The Holodeck requires the databank to be parsed first.
            </p>
            <div style={{ margin: '25px 0' }}>
              <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--lcars-orange)', marginBottom: '10px' }}>
                Run this command in your repository terminal:
              </p>
              <pre style={{
                backgroundColor: '#000',
                border: '1px solid var(--lcars-orange)',
                borderRadius: '5px',
                color: 'var(--lcars-orange)',
                padding: '10px 15px',
                display: 'inline-block',
                fontFamily: 'var(--font-mono)'
              }}>
                python3 scripts/parse_epubs.py
              </pre>
            </div>
            <button className="lcars-button" onClick={fetchDatabase}>
              Retry Core Connection
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                db={db} 
                setActiveTab={setActiveTab} 
                setQuizConfig={setQuizConfig} 
                llmStatus={llmStatus}
              />
            )}
            
            {activeTab === 'reader' && (
              <ConceptReader 
                db={db} 
                activeChunkId={activeChunkId} 
                setActiveChunkId={setActiveChunkId}
                setActiveTab={setActiveTab}
                setQuizConfig={setQuizConfig}
              />
            )}
            
            {activeTab === 'graph' && (
              <KnowledgeGraph 
                db={db} 
                setActiveTab={setActiveTab} 
                setActiveChunkId={setActiveChunkId}
              />
            )}
            
            {activeTab === 'quiz' && (
              <QuizEngine 
                db={db} 
                quizConfig={quizConfig} 
                setQuizConfig={setQuizConfig}
                setActiveTab={setActiveTab}
                llmStatus={llmStatus}
              />
            )}
            
            {activeTab === 'ingestion' && (
              <IngestionTerminal 
                db={db} 
                reloadDb={fetchDatabase} 
                llmStatus={llmStatus}
              />
            )}
          </>
        )}
      </div>

      {/* Footer bar */}
      <div className="lcars-footer">
        <span>HOLODECK SIMULATOR STATUS: NOMINAL</span>
        <span>STARFLEET COMPUTER DATA TERMINAL SECURITY PROTOCOL ACTIVE</span>
      </div>

    </div>
  );
}
