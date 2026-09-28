"""Pure helpers (stdlib only): image sniffing, JSON extraction, output cleaning."""
import json
import re

CLAIM_TYPES = {"protein", "fibre", "sugar_free", "low_sugar", "low_fat", "natural", "other"}
NUM_FIELDS = ["energy_kcal", "sugar_g", "added_sugar_g", "fat_g", "sat_fat_g",
              "trans_fat_g", "sodium_mg", "protein_g", "fibre_g"]


def sniff_media_type(data: bytes):
    """Trust the file's bytes, not the client's Content-Type header."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def extract_json(text: str) -> dict:
    """Model output may be wrapped in ```json fences or have stray text."""
    text = re.sub(r"```(?:json)?", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found")
    return json.loads(text[start:end + 1])


def _num(v):
    if isinstance(v, bool) or v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if 0 <= f < 100000 else None


def normalize(raw: dict) -> dict:
    """Force the model's answer into the exact shape the front end expects."""
    per = raw.get("per100g") if isinstance(raw.get("per100g"), dict) else {}
    claims = []
    for c in raw.get("claims") or []:
        if isinstance(c, dict) and str(c.get("text", "")).strip():
            t = c.get("type") if c.get("type") in CLAIM_TYPES else "other"
            claims.append({"text": str(c["text"]).strip()[:200], "type": t})
    ingredients = [str(i).strip()[:120] for i in (raw.get("ingredients") or []) if str(i).strip()][:80]
    additives = [str(i).strip()[:80] for i in (raw.get("additives") or []) if str(i).strip()][:40]
    return {
        "is_food_label": bool(raw.get("is_food_label", True)),
        "brand": str(raw.get("brand") or "")[:80],
        "product": str(raw.get("product") or "")[:120],
        "type": "drink" if raw.get("type") == "drink" else "solid",
        "claims": claims[:12],
        "ingredients": ingredients,
        "additives": additives,
        "per100g": {k: _num(per.get(k)) for k in NUM_FIELDS},
        "notes": str(raw.get("notes") or "")[:300],
    }
