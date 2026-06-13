#!/usr/bin/env python3
import sys
import os
import subprocess

if __name__ == "__main__":
    # Locate the modular orchestrator main.py
    current_dir = os.path.dirname(os.path.abspath(__file__))
    ingestion_main = os.path.join(current_dir, "ingestion", "main.py")
    
    # Execute the modular pipeline, propagating all sys.argv options
    cmd = [sys.executable, ingestion_main] + sys.argv[1:]
    result = subprocess.run(cmd)
    sys.exit(result.returncode)
