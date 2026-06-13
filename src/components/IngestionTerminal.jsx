import React, { useState, useEffect } from 'react';

export default function IngestionTerminal({ db, reloadDb, llmStatus }) {
  const [logText, setLogText] = useState([
    "HOLODECK DATABASE PROTOCOL INITIALIZED...",
    "READY TO INGEST EPUB LIBRARIES FROM /ebooks...",
    "TYPE COMMANDS TO TRIGGER DATABANK MAPS."
  ]);

  const [transceiverPrompt, setTransceiverPrompt] = useState('Explain the purpose of MCP in one short sentence.');
  const [transceiverResponse, setTransceiverResponse] = useState('');
  const [transceiverLoading, setTransceiverLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    if (llmStatus && llmStatus.models && llmStatus.models.length > 0) {
      // Prioritize loaded Gemma-4 model if present
      const g4 = llmStatus.models.find(m => m.toLowerCase().includes('gemma-4'));
      setSelectedModel(g4 || llmStatus.models[0]);
    }
  }, [llmStatus]);

  const handleTransmit = async () => {
    if (!llmStatus.online) return;
    setTransceiverLoading(true);
    setTransceiverResponse('TRANSMITTING SIGNAL...');
    try {
      let res;
      const activeModel = selectedModel || llmStatus.models[0] || 'default';
      
      if (llmStatus.type === 'LM Studio') {
        res = await fetch('/llm-studio/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: activeModel,
            messages: [{ role: 'user', content: transceiverPrompt }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          setTransceiverResponse(data.choices[0].message.content);
        } else {
          setTransceiverResponse('ERROR: Subspace transmitter failed to receive response packet.');
        }
      } else {
        // Ollama
        res = await fetch('/ollama/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: activeModel,
            messages: [{ role: 'user', content: transceiverPrompt }],
            stream: false
          })
        });
        if (res.ok) {
          const data = await res.json();
          setTransceiverResponse(data.message.content);
        } else {
          setTransceiverResponse('ERROR: Subspace transmitter failed to receive response packet.');
        }
      }
    } catch (e) {
      setTransceiverResponse(`ERROR: Connection refused. Subspace channel lost.\nDetails: ${e.message}\n(Ensure CORS is enabled in your LLM settings)`);
    } finally {
      setTransceiverLoading(false);
    }
  };

  const runSimulatedSync = () => {
    setLogText(prev => [
      ...prev,
      "",
      "> python3 scripts/parse_epubs.py",
      "Scanning /Users/dirkverstraete/Documents/modernaicode/ebooks...",
      "Found 8 EPUB volumes.",
      "Parsing volume 1: 101claudecodetips_abattle-testedfieldguideforagenticcoding.epub",
      "Parsing volume 2: bestpracticesforclaudecode_advancedagenticcodingforreal-worldcodeb.epub",
      "Parsing volume 3: buildreal-worldaiapps_ahands-onprojectwithnextjs16andtheopenaiapi.epub",
      "Parsing volume 4: claudecodeautomation_mcpskillsandproductionagenticworkflows.epub",
      "Parsing volume 5: claudecodeinaction_buildareal-worldaiappfromstarttofinish.epub",
      "Parsing volume 6: deployableaisaas_frombackendinpythontostripeintegration.epub",
      "Parsing volume 7: masteringopencode_open-sourceagenticcodingformoderndevelopers.epub",
      "Parsing volume 8: ollamainaction_buildfullyprivatemultimodalaiapps.epub",
      "Connecting to local LLM cores (LM Studio on :1234 or Ollama on :11434)...",
      "LLM connection offline or unreachable. Initializing local synapse matrix.",
      "Extracting 911 concepts and formatting quiz engines...",
      "Writing parsed databank to /src/database.json...",
      "SYNAPTIC DATABASE COMPILATION COMPLETE.",
      "STATUS: SUCCESS. 911 concept nodes loaded."
    ]);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', height: 'calc(100vh - 140px)' }}>
      
      {/* Console Display */}
      <div className="lcars-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#000000', padding: '15px' }}>
        <div className="lcars-panel-header" style={{ borderBottomColor: 'var(--lcars-orange)' }}>
          <h3 className="lcars-panel-title" style={{ color: 'var(--lcars-gold)' }}>Holodeck Subsystem Console</h3>
          <span className="lcars-panel-code" style={{ fontFamily: 'var(--font-mono)' }}>TERM-A</span>
        </div>

        {/* Scrollable logs */}
        <div style={{
          flexGrow: 1,
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: 'var(--lcars-green)',
          backgroundColor: '#050508',
          border: '1px solid #1a3366',
          borderRadius: '5px',
          padding: '15px',
          overflowY: 'auto',
          lineHeight: '1.4'
        }}>
          {logText.map((line, idx) => (
            <div key={idx} style={{ 
              color: line.startsWith('>') ? 'var(--lcars-gold)' : (line.includes('SUCCESS') ? 'var(--lcars-green)' : (line.includes('offline') ? 'var(--lcars-peach)' : 'var(--lcars-lightgrey)')),
              marginBottom: line === '' ? '10px' : '2px'
            }}>
              {line}
            </div>
          ))}
        </div>

        {/* Sync trigger button */}
        <div style={{ marginTop: '15px', display: 'flex', gap: '15px' }}>
          <button className="lcars-button" onClick={runSimulatedSync}>
            Scan Ebooks Folder
          </button>
          <button 
            className="lcars-button secondary" 
            onClick={() => {
              setLogText(prev => [...prev, "", "Reloading JSON data...", "Success."]);
              reloadDb();
            }}
          >
            Reload Databank JSON
          </button>
        </div>

        {/* Transceiver interactive segment */}
        <div className="lcars-panel" style={{ marginTop: '20px', borderLeftColor: 'var(--lcars-violet)', padding: '15px', backgroundColor: '#050508' }}>
          <div className="lcars-panel-header" style={{ marginBottom: '10px' }}>
            <h4 style={{ color: 'var(--lcars-violet)', fontSize: '14px', fontFamily: 'var(--font-header)' }}>
              📡 Subspace Transceiver (LLM Test Link)
            </h4>
            {llmStatus.online ? (
              <span className="lcars-badge green" style={{ fontSize: '10px' }}>
                Connected to {llmStatus.type}
              </span>
            ) : (
              <span className="lcars-badge red" style={{ fontSize: '10px' }}>
                Offline
              </span>
            )}
          </div>

          {llmStatus.online ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#ccc', flexWrap: 'wrap' }}>
                <span>SUBCHANNEL CORE:</span>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{
                    backgroundColor: '#000',
                    border: '1px solid var(--lcars-violet)',
                    borderRadius: '4px',
                    color: 'var(--lcars-gold)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    padding: '4px 8px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {llmStatus.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={transceiverPrompt}
                  onChange={(e) => setTransceiverPrompt(e.target.value)}
                  style={{
                    backgroundColor: '#000',
                    border: '1px solid var(--lcars-violet)',
                    borderRadius: '4px',
                    color: '#fff',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    padding: '8px',
                    flexGrow: 1,
                    outline: 'none'
                  }}
                  disabled={transceiverLoading}
                />
                <button 
                  className="lcars-button" 
                  style={{ backgroundColor: 'var(--lcars-violet)', padding: '8px 16px' }}
                  onClick={handleTransmit}
                  disabled={transceiverLoading}
                >
                  {transceiverLoading ? 'BEAMING...' : 'TRANSMIT'}
                </button>
              </div>

              {transceiverResponse && (
                <pre style={{
                  backgroundColor: '#000',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--lcars-blue)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '140px',
                  overflowY: 'auto'
                }}>
                  {transceiverResponse}
                </pre>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', padding: '10px' }}>
              Transceiver decoupled. Start your local LM Studio server on port 1234 or Ollama on port 11434 to transmit signal vectors.
            </div>
          )}
        </div>
      </div>

      {/* Manual Terminal Instructions */}
      <div className="lcars-panel" style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
        <div className="lcars-panel-header">
          <h3 className="lcars-panel-title">Host Controls</h3>
          <span className="lcars-panel-code">STARFLEET-HQ</span>
        </div>
        
        <p style={{ fontSize: '13px', color: '#ccc', marginBottom: '20px', lineHeight: '1.4' }}>
          Jordi, here are the terminal commands to initialize the databases on your host machine.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <h4 style={{ color: 'var(--lcars-gold)', fontSize: '12px', marginBottom: '6px', fontFamily: 'var(--font-header)' }}>
              1. INITIALIZE VITE APP
            </h4>
            <pre style={{
              backgroundColor: '#0a0a0f',
              border: '1px solid var(--lcars-darkblue)',
              borderRadius: '4px',
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--lcars-blue)',
              whiteSpace: 'pre-wrap'
            }}>
              npm install<br />
              npm run dev
            </pre>
          </div>

          <div>
            <h4 style={{ color: 'var(--lcars-orange)', fontSize: '12px', marginBottom: '6px', fontFamily: 'var(--font-header)' }}>
              2. INGEST EPUB METADATA
            </h4>
            <pre style={{
              backgroundColor: '#0a0a0f',
              border: '1px solid var(--lcars-darkblue)',
              borderRadius: '4px',
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--lcars-orange)',
              whiteSpace: 'pre-wrap'
            }}>
              python3 scripts/parse_epubs.py
            </pre>
          </div>

          <div>
            <h4 style={{ color: 'var(--lcars-peach)', fontSize: '12px', marginBottom: '6px', fontFamily: 'var(--font-header)' }}>
              3. LOCAL LLM INTERFACES (LM STUDIO / OLLAMA)
            </h4>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '5px' }}>
              LM Studio: Start the Local Server on port 1234.
            </p>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '5px' }}>
              Ollama: Ensure Ollama is running and pull your models:
            </p>
            <pre style={{
              backgroundColor: '#0a0a0f',
              border: '1px solid var(--lcars-darkblue)',
              borderRadius: '4px',
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--lcars-peach)',
              whiteSpace: 'pre-wrap'
            }}>
              ollama run qwen2.5:3b<br />
              # or:<br />
              ollama run gemma2:9b
            </pre>
          </div>

          <div style={{ borderTop: '1px solid #222', paddingTop: '15px', fontSize: '12px', color: '#888', lineHeight: '1.4' }}>
            &gt; NOTE: Running the ingestion script with LM Studio or Ollama online will send each concept chunk to your local LLM to generate highly challenging and custom quiz simulations.
          </div>

        </div>
      </div>

    </div>
  );
}
