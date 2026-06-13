import React, { useState, useEffect } from 'react';

export default function ConceptReader({ db, activeChunkId, setActiveChunkId, setActiveTab, setQuizConfig }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});

  useEffect(() => {
    if (db && db.books && db.books.length > 0 && !selectedBookId) {
      setSelectedBookId(db.books[0].id);
      // Auto expand first book
      setExpandedBooks({ [db.books[0].id]: true });
    }
  }, [db]);

  const toggleBook = (bookId) => {
    setExpandedBooks(prev => ({ ...prev, [bookId]: !prev[bookId] }));
    setSelectedBookId(bookId);
    setSelectedChapter('');
  };

  const toggleChapter = (chapterKey) => {
    setExpandedChapters(prev => ({ ...prev, [chapterKey]: !prev[chapterKey] }));
    const [bookId, chapterName] = chapterKey.split('::');
    setSelectedBookId(bookId);
    setSelectedChapter(chapterName);
  };

  // Filter chunks based on search
  const filteredChunks = db.chunks ? db.chunks.filter(chunk => {
    const matchesSearch = chunk.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          chunk.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) : [];

  // Auto-expand books and chapters on search
  useEffect(() => {
    if (!searchTerm) return;
    
    const newExpandedBooks = {};
    const newExpandedChapters = {};
    
    filteredChunks.forEach(chunk => {
      newExpandedBooks[chunk.book_id] = true;
      newExpandedChapters[`${chunk.book_id}::${chunk.chapter}`] = true;
    });
    
    setExpandedBooks(prev => ({ ...prev, ...newExpandedBooks }));
    setExpandedChapters(prev => ({ ...prev, ...newExpandedChapters }));
  }, [searchTerm, filteredChunks]);

  // Get active chunk content
  const activeChunk = db.chunks ? db.chunks.find(c => c.id === activeChunkId) || (filteredChunks[0] || null) : null;

  // Group chapters for navigation
  const groupedStructure = {};
  if (db.books && db.chunks) {
    db.books.forEach(book => {
      const bookChunks = (searchTerm ? filteredChunks : db.chunks).filter(c => c.book_id === book.id);
      
      if (searchTerm && bookChunks.length === 0) return;

      groupedStructure[book.id] = {
        title: book.title,
        chapters: {}
      };
      
      bookChunks.forEach(chunk => {
        if (!groupedStructure[book.id].chapters[chunk.chapter]) {
          groupedStructure[book.id].chapters[chunk.chapter] = [];
        }
        groupedStructure[book.id].chapters[chunk.chapter].push(chunk);
      });
    });
  }

  const handleStartConceptQuiz = (chunk) => {
    setQuizConfig({ type: 'concept', id: chunk.id });
    setActiveTab('quiz');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', height: 'calc(100vh - 140px)' }}>
      
      {/* Left Navigation Tree */}
      <div className="lcars-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '15px', overflowY: 'auto' }}>
        <div className="lcars-panel-header" style={{ marginBottom: '10px' }}>
          <h3 className="lcars-panel-title" style={{ fontSize: '18px' }}>Concept Database</h3>
        </div>
        
        <input 
          type="text" 
          placeholder="SEARCH SYNAPSE DATABASE..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            backgroundColor: '#000',
            border: '2px solid var(--lcars-orange)',
            borderRadius: '5px',
            color: 'var(--lcars-gold)',
            fontFamily: 'var(--font-mono)',
            padding: '8px',
            marginBottom: '15px',
            width: '100%',
            outline: 'none'
          }}
        />

        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {db.books && db.books.map(book => {
            if (searchTerm && !groupedStructure[book.id]) return null;
            const isBookExpanded = expandedBooks[book.id];
            const bookChapters = groupedStructure[book.id]?.chapters || {};
            
            return (
              <div key={book.id} style={{ marginBottom: '8px' }}>
                {/* Book Row */}
                <div 
                  onClick={() => toggleBook(book.id)}
                  style={{
                    backgroundColor: selectedBookId === book.id ? '#1c1d28' : 'transparent',
                    borderLeft: `5px solid ${selectedBookId === book.id ? 'var(--lcars-gold)' : 'var(--lcars-darkblue)'}`,
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: selectedBookId === book.id ? 'var(--lcars-gold)' : 'var(--lcars-blue)',
                    padding: '6px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                    {book.title}
                  </span>
                  <span>{isBookExpanded ? '▼' : '▶'}</span>
                </div>

                {/* Chapters list under Book */}
                {isBookExpanded && (
                  <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                    {Object.keys(bookChapters).map(chapterName => {
                      const chapterKey = `${book.id}::${chapterName}`;
                      const isChapterExpanded = expandedChapters[chapterKey];
                      const chapterChunks = bookChapters[chapterName] || [];
                      
                      return (
                        <div key={chapterName} style={{ marginTop: '4px' }}>
                          <div 
                            onClick={() => toggleChapter(chapterKey)}
                            style={{
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: selectedChapter === chapterName && selectedBookId === book.id ? 'var(--lcars-orange)' : '#ccc',
                              padding: '4px 6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderBottom: '1px solid #1a1a24'
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                              {chapterName}
                            </span>
                            <span>{isChapterExpanded ? '▼' : '▶'}</span>
                          </div>

                          {/* Concepts list under Chapter */}
                          {isChapterExpanded && (
                            <div style={{ paddingLeft: '8px', borderLeft: '1px solid #333', marginTop: '2px' }}>
                              {chapterChunks.map(chunk => {
                                const isActive = activeChunk?.id === chunk.id;
                                return (
                                  <div 
                                    key={chunk.id}
                                    onClick={() => setActiveChunkId(chunk.id)}
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      color: isActive ? 'var(--lcars-peach)' : '#888',
                                      backgroundColor: isActive ? '#181212' : 'transparent',
                                      padding: '4px 8px',
                                      margin: '2px 0',
                                      borderRadius: '3px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={chunk.title}
                                  >
                                    {chunk.title}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Content Panel */}
      <div className="lcars-panel" style={{ height: '100%', overflowY: 'auto', padding: '25px', display: 'flex', flexDirection: 'column' }}>
        {activeChunk ? (
          <>
            {/* Header info */}
            <div className="lcars-panel-header" style={{ borderBottomColor: 'var(--lcars-orange)' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--lcars-blue)', fontFamily: 'var(--font-mono)' }}>
                  BOOK RESOURCE: {activeChunk.book_title}
                </span>
                <h2 className="lcars-panel-title" style={{ color: 'var(--lcars-gold)', marginTop: '5px' }}>
                  {activeChunk.title}
                </h2>
                <div style={{ color: '#aaa', fontSize: '13px', marginTop: '3px' }}>
                  Chapter: {activeChunk.chapter}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                <span className="lcars-badge peach">{activeChunk.difficulty}</span>
                <span className="lcars-panel-code" style={{ fontFamily: 'var(--font-mono)' }}>ID: {activeChunk.id}</span>
              </div>
            </div>

            {/* Badges for Tagged Concepts */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {activeChunk.tooling && activeChunk.tooling.map(tool => (
                <span key={tool} className="lcars-badge blue">{tool}</span>
              ))}
            </div>

            {/* Body text */}
            <div className="lcars-content-text" style={{ flexGrow: 1 }}>
              {activeChunk.content.split('\n\n').map((paragraph, pIdx) => {
                if (paragraph.trim()) {
                  return <p key={pIdx}>{paragraph.trim()}</p>;
                }
                return null;
              })}

              {/* Render code snippets */}
              {activeChunk.code && activeChunk.code.map((snippet, sIdx) => (
                <div key={sIdx} style={{ position: 'relative' }}>
                  <pre>
                    <code>{snippet}</code>
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(snippet)}
                    style={{
                      position: 'absolute',
                      top: '25px',
                      right: '15px',
                      backgroundColor: 'rgba(255,153,0,0.15)',
                      border: '1px solid var(--lcars-orange)',
                      borderRadius: '5px',
                      color: 'var(--lcars-orange)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      padding: '3px 8px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    COPY CODE
                  </button>
                </div>
              ))}
            </div>

            {/* Action footer */}
            <div style={{ borderTop: '2px solid var(--lcars-orange)', paddingTop: '15px', marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <button 
                className="lcars-button"
                onClick={() => handleStartConceptQuiz(activeChunk)}
              >
                Test Competency (Quiz)
              </button>
              
              <button 
                className="lcars-button secondary"
                onClick={() => setActiveTab('graph')}
              >
                View in Knowledge Graph
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ fontSize: '48px' }}>🖖</span>
            <h3 style={{ color: 'var(--lcars-gold)', marginTop: '20px' }}>HOLODECK DATABASE OFFLINE</h3>
            <p style={{ color: '#888', marginTop: '10px' }}>Select an active knowledge core from the left database tree to parse.</p>
          </div>
        )}
      </div>

    </div>
  );
}
