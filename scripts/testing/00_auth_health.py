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

    print(f"[AUTH] Base URL: {base_url}")

    status, data, text = client.request("GET", "/health")
    print(f"[AUTH] /health -> {status}")

    try:
        token = login(client)
    except Exception as exc:
        print(f"[AUTH] Login error: {exc}")
        return 1

    if not token:
        print("[AUTH] Missing token in login response.")
        return 1

    client.set_token(token)
    print("[AUTH] Login ok")

    status, data, text = client.request("GET", "/api/auth/verify")
    print(f"[AUTH] /api/auth/verify -> {status}")

    status, data, text = client.request("GET", "/api/auth/me")
    print(f"[AUTH] /api/auth/me -> {status} user={data.get('username')}")

    status, data, text = client.request("GET", "/api/config/")
    print(f"[AUTH] /api/config -> {status}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
