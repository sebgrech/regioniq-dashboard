from __future__ import annotations

import os
from typing import Any

import requests


class SupabaseRestClient:
    def __init__(self, supabase_url: str, anon_key: str):
        self.supabase_url = supabase_url.rstrip("/")
        self.anon_key = anon_key

    def _headers(self, bearer_jwt: str) -> dict[str, str]:
        return {
            "apikey": self.anon_key,
            "authorization": f"Bearer {bearer_jwt}",
            "accept": "application/json",
        }

    def get(
        self,
        table: str,
        bearer_jwt: str,
        params: Any,
        *,
        timeout: int = 15,
    ) -> list[dict[str, Any]]:
        url = f"{self.supabase_url}/rest/v1/{table}"
        r = requests.get(url, headers=self._headers(bearer_jwt), params=params, timeout=timeout)
        if r.status_code >= 400:
            raise RuntimeError(f"Supabase REST error {r.status_code}: {r.text}")
        return r.json()


def get_supabase_rest() -> SupabaseRestClient:
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not supabase_url or not anon_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set for Supabase REST access")
    return SupabaseRestClient(supabase_url=supabase_url, anon_key=anon_key)


