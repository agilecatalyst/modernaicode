import urllib.request
import json

# Disable system proxy settings for local development queries
proxy_support = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_support)
urllib.request.install_opener(opener)

def test_connection():
    print("🛰️ Connecting to LM Studio on 127.0.0.1:1234...")
    try:
        # 1. Fetch models
        req = urllib.request.Request("http://127.0.0.1:1234/v1/models")
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            models = [m['id'] for m in data.get('data', [])]
            print(f"✨ Models found: {models}")
            if not models:
                print("❌ No models loaded in LM Studio!")
                return
            model_name = models[0]
            
        # 2. Test generation
        print(f"🚀 Testing generation with model: {model_name}...")
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": "Output raw JSON format only."},
                {"role": "user", "content": "Generate a JSON with a single key 'status' and value 'nominal'."}
            ],
            "temperature": 0.3
        }
        
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            "http://127.0.0.1:1234/v1/chat/completions",
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            print("📬 Response received successfully!")
            print(json.dumps(res_data, indent=2))
            
    except Exception as e:
        print(f"❌ Error encountered: {e}")
        if hasattr(e, 'read'):
            try:
                print(f"📄 Error response body: {e.read().decode('utf-8')}")
            except Exception:
                pass

if __name__ == "__main__":
    test_connection()
