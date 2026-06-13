import os
import json
import re
import sys

def test_database_schema(db_path):
    print("🧪 Running Test Case 1: Database Schema Validation...")
    if not os.path.exists(db_path):
        print(f"❌ Fail: database.json not found at {db_path}")
        return False
        
    try:
        with open(db_path, 'r', encoding='utf-8') as f:
            db = json.load(f)
    except Exception as e:
        print(f"❌ Fail: database.json is not valid JSON. Error: {e}")
        return False

    success = True
    
    # 1. Check core arrays
    for key in ["books", "chunks", "graph", "quizzes"]:
        if key not in db:
            print(f"❌ Fail: Missing key '{key}' in database root.")
            success = False
            
    if not success:
        return False

    # 2. Validate Books
    print(f"  - Ingested books detected: {len(db['books'])}")
    for idx, book in enumerate(db["books"]):
        for field in ["id", "title", "author", "file"]:
            if field not in book:
                print(f"❌ Fail: Book [{idx}] is missing field '{field}'")
                success = False

    # 3. Validate Chunks
    print(f"  - Concept chunks detected: {len(db['chunks'])}")
    for idx, chunk in enumerate(db["chunks"]):
        for field in ["id", "book_id", "book_title", "title", "chapter", "content", "code", "difficulty", "tooling"]:
            if field not in chunk:
                print(f"❌ Fail: Chunk [{idx}] is missing field '{field}'")
                success = False
        
        # Verify lists are correctly typed
        if not isinstance(chunk.get("code", []), list):
            print(f"❌ Fail: Chunk '{chunk.get('id')}' code field is not an array.")
            success = False
        if not isinstance(chunk.get("tooling", []), list):
            print(f"❌ Fail: Chunk '{chunk.get('id')}' tooling field is not an array.")
            success = False

    # 4. Validate Quizzes (Anti-Cheat Validation)
    print(f"  - Quiz modules detected: {len(db['quizzes'])}")
    quiz_ids = set()
    for idx, q in enumerate(db["quizzes"]):
        q_id = q.get("id")
        if not q_id:
            print(f"❌ Fail: Quiz [{idx}] is missing ID.")
            success = False
            continue
            
        if q_id in quiz_ids:
            print(f"❌ Fail: Duplicate quiz ID found: {q_id}")
            success = False
        quiz_ids.add(q_id)

        for field in ["id", "chunk_id", "book_id", "question", "options", "answer", "explanation"]:
            if field not in q:
                print(f"❌ Fail: Quiz '{q_id}' is missing field '{field}'")
                success = False
                
        # Validate options array length
        options = q.get("options", [])
        if not isinstance(options, list) or len(options) != 4:
            print(f"❌ Fail: Quiz '{q_id}' options field must be an array of exactly 4 choices. Got: {options}")
            success = False
            
        # Validate answer range
        ans = q.get("answer")
        if not isinstance(ans, int) or ans < 0 or ans > 3:
            print(f"❌ Fail: Quiz '{q_id}' answer field must be an integer between 0 and 3. Got: {ans}")
            success = False

    # 5. Validate Knowledge Graph Connectivity
    print("  - Verifying Knowledge Graph linkages...")
    nodes = {n["id"]: n for n in db["graph"]["nodes"]}
    for idx, link in enumerate(db["graph"]["links"]):
        src = link.get("source")
        tgt = link.get("target")
        
        if src not in nodes:
            print(f"❌ Fail: Graph Link [{idx}] references missing source node: '{src}'")
            success = False
        if tgt not in nodes:
            print(f"❌ Fail: Graph Link [{idx}] references missing target node: '{tgt}'")
            success = False

    if success:
        print("✅ Success: database.json fully complies with schema rules!")
    return success


def test_jsx_integrity(src_dir):
    print("\n🧪 Running Test Case 2: JSX Code Integrity Sweeper...")
    success = True
    
    # Scanner pattern for unescaped '>' inside tags
    # Matches a lone '>' symbol that has leading space, followed by text, not inside angle brackets or comments
    # Avoids arrow functions (=>) or markdown files
    jsx_text_pattern = re.compile(r'[^=\-]\s+>\s+[a-zA-Z]')
    
    for root_dir, _, files in os.walk(src_dir):
        for f in files:
            if f.endswith('.jsx'):
                file_path = os.path.join(root_dir, f)
                try:
                    with open(file_path, 'r', encoding='utf-8') as file_obj:
                        lines = file_obj.readlines()
                        
                    for line_idx, line in enumerate(lines):
                        # Simple detection for > followed by uppercase/lowercase words
                        # e.g., > NOTE:
                        if jsx_text_pattern.search(line) and not "//" in line and not "/*" in line:
                            # Verify if it is inside JSX markup (checking for standard elements)
                            print(f"⚠️ Warning: Potential raw '>' character detected at {os.path.basename(file_path)}:L{line_idx+1}")
                            print(f"   Line content: '{line.strip()}'")
                            print("   (Ensure this is escaped as &gt; if inside text elements)\n")
                except Exception as e:
                    print(f"❌ Fail: Could not scan file {file_path}. Error: {e}")
                    success = False
                    
    if success:
        print("✅ Success: Code scanner completed diagnostic checks.")
    return success


if __name__ == "__main__":
    print("="*60)
    print("Starfleet Holodeck: Integration Validation Suite")
    print("="*60)
    
    db_path = "/Users/dirkverstraete/Documents/modernaicode/src/database.json"
    src_dir = "/Users/dirkverstraete/Documents/modernaicode/src"
    
    db_ok = test_database_schema(db_path)
    jsx_ok = test_jsx_integrity(src_dir)
    
    if db_ok and jsx_ok:
        print("\n🎉 ALL DIAGNOSTIC CHECKS PASSED. WARP DRIVE CLEARED FOR LAUNCH!")
        sys.exit(0)
    else:
        print("\n🔴 DIAGNOSTIC CHECK FAIL: System core verification failed.")
        sys.exit(1)
