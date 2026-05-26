#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【192.168.0.32 Windows 這台執行】
功能：聲音檔 → Whisper 轉文字 → 送給 Mac Mini (192.168.0.35) Ollama 分析
"""

import whisper
import requests
import sys
import os

# ── 設定區 ──────────────────────────────────────────
MAC_MINI_URL = "http://192.168.0.35:8000/analyze"
API_KEY      = "my-secret-key-2025"   # 兩台要一致

WHISPER_MODEL = "base"   # tiny / base / small / medium / large（越大越準但越慢）
# ────────────────────────────────────────────────────


def transcribe(audio_path: str) -> str:
    """用 Whisper 把聲音檔轉成文字"""
    print(f"[1/3] 載入 Whisper 模型 ({WHISPER_MODEL})...")
    model = whisper.load_model(WHISPER_MODEL)

    print(f"[2/3] 轉換中：{audio_path}")
    result = model.transcribe(audio_path, language="zh")
    text = result["text"].strip()

    print(f"      轉換結果：{text}")
    return text


def send_to_mac_mini(text: str) -> str:
    """把文字送給 Mac Mini Ollama 分析，回傳 AI 回應"""
    print(f"[3/3] 送出分析請求到 Mac Mini...")
    try:
        response = requests.post(
            MAC_MINI_URL,
            json={"text": text},
            headers={"x-api-key": API_KEY},
            timeout=120
        )
        response.raise_for_status()
        result = response.json()
        return result.get("analysis", "（無回應）")

    except requests.exceptions.ConnectionError:
        return "❌ 無法連線到 Mac Mini，請確認 192.168.0.35 的 API 服務有啟動"
    except requests.exceptions.Timeout:
        return "❌ Mac Mini 回應逾時（超過 120 秒）"
    except Exception as e:
        return f"❌ 錯誤：{e}"


def main():
    if len(sys.argv) < 2:
        print("用法：python audio_to_text.py 聲音檔.wav")
        print("範例：python audio_to_text.py C:\\錄音\\meeting.wav")
        sys.exit(1)

    audio_path = sys.argv[1]

    if not os.path.exists(audio_path):
        print(f"❌ 找不到檔案：{audio_path}")
        sys.exit(1)

    # 轉文字
    text = transcribe(audio_path)

    if not text:
        print("❌ Whisper 沒有辨識出任何文字")
        sys.exit(1)

    # 送給 Mac Mini 分析
    analysis = send_to_mac_mini(text)

    print("\n" + "="*60)
    print("【AI 分析結果】")
    print("="*60)
    print(analysis)
    print("="*60)


if __name__ == "__main__":
    main()
