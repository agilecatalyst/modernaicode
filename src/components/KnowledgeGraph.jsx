import React, { useRef, useEffect, useState } from 'react';

export default function KnowledgeGraph({ db, setActiveTab, setActiveChunkId }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const nodesRef = useRef([]);
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [relatedChunks, setRelatedChunks] = useState([]);
  const [selectedBookFilter, setSelectedBookFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [collapsedBooks, setCollapsedBooks] = useState(() => {
    const initial = {};
    if (db && db.books) {
      db.books.forEach(b => {
        initial[b.id] = true;
      });
    }
    return initial;
  });
  
  const toggleBookCollapse = (bookId) => {
    setCollapsedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };
  
  // Simulation parameters
  const kRepel = 1200;
  const kAttract = 0.05;
  const kCenter = 0.01;
  const friction = 0.85;
  
  useEffect(() => {
    if (!db || !db.graph || !db.graph.nodes) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = Math.max(500, window.innerHeight - 300);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize node positions randomly around the center once
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    
    if (nodesRef.current.length === 0) {
      nodesRef.current = db.graph.nodes.map(n => ({
        ...n,
        x: cx + (Math.random() - 0.5) * 300,
        y: cy + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
        radius: n.type === 'book' ? 18 : 12,
        visible: true,
        collapsed: false
      }));
    }
    
    const nodes = nodesRef.current;

    // Build lookup map for fast link calculations
    const nodeMap = {};
    nodes.forEach(n => {
      nodeMap[n.id] = n;
    });

    const links = db.graph.links
      .map(l => ({
        source: nodeMap[l.source],
        target: nodeMap[l.target],
        value: l.value
      }))
      .filter(l => l.source && l.target); // filter out broken links

    let draggedNode = null;
    let hoverNode = null;
    let offset = { x: 0, y: 0 };
    
    // Animation loop
    let alpha = 1.0;
    let animationId;
    const updateSimulation = () => {
      const curCx = canvas.width / 2;
      const curCy = canvas.height / 2;

      // Keep alpha warm while actively dragging a node
      if (draggedNode) {
        alpha = 1.0;
      }

      // 0. Update visibility and targets dynamically based on active filters and collapsed parent books
      nodes.forEach(n => {
        let visible = true;
        
        // Book Filter
        if (selectedBookFilter !== 'all') {
          if (n.type === 'book') {
            visible = (n.id === selectedBookFilter);
          } else {
            // Check if concept is linked to the selected book
            const isLinked = db.graph.links.some(l => 
              (l.source === selectedBookFilter && l.target === n.id) ||
              (l.target === selectedBookFilter && l.source === n.id)
            );
            visible = isLinked;
          }
        }
        
        // Difficulty Filter
        if (visible && difficultyFilter !== 'all' && n.type === 'concept') {
          const hasDifficulty = db.chunks.some(c => 
            c.tooling.includes(n.id) && c.difficulty === difficultyFilter
          );
          visible = hasDifficulty;
        } else if (visible && difficultyFilter !== 'all' && n.type === 'book') {
          const hasDifficulty = db.chunks.some(c => 
            c.book_id === n.id && c.difficulty === difficultyFilter
          );
          visible = hasDifficulty;
        }

        // Collapsed status checking
        let collapsed = false;
        let parentBookNode = null;
        if (n.type === 'concept') {
          const linkedBooks = db.graph.links
            .filter(l => (l.source === n.id || l.target === n.id))
            .map(l => l.source === n.id ? l.target : l.source)
            .filter(id => {
              const targetNode = nodes.find(node => node.id === id);
              return targetNode && targetNode.type === 'book';
            });
            
          if (linkedBooks.length > 0) {
            const collapsedParentId = linkedBooks.find(bookId => collapsedBooks[bookId]);
            if (collapsedParentId) {
              collapsed = true;
              parentBookNode = nodes.find(node => node.id === collapsedParentId);
            }
          }
        }
        
        n.visible = visible;
        n.collapsed = collapsed;
        
        if (!visible) {
          n.radius = Math.max(0, n.radius - 1.5);
          if (n.radius > 0) alpha = Math.max(alpha, 0.1);
        } else if (collapsed && parentBookNode) {
          n.radius = Math.max(0, n.radius - 1.5);
          n.vx += (parentBookNode.x - n.x) * 0.15;
          n.vy += (parentBookNode.y - n.y) * 0.15;
          if (n.radius > 0) alpha = Math.max(alpha, 0.1);
        } else {
          const targetRadius = n.type === 'book' ? 18 : 12;
          if (n.radius < targetRadius) {
            n.radius = Math.min(targetRadius, n.radius + 1.5);
            // Re-heat simulation slightly to let expanding nodes slide into position smoothly
            alpha = Math.max(alpha, 0.1);
          }
        }
      });

      // Apply forces only when simulation is warm
      if (alpha > 0.005) {
        // 1. Repel nodes & apply Collide physics (only if visible and not collapsed)
        for (let i = 0; i < nodes.length; i++) {
          const n1 = nodes[i];
          if (!n1.visible || n1.collapsed) continue;
          
          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            if (!n2.visible || n2.collapsed) continue;
            
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Collide physics (push apart if overlapping)
            const minDist = n1.radius + n2.radius + 15;
            if (dist < minDist) {
              const overlap = minDist - dist;
              const fx = (dx / dist) * overlap * 0.25;
              const fy = (dy / dist) * overlap * 0.25;
              n1.vx -= fx * alpha;
              n1.vy -= fy * alpha;
              n2.vx += fx * alpha;
              n2.vy += fy * alpha;
            }
            
            if (dist < 300) {
              // Repulsion force
              const force = kRepel / (dist * dist);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              n1.vx -= fx * alpha;
              n1.vy -= fy * alpha;
              n2.vx += fx * alpha;
              n2.vy += fy * alpha;
            }
          }
        }

        // 2. Attract linked nodes (only if visible and not collapsed)
        links.forEach(link => {
          const n1 = link.source;
          const n2 = link.target;
          if (!n1.visible || !n2.visible || n1.collapsed || n2.collapsed) return;
          
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Target spring distance
          const targetDist = n1.type === 'book' || n2.type === 'book' ? 120 : 80;
          const diff = dist - targetDist;
          const force = diff * kAttract;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          n1.vx += fx * alpha;
          n1.vy += fy * alpha;
          n2.vx -= fx * alpha;
          n2.vy -= fy * alpha;
        });

        // 3. Gravity/Center pull
        nodes.forEach(n => {
          if (n === draggedNode) return;
          
          if (n.visible) {
            n.vx += (curCx - n.x) * kCenter * alpha;
            n.vy += (curCy - n.y) * kCenter * alpha;
          }
          
          // Apply velocity & friction
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= friction;
          n.vy *= friction;
        });

        // Decay the simulation alpha decay factor
        alpha *= 0.982;
      } else {
        // Freeze velocity entirely
        nodes.forEach(n => {
          n.vx = 0;
          n.vy = 0;
        });
      }

      // 4. Render Canvas (always clear and redraw so drags and cursor hover work even when static)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw links (only if both nodes are visible and not collapsed)
      ctx.strokeStyle = '#1a3366';
      ctx.lineWidth = 1.5;
      links.forEach(link => {
        if (!link.source.visible || !link.target.visible || link.source.collapsed || link.target.collapsed) return;
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.stroke();
      });

      // Draw nodes (only if visible and radius > 0 for smooth transitions)
      nodes.forEach(n => {
        if (n.radius <= 0) return;
        
        // Node outer ring glow on select or hover
        const isSelected = selectedNode && selectedNode.id === n.id;
        const isHovered = hoverNode && hoverNode.id === n.id;
        
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 6, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? 'rgba(255, 204, 0, 0.2)' : 'rgba(153, 204, 255, 0.15)';
          ctx.fill();
        }
        
        // Node body
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
        
        if (n.type === 'book') {
          ctx.fillStyle = collapsedBooks[n.id] ? '#993d00' : 'var(--lcars-orange)';
        } else {
          ctx.fillStyle = n.group === 1 ? 'var(--lcars-gold)' : (n.group === 2 ? 'var(--lcars-blue)' : 'var(--lcars-violet)');
        }
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = collapsedBooks[n.id] ? 'var(--lcars-gold)' : '#000000';
        ctx.stroke();

        // Node labels
        ctx.fillStyle = isSelected ? 'var(--lcars-gold)' : '#ffffff';
        ctx.font = n.type === 'book' ? 'bold 12px var(--font-body)' : '11px var(--font-mono)';
        ctx.textAlign = 'center';
        
        // Truncate long labels for books
        let label = n.label || n.id;
        if (label.length > 20) label = label.slice(0, 18) + '...';
        
        ctx.fillText(label, n.x, n.y + n.radius + 15);
      });

      animationId = requestAnimationFrame(updateSimulation);
    };

    animationId = requestAnimationFrame(updateSimulation);

    // Mouse interactions
    const handleMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check if clicked a node
      let clickedNode = null;
      for (const n of nodes) {
        const dx = n.x - mouseX;
        const dy = n.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= n.radius + 8) {
          clickedNode = n;
          break;
        }
      }

      if (clickedNode) {
        draggedNode = clickedNode;
        offset = { x: mouseX - clickedNode.x, y: mouseY - clickedNode.y };
        setSelectedNode(clickedNode);
        
        // Load related chunks/topics
        if (clickedNode.type === 'book') {
          const bookChunks = db.chunks.filter(c => c.book_id === clickedNode.id);
          setRelatedChunks(bookChunks.slice(0, 15)); // Limit to first 15 to keep list readable
          
          // Expand the clicked book node automatically on select
          setCollapsedBooks(prev => ({
            ...prev,
            [clickedNode.id]: false
          }));
        } else {
          const tagChunks = db.chunks.filter(c => c.tooling.includes(clickedNode.id));
          setRelatedChunks(tagChunks.slice(0, 15));
        }
      }
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      if (draggedNode) {
        draggedNode.x = mouseX - offset.x;
        draggedNode.y = mouseY - offset.y;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
      } else {
        // Handle hover effect
        let foundHover = null;
        for (const n of nodes) {
          const dx = n.x - mouseX;
          const dy = n.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= n.radius + 8) {
            foundHover = n;
            break;
          }
        }
        hoverNode = foundHover;
        canvas.style.cursor = foundHover ? 'pointer' : 'default';
      }
    };

    const handleMouseUp = () => {
      draggedNode = null;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
      if (canvas) {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
      }
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [db, selectedNode, selectedBookFilter, difficultyFilter, collapsedBooks]);

  const navigateToChunk = (chunkId) => {
    setActiveChunkId(chunkId);
    setActiveTab('reader');
  };

  return (
    <div className="lcars-grid-2" style={{ height: 'calc(100vh - 140px)', gap: '20px' }}>
      
      {/* Visual Canvas Block */}
      <div 
        ref={containerRef} 
        className="lcars-panel" 
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}
      >
        <div style={{ position: 'absolute', top: '15px', left: '20px', pointerEvents: 'none' }}>
          <h3 className="lcars-panel-title" style={{ color: 'var(--lcars-gold)' }}>Synaptic Graph Simulator</h3>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--lcars-blue)' }}>
            DRAG NODES TO ORGANIZE | CLICK TO MAP CONNECTIONS
          </span>
        </div>
        
        <canvas 
          ref={canvasRef} 
          style={{ 
            backgroundColor: '#030305',
            borderRadius: '8px', 
            flexGrow: 1,
            display: 'block' 
          }} 
        />
      </div>

      {/* Selected Node Details Sidepanel */}
      <div 
        className="lcars-panel" 
        style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', overflowY: 'auto' }}
      >
        {/* Filter Panel */}
        <div className="lcars-panel" style={{ padding: '15px', marginBottom: '20px', border: '1px solid var(--lcars-orange)' }}>
          <h3 style={{ color: 'var(--lcars-orange)', fontSize: '12px', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            🎛️ COGNITIVE CORE FILTERS
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Book Filter Select */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--lcars-blue)', fontFamily: 'var(--font-mono)' }}>SELECT BOOK CORE</label>
              <select 
                value={selectedBookFilter} 
                onChange={(e) => setSelectedBookFilter(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#000',
                  color: 'var(--lcars-gold)',
                  border: '1px solid var(--lcars-darkblue)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-body)',
                  marginTop: '4px'
                }}
              >
                <option value="all">ALL INGESTED BOOKS</option>
                {db.books.map(b => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            </div>
            
            {/* Difficulty Filter Buttons */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--lcars-blue)', fontFamily: 'var(--font-mono)' }}>DIFFICULTY DEPTH</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginTop: '4px' }}>
                {['all', 'Beginner', 'Intermediate', 'Advanced'].map(diff => (
                  <button
                    key={diff}
                    onClick={() => setDifficultyFilter(diff)}
                    className={`lcars-button ${difficultyFilter === diff ? '' : 'secondary'}`}
                    style={{ fontSize: '9px', padding: '6px 2px', textTransform: 'uppercase', borderRadius: '4px' }}
                  >
                    {diff === 'all' ? 'ALL' : diff.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {selectedNode ? (
          <>
            <div className="lcars-panel-header" style={{ borderBottomColor: 'var(--lcars-gold)' }}>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--lcars-blue)', textTransform: 'uppercase' }}>
                  NODE CLASSIFICATION: {selectedNode.type}
                </span>
                <h2 className="lcars-panel-title" style={{ color: 'var(--lcars-orange)', marginTop: '5px' }}>
                  {selectedNode.label || selectedNode.id}
                </h2>
              </div>
              <span className="lcars-panel-code" style={{ fontFamily: 'var(--font-mono)' }}>GP-{selectedNode.group}</span>
            </div>

            {selectedNode.type === 'book' && (
              <div style={{ marginBottom: '20px' }}>
                <button 
                  className={`lcars-button ${collapsedBooks[selectedNode.id] ? 'success' : 'secondary'}`}
                  onClick={() => toggleBookCollapse(selectedNode.id)}
                  style={{ width: '100%', fontSize: '13px', borderRadius: '8px' }}
                >
                  {collapsedBooks[selectedNode.id] ? '🛰️ Expand Concept Cluster' : '🕳️ Collapse Concept Cluster'}
                </button>
              </div>
            )}

            <p style={{ fontSize: '14px', color: '#ccc', marginBottom: '20px' }}>
              {selectedNode.type === 'book' 
                ? 'Select a related chapter node below to open the complete reference manual on this guide.'
                : `This concept links ${relatedChunks.length} separate sections in the current knowledge core dataset.`
              }
            </p>

            <h3 style={{ color: 'var(--lcars-gold)', fontSize: '14px', marginBottom: '10px', textTransform: 'uppercase' }}>
              Connected Concept Nodes ({relatedChunks.length})
            </h3>
            
            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {relatedChunks.map(chunk => (
                <div 
                  key={chunk.id}
                  onClick={() => navigateToChunk(chunk.id)}
                  style={{
                    backgroundColor: '#0e0f15',
                    border: '1px solid #1a2238',
                    borderLeft: '4px solid var(--lcars-peach)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--lcars-gold)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1a2238'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{chunk.title}</span>
                    <span className="lcars-badge blue" style={{ fontSize: '10px' }}>{chunk.difficulty}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Book: {chunk.book_title} | Chapter: {chunk.chapter}
                  </div>
                </div>
              ))}
              
              {relatedChunks.length === 0 && (
                <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                  No active concepts connected.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
            <span style={{ fontSize: '36px' }}>🕸️</span>
            <h3 style={{ color: 'var(--lcars-gold)', marginTop: '15px' }}>NO NODE MAPPED</h3>
            <p style={{ color: '#888', fontSize: '13px', marginTop: '10px' }}>
              Select a synaptic node on the visual graph to display its connections and text references.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
