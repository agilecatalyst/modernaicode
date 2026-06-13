import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_QUIZZES = [
  {
    topic: "Claude Code",
    question: "What is the primary purpose of the /doctor command in Claude Code?",
    options: [
      "To run system health diagnostics and verify the CLI configuration.",
      "To automatically rewrite failing unit tests.",
      "To send a crash report directly to the Anthropic engineering team.",
      "To check if the local server has an active internet connection."
    ],
    answer: 0,
    explanation: "Running /doctor allows you to diagnostic check the CLI environment and diagnose configuration or path errors."
  },
  {
    topic: "Claude Code",
    question: "Where should project-level system instructions and rules be placed for Claude Code to read?",
    options: [
      "In a file named CLAUDE.md in the project root.",
      "In the package.json file under the 'claude' configuration block.",
      "In an environment variable named CLAUDE_SYSTEM_PROMPT.",
      "In the global user settings file located in the user's home directory."
    ],
    answer: 0,
    explanation: "Claude Code checks for a CLAUDE.md file in the root of the workspace to load project conventions and instructions."
  },
  {
    topic: "MCP",
    question: "How do Model Context Protocol (MCP) servers extend an agent's capabilities?",
    options: [
      "By providing standardized interfaces to expose local tools, files, and enterprise APIs.",
      "By compiling Python scripts into high-performance C++ binaries.",
      "By automatically compressing context window tokens to allow longer chats.",
      "By hosting secondary LLM weights locally in a secure sandbox."
    ],
    answer: 0,
    explanation: "MCP servers connect LLM agents to external data sources and tools through a unified protocol standard."
  },
  {
    topic: "Ollama",
    question: "Which of the following commands starts a local model container and starts an interactive prompt in Ollama?",
    options: [
      "ollama run <model-name>",
      "ollama start <model-name>",
      "ollama prompt <model-name>",
      "ollama exec <model-name>"
    ],
    answer: 0,
    explanation: "The command 'ollama run' pulls the model (if not already local) and opens a chat session with it."
  },
  {
    topic: "Stripe",
    question: "Why is it critical to use a Webhook signature verification in Stripe integrations?",
    options: [
      "To verify that incoming events were sent by Stripe and not forged by malicious third parties.",
      "To encrypt payment card data before sending it to the client side.",
      "To bypass standard double-spend check constraints on the database.",
      "To speed up Stripe server response times during busy checkout events."
    ],
    answer: 0,
    explanation: "Signature verification checks that the webhook payload is signed by Stripe using a shared secret, preventing spoofing."
  }
];

export default function QuizEngine({ db, quizConfig, setQuizConfig, setActiveTab, llmStatus }) {
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  
  // Leitner spaced repetition states
  const [leitnerFilter, setLeitnerFilter] = useState('all');
  const [showExplanation, setShowExplanation] = useState(false);

  // Ref to track last loaded config to prevent resets on background LLM polling
  const lastConfigRef = useRef(null);
  
  // JIT Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [loaderIdx, setLoaderIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Rotating trivia timer for the loader
  useEffect(() => {
    if (!isGenerating) return;
    
    setLoaderIdx(0);
    setShowAnswer(false);
    
    const revealTimer = setTimeout(() => {
      setShowAnswer(true);
    }, 7000); // Reveal answer after 7 seconds
    
    const cycleTimer = setInterval(() => {
      setLoaderIdx(prev => prev + 1);
      setShowAnswer(false);
      setTimeout(() => {
        setShowAnswer(true);
      }, 7000);
    }, 15000); // Cycle every 15 seconds
    
    return () => {
      clearTimeout(revealTimer);
      clearInterval(cycleTimer);
    };
  }, [isGenerating]);

  // JIT background generation routine
  const triggerJitGeneration = async (chunkId, bookId) => {
    setIsGenerating(true);
    setGenerationError(null);
    
    const chunk = db.chunks.find(c => c.id === chunkId);
    if (!chunk) {
      setGenerationError("Target concept chunk not found.");
      setIsGenerating(false);
      return;
    }
    
    const activeModel = llmStatus.models[0] || 'default';
    const isStudio = llmStatus.type.includes('Studio');
    
    const prompt = `
Generate exactly one high-quality multiple choice quiz question based on this technical documentation segment.
Title: ${chunk.title}
Text: ${chunk.content.substring(0, 1500)}

The question must test deep conceptual understanding or syntax.
You MUST respond in strict JSON format with exactly these fields:
{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "answer": 0,
  "explanation": "string"
}
The 'answer' field must be an integer from 0 to 3 representing the index of the correct option.
Do not add any markdown framing (like \`\`\`json) or leading/trailing text. Output raw JSON only.
    `;
    
    const endpoint = isStudio ? '/llm-studio/v1/chat/completions' : '/ollama/api/chat';
    const payload = isStudio ? {
      model: activeModel,
      messages: [
        { role: 'system', content: 'You are a Starfleet training computer. Output raw JSON ONLY.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    } : {
      model: activeModel,
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: { temperature: 0.3 }
    };
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        throw new Error(`LLM Server returned code ${res.status}`);
      }
      
      const resData = await res.json();
      let responseText = isStudio 
        ? resData.choices[0].message.content.trim()
        : resData.message.content.trim();
        
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```(json)?|```$/gm, "").trim();
      }
      
      const quiz = JSON.parse(responseText);
      if (quiz.question && quiz.options && quiz.options.length === 4 && quiz.answer !== undefined) {
        quiz.id = `quiz_jit_${Date.now()}`;
        quiz.chunk_id = chunkId;
        quiz.book_id = bookId;
        
        // Caching
        const localJit = JSON.parse(localStorage.getItem('holodeck_jit_quizzes') || '[]');
        localStorage.setItem('holodeck_jit_quizzes', JSON.stringify([...localJit, quiz]));
        
        // Randomize options
        const correctText = quiz.options[quiz.answer];
        const shuffled = [...quiz.options].sort(() => Math.random() - 0.5);
        const newAnsIdx = shuffled.indexOf(correctText);
        
        const preparedQuiz = {
          ...quiz,
          options: shuffled,
          answer: newAnsIdx
        };
        
        setQuestions([preparedQuiz]);
        setCurrentIdx(0);
        setSelectedOption(null);
        setIsAnswered(false);
        setScore(0);
        setStreak(0);
        setQuizFinished(false);
        setIsGenerating(false);
      } else {
        throw new Error("Invalid structured JSON layout from local LLM.");
      }
    } catch (err) {
      console.error(err);
      setGenerationError(err.message);
      
      // Fallback: match metadata to default quizzes
      const matchedDq = DEFAULT_QUIZZES.find(dq => 
        chunk.title.toLowerCase().includes(dq.topic.toLowerCase()) || 
        chunk.content.toLowerCase().includes(dq.topic.toLowerCase())
      ) || DEFAULT_QUIZZES[0];
      
      const fallbackQuiz = {
        ...matchedDq,
        id: `quiz_fb_err_${Date.now()}`,
        chunk_id: chunkId,
        book_id: bookId
      };
      
      const correctText = fallbackQuiz.options[fallbackQuiz.answer];
      const shuffled = [...fallbackQuiz.options].sort(() => Math.random() - 0.5);
      fallbackQuiz.options = shuffled;
      fallbackQuiz.answer = shuffled.indexOf(correctText);
      
      setQuestions([fallbackQuiz]);
      setIsGenerating(false);
    }
  };
  
  // Filter, pick, shuffle and format questions based on config
  useEffect(() => {
    if (!db || !db.quizzes) return;
    
    // Check if the configuration or Leitner filter actually changed (by type, id, filter, or reference for resets)
    const isSameConfig = lastConfigRef.current && 
                         lastConfigRef.current.type === quizConfig.type && 
                         lastConfigRef.current.id === quizConfig.id && 
                         lastConfigRef.current.leitnerFilter === leitnerFilter &&
                         lastConfigRef.current.quizConfigRef === quizConfig;
                         
    if (isSameConfig) {
      // It's just a background llmStatus poll, don't reset the active quiz!
      return;
    }
    
    // Update the ref
    lastConfigRef.current = {
      type: quizConfig.type,
      id: quizConfig.id,
      leitnerFilter: leitnerFilter,
      quizConfigRef: quizConfig
    };
    
    const localJitQuizzes = JSON.parse(localStorage.getItem('holodeck_jit_quizzes') || '[]');
    let pool = [...db.quizzes, ...localJitQuizzes];
    
    if (quizConfig && quizConfig.type === 'book' && quizConfig.id) {
      pool = pool.filter(q => q.book_id === quizConfig.id);
    } else if (quizConfig && quizConfig.type === 'concept' && quizConfig.id) {
      pool = pool.filter(q => q.chunk_id === quizConfig.id);
    }
    
    // If online, exclude static fallback quizzes to prioritize JIT neural generation
    if (llmStatus && llmStatus.online) {
      pool = pool.filter(q => !q.id.startsWith('quiz_fb'));
    }
    
    // Trigger JIT Browser-side Generation if pool is empty
    if (pool.length === 0 && quizConfig) {
      if (quizConfig.type === 'concept' && quizConfig.id) {
        if (llmStatus && llmStatus.online) {
          const chunk = db.chunks.find(c => c.id === quizConfig.id);
          const bookId = chunk ? chunk.book_id : null;
          triggerJitGeneration(quizConfig.id, bookId);
          return;
        } else {
          // Offline fallback
          const chunk = db.chunks.find(c => c.id === quizConfig.id);
          const bookId = chunk ? chunk.book_id : null;
          const matchedDq = DEFAULT_QUIZZES.find(dq => 
            chunk && (chunk.title.toLowerCase().includes(dq.topic.toLowerCase()) || 
            chunk.content.toLowerCase().includes(dq.topic.toLowerCase()))
          ) || DEFAULT_QUIZZES[0];
          
          const fallbackQuiz = {
            ...matchedDq,
            id: `quiz_fb_offline_${Date.now()}`,
            chunk_id: quizConfig.id,
            book_id: bookId
          };
          const correctText = fallbackQuiz.options[fallbackQuiz.answer];
          const shuffled = [...fallbackQuiz.options].sort(() => Math.random() - 0.5);
          fallbackQuiz.options = shuffled;
          fallbackQuiz.answer = shuffled.indexOf(correctText);
          
          setQuestions([fallbackQuiz]);
          return;
        }
      } else if (quizConfig.type === 'book' && quizConfig.id) {
        const bookChunks = db.chunks.filter(c => c.book_id === quizConfig.id);
        if (bookChunks.length > 0) {
          if (llmStatus && llmStatus.online) {
            triggerJitGeneration(bookChunks[0].id, quizConfig.id);
            return;
          } else {
            // Book offline fallback
            const fallbackQuiz = {
              ...DEFAULT_QUIZZES[0],
              id: `quiz_fb_book_offline_${Date.now()}`,
              chunk_id: bookChunks[0].id,
              book_id: quizConfig.id
            };
            const correctText = fallbackQuiz.options[fallbackQuiz.answer];
            const shuffled = [...fallbackQuiz.options].sort(() => Math.random() - 0.5);
            fallbackQuiz.options = shuffled;
            fallbackQuiz.answer = shuffled.indexOf(correctText);
            
            setQuestions([fallbackQuiz]);
            return;
          }
        }
      }
    }
    
    // Filter by Leitner Box
    const boxes = JSON.parse(localStorage.getItem('holodeck_leitner_boxes') || '{}');
    if (leitnerFilter !== 'all') {
      const targetBox = parseInt(leitnerFilter, 10);
      pool = pool.filter(q => {
        const box = boxes[q.id] || 1;
        return box === targetBox;
      });
    }
    
    // Filter out recently played questions to prevent immediate repeats
    const recent = JSON.parse(localStorage.getItem('holodeck_recent_quizzes') || '[]');
    let filteredPool = pool.filter(q => !recent.includes(q.id));
    
    // Fallback to full pool if filtered list is too small
    if (filteredPool.length < 3) {
      filteredPool = pool;
    }
    
    let finalPool = [];
    if (leitnerFilter === 'all') {
      // Group by box to prioritize Box 1-3 over Box 5
      const boxGroups = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      filteredPool.forEach(q => {
        const box = boxes[q.id] || 1;
        if (boxGroups[box]) {
          boxGroups[box].push(q);
        } else {
          boxGroups[1].push(q);
        }
      });
      
      // Shuffle each group
      Object.keys(boxGroups).forEach(box => {
        boxGroups[box].sort(() => Math.random() - 0.5);
      });
      
      // Prioritized concatenation
      finalPool = [
        ...boxGroups[1],
        ...boxGroups[2],
        ...boxGroups[3],
        ...boxGroups[4],
        ...boxGroups[5]
      ];
    } else {
      filteredPool.sort(() => Math.random() - 0.5);
      finalPool = filteredPool;
    }
    
    const chosen = finalPool.slice(0, 10);
    
    // Dynamically shuffle options for each question to avoid hardcoded 'A' correct answers
    const randomizedQuestions = chosen.map(q => {
      const qClone = JSON.parse(JSON.stringify(q));
      const correctText = qClone.options[qClone.answer];
      
      // Shuffle options using Sort-Random
      const shuffledOptions = [...qClone.options].sort(() => Math.random() - 0.5);
      const newAnswerIdx = shuffledOptions.indexOf(correctText);
      
      qClone.options = shuffledOptions;
      qClone.answer = newAnswerIdx;
      return qClone;
    });
    
    setQuestions(randomizedQuestions);
    setCurrentIdx(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setStreak(0);
    setQuizFinished(false);
    setShowExplanation(false);
  }, [db, quizConfig, llmStatus, leitnerFilter]);

  // JIT Loader Rendering
  if (isGenerating) {
    const activeDq = DEFAULT_QUIZZES[loaderIdx % DEFAULT_QUIZZES.length];
    return (
      <div className="lcars-panel" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--lcars-orange)' }} className="blink">
            📡 SUBSPACE TRANSCEIVER LINK: ACTIVE
          </span>
          <span style={{ color: 'var(--lcars-blue)' }}>
            CALIBRATING NEURAL CORE VIA {llmStatus.type.toUpperCase()}...
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '5px', marginBottom: '30px' }}>
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              style={{
                flexGrow: 1,
                height: '14px',
                backgroundColor: i % 3 === (loaderIdx % 3) ? 'var(--lcars-gold)' : '#222',
                borderRadius: '3px',
                transition: 'background-color 0.3s'
              }}
            />
          ))}
        </div>
        
        <div style={{ border: '1px dashed var(--lcars-blue)', padding: '20px', borderRadius: '15px', marginBottom: '20px', backgroundColor: 'rgba(0,102,204,0.03)' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
            <span className="lcars-badge blue">NEURAL STUDY DRILL</span>
            <span style={{ fontSize: '12px', color: '#888', fontFamily: 'var(--font-mono)' }}>
              TOPIC: {activeDq.topic.toUpperCase()}
            </span>
          </div>
          
          <h3 style={{ fontSize: '17px', color: '#fff', marginBottom: '20px', textTransform: 'none', lineHeight: '1.4' }}>
            {activeDq.question}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeDq.options.map((opt, oIdx) => {
              let optStyle = {
                padding: '10px 15px',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                backgroundColor: '#111',
                color: '#888',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              };
              
              if (showAnswer) {
                if (oIdx === activeDq.answer) {
                  optStyle.backgroundColor = 'var(--lcars-green)';
                  optStyle.color = '#000';
                  optStyle.fontWeight = 'bold';
                } else {
                  optStyle.backgroundColor = '#181818';
                  optStyle.color = '#444';
                }
              }
              
              return (
                <div key={oIdx} style={optStyle}>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    color: showAnswer && oIdx === activeDq.answer ? '#000' : '#888',
                    borderRadius: '50%', 
                    width: '20px', 
                    height: '20px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '11px'
                  }}>
                    {String.fromCharCode(65 + oIdx)}
                  </span>
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
          
          {showAnswer && (
            <div className="blink-in" style={{ marginTop: '15px', padding: '10px', borderTop: '1px solid #333', fontSize: '13px', color: '#ccc', lineHeight: '1.4' }}>
              <strong>Debrief:</strong> {activeDq.explanation}
            </div>
          )}
        </div>
        
        <div className="lcars-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', border: 'none', padding: '15px 25px' }}>
          <span style={{ color: 'var(--lcars-peach)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            STATUS: EXTRACTING ATOM CHUNKS...
          </span>
          <span style={{ fontSize: '12px', color: '#666', fontFamily: 'var(--font-mono)' }}>
            RECONNECTING IN T-MINUS 15s
          </span>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="lcars-panel" style={{ textAlign: 'center', padding: '50px' }}>
        <h3 style={{ color: 'var(--lcars-orange)' }}>NO SIMULATIONS PROGRAMMED</h3>
        <p style={{ margin: '20px 0', color: '#888' }}>
          No quiz modules matched this selection criteria. Load another core or choose a different module.
        </p>
        <button className="lcars-button" onClick={() => { setQuizConfig({ type: 'all', id: null }); }}>
          Load Full Simulation Bank
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  const handleOptionSelect = (optionIdx) => {
    if (isAnswered) return;
    
    setSelectedOption(optionIdx);
    setIsAnswered(true);
    
    const isCorrect = optionIdx === currentQuestion.answer;
    
    // Leitner Box progression/demotion logic
    const currentBoxes = JSON.parse(localStorage.getItem('holodeck_leitner_boxes') || '{}');
    const oldBox = currentBoxes[currentQuestion.id] || 1;
    let newBox = oldBox;
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
      // Promote Box N -> Box N+1 (Max 5)
      newBox = Math.min(5, oldBox + 1);
    } else {
      setStreak(0);
      // Demote Box N -> Box 1
      newBox = 1;
    }
    
    currentBoxes[currentQuestion.id] = newBox;
    localStorage.setItem('holodeck_leitner_boxes', JSON.stringify(currentBoxes));
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Quiz complete!
      setQuizFinished(true);
      
      // Save stats to localStorage
      const completed = JSON.parse(localStorage.getItem('holodeck_completed_quizzes') || '[]');
      const newCompleted = [...new Set([...completed, ...questions.map(q => q.id)])];
      localStorage.setItem('holodeck_completed_quizzes', JSON.stringify(newCompleted));
      
      // Track recently played questions (rolling list of 30) to prevent immediate repeats
      const recent = JSON.parse(localStorage.getItem('holodeck_recent_quizzes') || '[]');
      const newRecent = [...questions.map(q => q.id), ...recent].slice(0, 30);
      localStorage.setItem('holodeck_recent_quizzes', JSON.stringify(newRecent));
      
      const currentScore = parseInt(localStorage.getItem('holodeck_total_score') || '0', 10);
      const addedScore = score * 10; // 10 points per question
      localStorage.setItem('holodeck_total_score', (currentScore + addedScore).toString());
    }
  };

  const getAccuracyClass = (pct) => {
    if (pct >= 80) return 'green';
    if (pct >= 50) return 'gold';
    return 'red';
  };

  const getSystemStatusText = () => {
    const pct = Math.round((score / questions.length) * 100);
    if (pct === 100) return "DIAGNOSTICS PERFECT: Starfleet Excellence Award Merited.";
    if (pct >= 80) return "DIAGNOSTICS EXCELLENT: Competency level verified.";
    if (pct >= 50) return "DIAGNOSTICS SATISFACTORY: Minimum standard passed.";
    return "DIAGNOSTICS UNSATISFACTORY: holodeck safety retraining scheduled.";
  };

  // Leitner statistics calculation
  const boxes = JSON.parse(localStorage.getItem('holodeck_leitner_boxes') || '{}');
  const localJitQuizzes = JSON.parse(localStorage.getItem('holodeck_jit_quizzes') || '[]');
  const allQuizzes = db && db.quizzes ? [...db.quizzes, ...localJitQuizzes] : [];
  
  const leitnerStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalInStats = 0;
  
  allQuizzes.forEach(q => {
    let include = true;
    if (quizConfig && quizConfig.type === 'book' && quizConfig.id) {
      include = q.book_id === quizConfig.id;
    } else if (quizConfig && quizConfig.type === 'concept' && quizConfig.id) {
      include = q.chunk_id === quizConfig.id;
    }
    if (include) {
      const box = boxes[q.id] || 1;
      leitnerStats[box]++;
      totalInStats++;
    }
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Simulation Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: 'var(--lcars-blue)' }}>
          MODULE: {quizConfig.type === 'book' ? 'BOOK COMPLIANCE TEST' : (quizConfig.type === 'concept' ? 'CONCEPT DRILL' : 'ALL KNOWLEDGE SIMULATION')}
        </span>
        <span style={{ color: 'var(--lcars-violet)' }}>
          STREAK: {streak} 🔥
        </span>
      </div>

      {/* Leitner Box Progress & Filter Panel */}
      <div className="lcars-panel" style={{ padding: '15px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--lcars-gold)', fontSize: '13px' }}>
            📊 SPACED REPETITION INDEX (LEITNER BOXES)
          </span>
          <span style={{ color: '#888', fontSize: '11px' }}>
            SCOPE: {quizConfig.type === 'book' ? 'ACTIVE BOOK ONLY' : 'ALL CORES'}
          </span>
        </div>
        
        {/* Segmented distribution bar */}
        <div style={{ display: 'flex', height: '22px', borderRadius: '11px', overflow: 'hidden', marginBottom: '15px', backgroundColor: '#111', border: '1px solid #333' }}>
          {Object.keys(leitnerStats).map(boxNum => {
            const count = leitnerStats[boxNum];
            const pct = totalInStats > 0 ? (count / totalInStats) * 100 : 0;
            if (count === 0) return null;
            
            const colors = {
              1: 'var(--lcars-orange)',
              2: 'var(--lcars-gold)',
              3: 'var(--lcars-peach)',
              4: 'var(--lcars-blue)',
              5: 'var(--lcars-green)'
            };
            
            const labels = {
              1: 'Box 1',
              2: 'Box 2',
              3: 'Box 3',
              4: 'Box 4',
              5: 'Box 5'
            };
            
            return (
              <div 
                key={boxNum} 
                style={{
                  width: `${pct}%`,
                  backgroundColor: colors[boxNum],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#000',
                  transition: 'width 0.3s',
                  textShadow: 'none'
                }}
                title={`${labels[boxNum]}: ${count} Concept(s)`}
              >
                {pct > 10 ? `${labels[boxNum]} (${count})` : count}
              </div>
            );
          })}
          {totalInStats === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: '#666', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              NO DATA PERSISTED IN CURRENT COGNITIVE CORE
            </div>
          )}
        </div>

        {/* Filter controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
          <button 
            className={`lcars-button ${leitnerFilter === 'all' ? '' : 'secondary'}`}
            onClick={() => setLeitnerFilter('all')}
            style={{ fontSize: '11px', padding: '6px 4px', borderRadius: '8px' }}
          >
            ALL ({totalInStats})
          </button>
          {[1, 2, 3, 4, 5].map(boxNum => {
            const labels = {
              1: 'B1: NEW',
              2: 'B2: DRILL',
              3: 'B3: REINFORCE',
              4: 'B4: MEMORY',
              5: 'B5: MASTER'
            };
            const count = leitnerStats[boxNum] || 0;
            return (
              <button
                key={boxNum}
                className={`lcars-button ${leitnerFilter === String(boxNum) ? '' : 'secondary'}`}
                onClick={() => setLeitnerFilter(String(boxNum))}
                style={{ 
                  fontSize: '10px', 
                  padding: '6px 2px', 
                  borderRadius: '8px'
                }}
              >
                {labels[boxNum]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {!quizFinished ? (
        <div className="lcars-panel" style={{ padding: '30px' }}>
          {/* Question Counter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '13px', color: 'var(--lcars-gold)', fontFamily: 'var(--font-header)' }}>
              QUESTION {currentIdx + 1} OF {questions.length}
            </span>
            <div style={{ width: '180px', height: '10px', backgroundColor: '#222', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${((currentIdx) / questions.length) * 100}%`, 
                  height: '100%', 
                  backgroundColor: 'var(--lcars-orange)',
                  transition: 'width 0.3s'
                }} 
              />
            </div>
          </div>

          {/* Question Text */}
          <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '25px', textTransform: 'none', lineHeight: '1.4' }}>
            {currentQuestion.question}
          </h2>

          {/* Code Snippet for Rich Debugging / Practice */}
          {(() => {
            const chunk = db?.chunks?.find(c => c.id === currentQuestion.chunk_id);
            if (chunk && chunk.code && chunk.code.length > 0) {
              return (
                <div style={{
                  backgroundColor: '#050c14',
                  border: '1px solid var(--lcars-darkblue)',
                  borderLeft: '5px solid var(--lcars-gold)',
                  borderRadius: '6px',
                  padding: '15px',
                  marginBottom: '20px',
                  overflowX: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: '#a9ffb2',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'left'
                }}>
                  <code>{chunk.code[0]}</code>
                </div>
              );
            }
            return null;
          })()}

          {/* Options List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
            {currentQuestion.options.map((option, idx) => {
              let optColor = 'var(--lcars-darkblue)';
              let textColor = '#000';
              
              if (isAnswered) {
                if (idx === currentQuestion.answer) {
                  // Correct option - always green
                  optColor = 'var(--lcars-green)';
                  textColor = '#000';
                } else if (idx === selectedOption) {
                  // Wrong option clicked - red
                  optColor = 'var(--lcars-red)';
                  textColor = '#fff';
                } else {
                  // Unselected options during review - grey/dark
                  optColor = '#222';
                  textColor = '#666';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={isAnswered}
                  style={{
                    backgroundColor: optColor,
                    color: textColor,
                    border: 'none',
                    borderRadius: '15px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '15px',
                    fontWeight: isAnswered && idx === currentQuestion.answer ? 'bold' : 'normal',
                    padding: '12px 20px',
                    textAlign: 'left',
                    cursor: isAnswered ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isAnswered) e.currentTarget.style.backgroundColor = 'var(--lcars-blue)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isAnswered) e.currentTarget.style.backgroundColor = optColor;
                  }}
                >
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: '50%', 
                    width: '24px', 
                    height: '24px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '12px'
                  }}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span style={{ flexGrow: 1 }}>{option}</span>
                </button>
              );
            })}
          </div>

          {/* Explanation / Next Block */}
          {isAnswered && (
            <div 
              className="blink-in"
              style={{ 
                borderTop: '2px solid var(--lcars-orange)', 
                paddingTop: '20px',
                animation: 'fadeIn 0.3s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span className={`lcars-badge ${selectedOption === currentQuestion.answer ? 'green' : 'red'}`}>
                    {selectedOption === currentQuestion.answer ? 'CORRECT' : 'INCORRECT'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--lcars-blue)' }}>
                    SYNAPTIC DEBRIEF
                  </span>
                </div>
                
                <button 
                  className="lcars-button secondary" 
                  onClick={() => setShowExplanation(prev => !prev)}
                  style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px' }}
                >
                  {showExplanation ? 'Hide Explanation' : 'Why is this correct?'}
                </button>
              </div>
              
              {showExplanation && (
                <p className="blink-in" style={{ fontSize: '14px', color: '#ccc', marginBottom: '20px', lineHeight: '1.5', backgroundColor: '#090a0f', padding: '12px', borderLeft: '3px solid var(--lcars-peach)', borderRadius: '4px' }}>
                  {currentQuestion.explanation}
                </p>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="lcars-button" onClick={handleNext}>
                  {currentIdx + 1 === questions.length ? 'FINISH SIMULATION' : 'NEXT EXERCISE'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Summary Screen */
        <div className="lcars-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <span style={{ fontSize: '48px' }}>🎖️</span>
          <h2 style={{ color: 'var(--lcars-gold)', marginTop: '20px', fontSize: '28px' }}>SIMULATION TERMINATED</h2>
          
          <div style={{ margin: '30px auto', maxWidth: '300px' }}>
            <div className="lcars-panel" style={{ display: 'flex', flexDirection: 'column', padding: '20px', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Final Correct:</span>
                <span className={`lcars-badge ${getAccuracyClass((score / questions.length) * 100)}`}>
                  {score} / {questions.length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Points Earned:</span>
                <span className="lcars-badge peach">+{score * 10} XP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Accuracy:</span>
                <span className="lcars-badge blue">{Math.round((score / questions.length) * 100)}%</span>
              </div>
            </div>
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--lcars-blue)', fontSize: '14px', margin: '20px 0' }}>
            {getSystemStatusText()}
          </p>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
            <button className="lcars-button" onClick={() => setQuizConfig({ ...quizConfig })}>
              Re-run Simulation
            </button>
            <button className="lcars-button secondary" onClick={() => setActiveTab('dashboard')}>
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
