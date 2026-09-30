"""eas submit 이 쓰는 Google Play 서비스 계정 키가 실제로 이 앱에 접근할 수 있는지 확인한다.

편집(edit)을 열어 트랙 목록만 읽고 커밋하지 않고 지운다. Play 에는 아무것도 바뀌지 않는다.
사용: python scripts/verify-play-service-account.py
"""
import json
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))["expo"]["android"]["package"]
KEY = ROOT / "secrets" / "google-play-service-account.json"

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/androidpublisher"]
)
api = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)
edit = api.edits().insert(packageName=PACKAGE, body={}).execute()
try:
    tracks = api.edits().tracks().list(packageName=PACKAGE, editId=edit["id"]).execute()
    for t in tracks.get("tracks", []):
        codes = [c for r in t.get("releases", []) for c in r.get("versionCodes", [])]
        print(f"{t['track']:12} {codes}")
finally:
    api.edits().delete(packageName=PACKAGE, editId=edit["id"]).execute()
print(f"OK: {creds.service_account_email} 로 {PACKAGE} 에 접근 가능")
