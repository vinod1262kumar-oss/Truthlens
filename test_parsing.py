from parsing import extract_json, normalize, sniff_media_type

def test_fenced_json():
    assert extract_json('Here:\n```json\n{"a": 1}\n```') == {"a": 1}

def test_normalize_cleans_bad_values():
    r = normalize({"per100g": {"sugar_g": "12.5", "sodium_mg": -5, "fibre_g": "abc", "protein_g": True},
                   "claims": [{"text": "High protein", "type": "protein"}, {"text": "Yummy", "type": "??"}, {"text": " "}],
                   "type": "drink"})
    assert r["per100g"]["sugar_g"] == 12.5
    assert r["per100g"]["sodium_mg"] is None and r["per100g"]["fibre_g"] is None and r["per100g"]["protein_g"] is None
    assert [c["type"] for c in r["claims"]] == ["protein", "other"]
    assert r["type"] == "drink"

def test_sniff():
    assert sniff_media_type(b"\xff\xd8\xff\xe0abc") == "image/jpeg"
    assert sniff_media_type(b"RIFF\x00\x00\x00\x00WEBPVP8") == "image/webp"
    assert sniff_media_type(b"<html>") is None
