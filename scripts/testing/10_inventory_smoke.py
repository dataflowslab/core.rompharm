import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(ROOT)

from _tools.http_client import SimpleHttpClient, get_env  # noqa: E402


def login(client: SimpleHttpClient) -> str:
    token = get_env("DF_TOKEN")
    if token:
        return token

    username = get_env("DF_USERNAME")
    password = get_env("DF_PASSWORD")
    if not username or not password:
        raise RuntimeError("Missing DF_USERNAME/DF_PASSWORD (or DF_TOKEN).")

    status, data, text = client.request(
        "POST",
        "/api/auth/login",
        json_body={"username": username, "password": password},
    )
    if status != 200:
        raise RuntimeError(f"Login failed: {status} {text}")
    return data.get("token")


def main() -> int:
    base_url = get_env("DF_BASE_URL", "http://localhost:8000")
    client = SimpleHttpClient(base_url)

    try:
        token = login(client)
    except Exception as exc:
        print(f"[INV] Login error: {exc}")
        return 1

    client.set_token(token)

    status, data, text = client.request("GET", "/modules/inventory/api/stocks", params={"limit": 5})
    stocks = data.get("results", []) if isinstance(data, dict) else (data or [])
    print(f"[INV] /stocks -> {status} count={len(stocks)}")

    status, data, text = client.request("GET", "/modules/inventory/api/stock-states")
    states = data.get("results", data or []) if isinstance(data, dict) else (data or [])
    print(f"[INV] /stock-states -> {status} count={len(states)}")

    status, data, text = client.request("GET", "/modules/inventory/api/locations")
    locations = data.get("results", data or []) if isinstance(data, dict) else (data or [])
    print(f"[INV] /locations -> {status} count={len(locations)}")

    status, data, text = client.request("GET", "/modules/inventory/api/articles", params={"limit": 5})
    articles = data.get("results", []) if isinstance(data, dict) else (data or [])
    print(f"[INV] /articles -> {status} count={len(articles)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
