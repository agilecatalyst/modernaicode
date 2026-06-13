import os
import sys
import json

# Add current folder to sys.path to allow sibling imports when run from anywhere
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from epub_loader import load_epub
from concept_chunker import chunk_html_documents, CONCEPT_TAGS
from llm_generator import detect_local_llms, generate_llm_quiz, DEFAULT_QUIZZES

def build_knowledge_graph(all_chunks):
    """
    Constructs the nodes and links for the interactive Synapse Knowledge Graph
    on the client side.
    """
    nodes = []
    links = []
    
    tag_counts = {}
    for chunk in all_chunks:
        for tag in chunk["tooling"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
            
    for tag, count in tag_counts.items():
        nodes.append({
            "id": tag,
            "type": "concept",
            "val": count + 5,
            "group": 1 if tag in ["Claude Code", "MCP", "Skills"] else (2 if tag in ["Ollama", "Agents"] else 3)
        })
        
    books_added = set()
    for chunk in all_chunks:
        book_id = chunk["book_id"]
        book_title = chunk["book_title"]
        if book_id not in books_added:
            nodes.append({
                "id": book_id,
                "label": book_title,
                "type": "book",
                "val": 15,
                "group": 0
            })
            books_added.add(book_id)
            
    link_map = {}
    for chunk in all_chunks:
        book_id = chunk["book_id"]
        
        for tag in chunk["tooling"]:
            link_key = f"{book_id}---{tag}"
            link_map[link_key] = link_map.get(link_key, 0) + 1
            
        tooling = chunk["tooling"]
        for idx, tag1 in enumerate(tooling):
            for tag2 in tooling[idx+1:]:
                t1, t2 = sorted([tag1, tag2])
                link_key = f"{t1}---{t2}"
                link_map[link_key] = link_map.get(link_key, 0) + 1
                
    for key, weight in link_map.items():
        source, target = key.split("---")
        links.append({
            "source": source,
            "target": target,
            "value": weight
        })
        
    return {"nodes": nodes, "links": links}

def run_pipeline():
    print("="*60)
    print("Starfleet Holodeck: Ingestion Pipeline (Modular Core)")
    print("="*60)
    
    # Check for model override in arguments
    model_override = None
    for arg in sys.argv:
        if arg.startswith("--model="):
            model_override = arg.split("=")[1]
        elif arg == "--model" or arg == "-m":
            try:
                idx = sys.argv.index(arg)
                if idx + 1 < len(sys.argv):
                    model_override = sys.argv[idx + 1]
            except ValueError:
                pass

    # Resolve paths relative to project root
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ebooks_dir = os.path.join(base_dir, "ebooks")
    output_db_path = os.path.join(base_dir, "src", "database.json")
    
    os.makedirs(os.path.dirname(output_db_path), exist_ok=True)
    
    # 1. Scan local LLM core
    llm_engine = detect_local_llms()
        
    # 2. Parse EPUBs
    books_data = []
    flat_chunks = []
    
    if not os.path.exists(ebooks_dir):
        print(f"CRITICAL ERROR: EPUB folder does not exist at {ebooks_dir}")
        return
        
    epubs = [f for f in os.listdir(ebooks_dir) if f.endswith('.epub')]
    for ep in epubs:
        epub_path = os.path.join(ebooks_dir, ep)
        result = load_epub(epub_path)
        if result:
            books_data.append(result["book"])
            chunks = chunk_html_documents(result["html_documents"], result["book"]["id"])
            for chunk in chunks:
                chunk["book_id"] = result["book"]["id"]
                chunk["book_title"] = result["book"]["title"]
                flat_chunks.append(chunk)
                
    if not flat_chunks:
        print("CRITICAL ERROR: No data parsed from EPUB files.")
        return
        
    print(f"Total Concepts Extracted: {len(flat_chunks)}")
        
    # 3. Generate Quizzes
    quizzes = []
    print("\nGenerating Training Quizzes...")
    if llm_engine:
        generation_count = 0
        active_model = None
        if model_override:
            for m in llm_engine["models"]:
                if model_override.lower() in m.lower():
                    active_model = m
                    break
            if not active_model:
                print(f"⚠️ Warning: Model override '{model_override}' not detected in active list.")
                
        if not active_model:
            # Auto-prioritize Gemma-4 models
            for m in llm_engine["models"]:
                if "gemma-4" in m.lower():
                    active_model = m
                    break
                    
        if not active_model:
            active_model = llm_engine["models"][0] if llm_engine["models"] else "default"
            
        print(f"Selecting local LLM for generation: {active_model} ({llm_engine['type'].upper()})")
        
        for chunk in flat_chunks:
            if generation_count < 50:
                print(f"  - Generating question using local LLM for concept: {chunk['title']}")
                quiz = generate_llm_quiz(chunk["title"], chunk["content"], llm_engine)
                if quiz:
                    quiz["id"] = f"quiz_{generation_count}"
                    quiz["chunk_id"] = chunk["id"]
                    quiz["book_id"] = chunk["book_id"]
                    quizzes.append(quiz)
                    generation_count += 1
                    continue
            
            # Match default quizzes without falling back to a repetitive template
            for dq in DEFAULT_QUIZZES:
                if any(tag.lower() in chunk["title"].lower() or tag.lower() in chunk["content"].lower() for tag in CONCEPT_TAGS.get(dq["topic"], [])):
                    q_clone = dq.copy()
                    q_clone["id"] = f"quiz_fb_{len(quizzes)}"
                    q_clone["chunk_id"] = chunk["id"]
                    q_clone["book_id"] = chunk["book_id"]
                    quizzes.append(q_clone)
                    break
    else:
        print("  - Hydrating database with static default quizzes.")
        for i, chunk in enumerate(flat_chunks):
            for dq in DEFAULT_QUIZZES:
                keywords = CONCEPT_TAGS.get(dq["topic"], [])
                if any(kw in chunk["content"].lower() for kw in keywords):
                    q_clone = dq.copy()
                    q_clone["id"] = f"quiz_fb_{len(quizzes)}"
                    q_clone["chunk_id"] = chunk["id"]
                    q_clone["book_id"] = chunk["book_id"]
                    quizzes.append(q_clone)
                    break

    # 4. Build Graph
    graph_data = build_knowledge_graph(flat_chunks)
    
    # 5. Save all database.json
    db = {
        "books": books_data,
        "chunks": flat_chunks,
        "graph": graph_data,
        "quizzes": quizzes
    }
    
    with open(output_db_path, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2)
        
    print(f"\nSUCCESS: Database successfully built. Written to {output_db_path}")
    print(f"Total Books Ingested: {len(books_data)}")
    print(f"Total Concept Chunks: {len(flat_chunks)}")
    print(f"Total Quizzes Generated: {len(quizzes)}")
    print(f"Total Knowledge Graph Nodes: {len(graph_data['nodes'])}")

if __name__ == "__main__":
    run_pipeline()
