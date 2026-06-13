import React, { useState, useEffect } from 'react';

export default function Dashboard({ db, setActiveTab, setQuizConfig, llmStatus }) {
  const [stats, setStats] = useState({
    booksCount: 0,
    chunksCount: 0,
    quizzesCount: 0,
    completedQuizzes: 0,
    score: 0
  });

  useEffect(() => {
    if (db) {
      // Read progress from localStorage
      const completed = JSON.parse(localStorage.getItem('holodeck_completed_quizzes') || '[]');
      const score = parseInt(localStorage.getItem('holodeck_total_score') || '0', 10);
      
      setStats({
        booksCount: db.books ? db.books.length : 0,
        chunksCount: db.chunks ? db.chunks.length : 0,
        quizzesCount: db.quizzes ? db.quizzes.length : 0,
        completedQuizzes: completed.length,
        score: score
      });
    }
  }, [db]);

  const startQuickQuiz = () => {
    setQuizConfig({ type: 'all', id: null });
    setActiveTab('quiz');
  };

  const getRank = (score) => {
    if (score >= 500) return 'Captain';
    if (score >= 300) return 'Commander';
    if (score >= 150) return 'Lieutenant';
    if (score >= 50) return 'Lieutenant JG';
    if (score >= 10) return 'Ensign';
    return 'Cadet';
  };

  return (
    <div className="lcars-dashboard">
      <div className="lcars-grid-3">
        <div className="lcars-metric-box" style={{ borderColor: 'var(--lcars-gold)' }}>
          <span className="lcars-metric-label">System Library Core</span>
          <span className="lcars-metric-value">{stats.booksCount} Ebooks</span>
        </div>
        <div className="lcars-metric-box" style={{ borderColor: 'var(--lcars-orange)' }}>
          <span className="lcars-metric-label">Synaptic Concept Nodes</span>
          <span className="lcars-metric-value">{stats.chunksCount} Nodes</span>
        </div>
        <div className="lcars-metric-box" style={{ borderColor: 'var(--lcars-violet)' }}>
          <span className="lcars-metric-label">Simulations Active</span>
          <span className="lcars-metric-value">{stats.quizzesCount} Quizzes</span>
        </div>
      </div>

      <div className="lcars-grid-2" style={{ marginTop: '20px' }}>
        <div className="lcars-panel">
          <div className="lcars-panel-header">
            <h3 className="lcars-panel-title">Officer Learning Profile</h3>
            <span className="lcars-panel-code">SEC-8472</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Starfleet Rank:</span>
              <span className="lcars-badge gold" style={{ fontSize: '14px' }}>
                {getRank(stats.score)}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Total Synaptic Score:</span>
              <span className="lcars-badge peach" style={{ fontSize: '14px' }}>
                {stats.score} Points
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Quizzes Mastered:</span>
              <span className="lcars-badge blue" style={{ fontSize: '14px' }}>
                {stats.completedQuizzes} / {stats.quizzesCount}
              </span>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
              <button className="lcars-button" onClick={startQuickQuiz}>
                Launch Quiz Simulator
              </button>
              <button className="lcars-button secondary" onClick={() => setActiveTab('graph')}>
                Open Knowledge Graph
              </button>
            </div>
          </div>
        </div>

        <div className="lcars-panel">
          <div className="lcars-panel-header">
            <h3 className="lcars-panel-title">Holodeck Diagnostics</h3>
            <span className="lcars-panel-code">SYS-452-A</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--lcars-blue)' }}>SAFETY PROTOCOLS</span>
              <span style={{ color: 'var(--lcars-green)' }} className="blink">ONLINE / NOMINAL</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--lcars-blue)' }}>COGNITIVE INTERACTION BUFFER</span>
              <span style={{ color: 'var(--lcars-gold)' }}>98.7% CAPACITY</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--lcars-blue)' }}>LOCAL LLM CORE STATUS</span>
              <span style={{ 
                color: llmStatus.online ? 'var(--lcars-green)' : 'var(--lcars-peach)',
                fontWeight: 'bold'
              }}>
                {llmStatus.online ? `ONLINE (${llmStatus.type.toUpperCase()})` : 'OFFLINE'}
              </span>
            </div>

            {llmStatus.online && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderLeft: '3px solid var(--lcars-green)', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--lcars-blue)' }}>LOADED SYNAPSE CORES</span>
                <span style={{ color: 'var(--lcars-gold)', textAlign: 'right' }}>
                  {llmStatus.models.length > 0 ? llmStatus.models.join(' | ') : 'No models loaded'}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--lcars-blue)' }}>ACTIVE TOPICS INGESTED</span>
              <span style={{ color: 'var(--lcars-violet)' }}>MCP, CLAUDE CODE, OLLAMA, NEXT.JS, STRIPE</span>
            </div>

            <div style={{ borderTop: '1px solid #333', marginTop: '10px', paddingTop: '10px', fontSize: '13px', color: '#888' }}>
              SYSTEM INSTRUCTION: Verify local model endpoints (LM Studio on port 1234 or Ollama on port 11434) prior to running deep training sessions.
            </div>
          </div>
        </div>
      </div>

      <div className="lcars-panel" style={{ marginTop: '20px' }}>
        <div className="lcars-panel-header">
          <h3 className="lcars-panel-title">Ingested Knowledge Cores (Books)</h3>
          <span className="lcars-panel-code">LIB-01-08</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {db.books && db.books.map((book, idx) => {
            // Count chunks for this book
            const count = db.chunks ? db.chunks.filter(c => c.book_id === book.id).length : 0;
            return (
              <div 
                key={book.id} 
                className="lcars-panel" 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 20px', 
                  marginBottom: '5px',
                  backgroundColor: '#101118',
                  borderColor: idx % 2 === 0 ? 'var(--lcars-orange)' : 'var(--lcars-peach)'
                }}
              >
                <div>
                  <h4 style={{ color: 'var(--lcars-gold)', fontSize: '16px' }}>{book.title}</h4>
                  <span style={{ fontSize: '12px', color: '#888' }}>Creator: {book.author} | File: {book.file}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span className="lcars-badge blue">{count} concepts</span>
                  <button 
                    className="lcars-button secondary" 
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => {
                      setQuizConfig({ type: 'book', id: book.id });
                      setActiveTab('quiz');
                    }}
                  >
                    Test Book
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
