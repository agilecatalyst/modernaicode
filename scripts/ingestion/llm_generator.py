import json
import urllib.request
import urllib.error
import re
from concept_chunker import CONCEPT_TAGS

# Disable system proxy settings for local development queries
proxy_support = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_support)
urllib.request.install_opener(opener)

# Pre-defined high-quality questions for key topics as a solid fallback
DEFAULT_QUIZZES = [
    {
        "topic": "Claude Code",
        "question": "What is the primary purpose of the /doctor command in Claude Code?",
        "options": [
            "To run system health diagnostics and verify the CLI configuration.",
            "To automatically rewrite failing unit tests.",
            "To send a crash report directly to the Anthropic engineering team.",
            "To check if the local server has an active internet connection."
        ],
        "answer": 0,
        "explanation": "Running /doctor allows you to diagnostic check the CLI environment and diagnose configuration or path errors."
    },
    {
        "topic": "Claude Code",
        "question": "Where should project-level system instructions and rules be placed for Claude Code to read?",
        "options": [
            "In a file named CLAUDE.md in the project root.",
            "In the package.json file under the 'claude' configuration block.",
            "In an environment variable named CLAUDE_SYSTEM_PROMPT.",
            "In the global user settings file located in the user's home directory."
        ],
        "answer": 0,
        "explanation": "Claude Code checks for a CLAUDE.md file in the root of the workspace to load project conventions and instructions."
    },
    {
        "topic": "MCP",
        "question": "How do Model Context Protocol (MCP) servers extend an agent's capabilities?",
        "options": [
            "By providing standardized interfaces to expose local tools, files, and enterprise APIs.",
            "By compiling Python scripts into high-performance C++ binaries.",
            "By automatically compressing context window tokens to allow longer chats.",
            "By hosting secondary LLM weights locally in a secure sandbox."
        ],
        "answer": 0,
        "explanation": "MCP servers connect LLM agents to external data sources and tools through a unified protocol standard."
    },
    {
        "topic": "Ollama",
        "question": "Which of the following commands starts a local model container and starts an interactive prompt in Ollama?",
        "options": [
            "ollama run <model-name>",
            "ollama start <model-name>",
            "ollama prompt <model-name>",
            "ollama exec <model-name>"
        ],
        "answer": 0,
        "explanation": "The command 'ollama run' pulls the model (if not already local) and opens a chat session with it."
    },
    {
        "topic": "Stripe",
        "question": "Why is it critical to use a Webhook signature verification in Stripe integrations?",
        "options": [
            "To verify that incoming events were sent by Stripe and not forged by malicious third parties.",
            "To encrypt payment card data before sending it to the client side.",
            "To bypass standard double-spend check constraints on the database.",
            "To speed up Stripe server response times during busy checkout events."
        ],
        "answer": 0,
        "explanation": "Signature verification checks that the webhook payload is signed by Stripe using a shared secret, preventing spoofing."
    }
]

def detect_local_llms():
    """
    Attempts to detect a running local LLM core (LM Studio on port 1234 or Ollama on port 11434).
    Returns connection parameters or None.
    """
    # 1. Check LM Studio (usually port 1234)
    for host in ["127.0.0.1", "localhost"]:
        try:
            url = f"http://{host}:1234/v1/models"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    models = [m['id'] for m in data.get('data', [])]
                    print(f"✨ LM Studio core detected on {host}. Available models: {models}")
                    return {"type": "lm-studio", "url": f"http://{host}:1234/v1/chat/completions", "models": models}
        except Exception as e:
            pass

    # 2. Check Ollama (usually port 11434)
    for host in ["127.0.0.1", "localhost"]:
        try:
            url = f"http://{host}:11434/api/tags"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    models = [m['name'] for m in data.get('models', [])]
                    print(f"✨ Ollama core detected on {host}. Available models: {models}")
                    return {"type": "ollama", "url": f"http://{host}:11434/api/chat", "models": models}
        except Exception as e:
            pass

    print("⚠️ No active local LLM cores (LM Studio/Ollama) scanned. Falling back to local heuristic quiz generator.")
    return None

def generate_llm_quiz(chunk_title, chunk_text, engine):
    """
    Generates exactly one multiple choice question based on the concept chunk text using the active LLM.
    """
    model_name = engine["models"][0] if engine["models"] else "default"
    
    prompt = f"""
    Generate exactly one high-quality multiple choice quiz question based on this technical documentation segment.
    Title: {chunk_title}
    Text: {chunk_text[:1500]}
    
    The question must test deep conceptual understanding or syntax.
    You MUST respond in strict JSON format with exactly these fields:
    {{
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answer": 0,
      "explanation": "string"
    }}
    The 'answer' field must be an integer from 0 to 3 representing the index of the correct option.
    Do not add any markdown framing (like ```json) or leading/trailing text. Output raw JSON only.
    """

    try:
        if engine["type"] == "lm-studio":
            # OpenAI compatible endpoint
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a Starfleet training computer. Output raw JSON ONLY."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
        else:
            # Ollama API
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "options": {
                    "temperature": 0.3
                }
            }
            
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            engine["url"],
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req, timeout=90) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            
            if engine["type"] == "lm-studio":
                response_text = res_data["choices"][0]["message"]["content"].strip()
            else:
                response_text = res_data["message"]["content"].strip()
                
            # Strip markdown block indicators if returned
            if response_text.startswith("```"):
                response_text = re.sub(r'^```(json)?|```$', '', response_text, flags=re.MULTILINE).strip()
                
            quiz = json.loads(response_text)
            if "question" in quiz and "options" in quiz and len(quiz["options"]) == 4 and "answer" in quiz:
                return quiz
    except Exception as e:
        print(f"🔍 [Debug] Quiz generation failed for chunk '{chunk_title}': {e} (Type: {type(e).__name__})")
        return None
