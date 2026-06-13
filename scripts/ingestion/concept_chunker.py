from html.parser import HTMLParser
import re

class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = []
    def handle_data(self, d):
        self.text.append(d)
    def get_data(self):
        return ''.join(self.text)

def strip_tags(html):
    s = MLStripper()
    s.feed(html)
    return s.get_data()

# Define keywords for concepts mapping (Knowledge Graph)
CONCEPT_TAGS = {
    "MCP": ["mcp", "model context protocol", "mcp server", "mcp-server"],
    "Claude Code": ["claude code", "claude.md", "claude_code", "/doctor", "/init", "/search"],
    "Ollama": ["ollama", "local model", "llama3", "gemma", "qwen", "phi3", "inference"],
    "Next.js": ["nextjs", "next.js", "next16", "react", "frontend"],
    "Stripe": ["stripe", "payment", "subscription", "checkout", "webhook"],
    "OpenAI": ["openai", "openai api", "gpt-4", "gpt-3"],
    "Agents": ["agent", "agents", "agentic", "autonomy", "workflow"],
    "Skills": ["skill", "skills", "skill.md", "custom command"]
}

def chunk_html_documents(html_documents, book_id):
    """
    Splits HTML documents by header tags and parses them into structured concept chunks,
    detecting difficulty levels, matching knowledge topics, and extracting code snippets.
    """
    current_chapter = "Introduction"
    chunks = []
    
    for href, html_content in html_documents:
        pattern = re.compile(r'(<h[12][^>]*>.*?</h[12]>)', re.IGNORECASE | re.DOTALL)
        parts = pattern.split(html_content)
        
        if len(parts) <= 1:
            continue
            
        i = 1
        while i < len(parts):
            tag = parts[i]
            content = parts[i+1] if (i+1) < len(parts) else ""
            i += 2
            
            tag_match = re.match(r'<h([12])[^>]*>(.*?)</h\1>', tag, re.IGNORECASE | re.DOTALL)
            if not tag_match:
                continue
            
            level = tag_match.group(1)
            heading_text = strip_tags(tag_match.group(2)).strip()
            heading_text = re.sub(r'\s+', ' ', heading_text)
            
            if level == '1':
                current_chapter = heading_text
            else:
                clean_content = strip_tags(content).strip()
                if not clean_content:
                    continue
                matched_tags = []
                lower_content = clean_content.lower()
                for tag_name, keywords in CONCEPT_TAGS.items():
                    for kw in keywords:
                        if kw in lower_content:
                            matched_tags.append(tag_name)
                            break
                            
                difficulty = "Beginner"
                if "advanced" in lower_content or "production" in lower_content or "security" in lower_content:
                    difficulty = "Advanced"
                elif "test" in lower_content or "workflow" in lower_content or "custom" in lower_content:
                    difficulty = "Intermediate"
                    
                code_snippets = re.findall(r'<pre[^>]*>(.*?)</pre>', content, re.IGNORECASE | re.DOTALL)
                clean_code = [strip_tags(code).strip() for code in code_snippets]
                
                chunk_id = f"{book_id}_chunk_{len(chunks)}"
                chunks.append({
                    "id": chunk_id,
                    "title": heading_text,
                    "chapter": current_chapter,
                    "content": clean_content[:2000],
                    "code": clean_code,
                    "difficulty": difficulty,
                    "tooling": matched_tags,
                    "raw_html": content[:3000]
                })
    return chunks
