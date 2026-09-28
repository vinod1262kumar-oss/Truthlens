# Label Check backend (FastAPI)

Receives 1-3 photos of a food label, asks Claude to read them, and returns clean JSON for the front end.
The API key stays on the server. Images are not saved or logged.

## Run locally
    python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env                                     # then paste your ANTHROPIC_API_KEY
    uvicorn main:app --reload --port 8000
    pytest                                                   # optional: tests the parsing helpers

Check it: open http://localhost:8000/api/health and http://localhost:8000/docs

## Endpoint
`POST /api/read-label`  (multipart form, field name `images`, up to 3 files, JPEG/PNG/WebP/GIF, 5 MB each)

Response:
    { "is_food_label": true, "brand": "", "product": "", "type": "solid|drink",
      "claims": [{"text": "", "type": "protein|fibre|sugar_free|low_sugar|low_fat|natural|other"}],
      "ingredients": [], "additives": [],
      "per100g": {"energy_kcal": null, "sugar_g": null, "added_sugar_g": null, "fat_g": null,
                  "sat_fat_g": null, "trans_fat_g": null, "sodium_mg": null, "protein_g": null, "fibre_g": null},
      "notes": "" }
Unreadable numbers come back as `null`, never guessed. Errors: 400 (bad count), 413 (too big), 415 (not an image),
422 (not a food label), 429 (rate limit), 502 (reader failed).

## Connect the front end
1. In the front end's `js/app.js` set `const LABEL_API_URL = 'http://localhost:8000/api/read-label';`
2. In the `fill(d)` function add one line: `$('type').value = d.type || 'solid';`
3. Put the front end's address in `ALLOWED_ORIGINS` in `.env` (CORS), e.g. `http://127.0.0.1:5500`.

## Deploy
Docker: `docker build -t label-check-api . && docker run -p 8000:8000 --env-file .env label-check-api`
(Render, Railway or Fly.io work the same way.) Use HTTPS in production and set `ALLOWED_ORIGINS` to your real site only.

## Before you scale
- The rate limiter is in-memory, per server. Use Redis or your host's gateway limits when you run several servers.
- Cache results by barcode (Open Food Facts) so the same product is not read twice.
- Add a user login or API token before public launch, since each call costs money.
- A wrong reading is possible. Keep the front end's "check the numbers" step.
