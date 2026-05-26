#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【Mac Mini (192.168.0.35) 上執行】
功能：接收文字 → 送給 Ollama 分析 → 回傳結果

安裝：pip install fastapi uvicorn requests
啟動：python mac_mini_server.py
"""

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import requests
import uvicorn

# ── 設定區 ──────────────────────────────────────────
API_KEY      = "my-secret-key-2025"   # 兩台要一致
OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"                # 或 mistral / gemma 等，依你裝的而定

SYSTEM_PROMPT = "你是一個專業的語音內容分析助手，請根據以下語音轉文字內容給予重點摘要與分析。"
# ────────────────────────────────────────────────────

app = FastAPI(title="Mac Mini 語音分析 API")


class TextRequest(BaseModel):
    text: str


@app.post("/analyze")
async def analyze(req: TextRequest, x_api_key: str = Header(None)):
    # 驗證 API Key
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="API Key 錯誤，拒絕存取")

    # 驗證內容不為空
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="文字內容不可為空")

    print(f"[收到] 文字長度：{len(req.text)} 字")
    print(f"[內容] {req.text[:100]}...")

    # 送給 Ollama
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": f"{SYSTEM_PROMPT}\n\n語音內容：{req.text}",
                "stream": False
            },
            timeout=120
        )
        response.raise_for_status()
        result = response.json()
        analysis_text = result.get("response", "（Ollama 無回應）")

        print(f"[完成] 分析完畢")
        return {"status": "ok", "analysis": analysis_text}

    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Ollama 服務未啟動，請執行 ollama serve")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析錯誤：{str(e)}")


@app.get("/health")
def health():
    """測試 API 是否正常運作"""
    return {"status": "ok", "message": "Mac Mini API 服務正常"}


if __name__ == "__main__":
    print("Mac Mini 語音分析 API 啟動中...")
    print("監聽位址：http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
