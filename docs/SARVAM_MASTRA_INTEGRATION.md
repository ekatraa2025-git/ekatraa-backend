# Sarvam + Mastra Integration Guide

This document defines the production contract for Ekatraa Agentic AI voice turns:

- Speech input (Sarvam STT) -> Mastra planning agent -> speech output (Sarvam TTS)
- Shared thread and auth context across web/mobile
- Webhook and prompt configuration for voice-safe responses

## 1) Required Environment Variables

### Backend (`ekatraa_backend`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SARVAM_API_KEY` or `SARVAM_API_SUBSCRIPTION_KEY` | Yes (voice) | - | Auth for Sarvam STT/TTS API calls |
| `SARVAM_TTS_MODEL` | No | `bulbul:v3` | Default TTS model |
| `SARVAM_TTS_SPEAKER` | No | `priya` for v3 (`anushka` for v2) | Default voice speaker |
| `SARVAM_STT_URL` | No | `https://api.sarvam.ai/speech-to-text` | STT API URL override |
| `SARVAM_WEBHOOK_SECRET` | No | - | Optional HMAC secret for Sarvam webhook signature verification |
| `VAPI_WEBHOOK_SECRET` | No | - | Optional HMAC secret for Vapi webhook verification |
| `GOOGLE_GENERATIVE_AI_API_KEY` (or `GOOGLE_API_KEY` / `GEMINI_API_KEY`) | Yes (Mastra) | - | Mastra Gemini model key |
| `MASTRA_GEMINI_MODEL` | No | `gemini-2.0-flash` | Mastra agent model |
| `MASTRA_LIBSQL_URL` | Strongly recommended | `:memory:` | Durable Mastra memory/thread storage |
| `EKATRAA_WEB_ORIGINS` | Recommended | empty (= permissive) | Browser CORS allowlist for planning APIs |
| `EKATRAA_WEB_ORIGINS_STRICT` | No | `0` | Enforce strict origin behavior when `1` |

### Mobile app (`ekatraa`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Yes | Base URL used by chat/STT/TTS API client |
| `EXPO_PUBLIC_AI_PLANNING` | Recommended | Enables Mastra planning endpoint path (`1` / `true`) |

### Web app (`ekatraa-web`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_EKATRAA_API_URL` (or `NEXT_PUBLIC_API_URL`) | Yes | Base URL for planning chat/STT/TTS |

## 2) API Contracts (Voice Path)

### A. STT route

- **Endpoint:** `POST /api/public/ai/planning/stt`
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `audio` (file, required) - preferred key
  - `file` (file, optional alias)
  - `language_code` (optional, defaults `en-IN`)
  - `model` (optional)
- **Success response:**

```json
{
  "transcript": "I need wedding planning for Bhubaneswar",
  "language_code": "en-IN",
  "provider": "sarvam",
  "model": null,
  "raw": {}
}
```

### B. Mastra planning turn (voice mode)

- **Endpoint:** `POST /api/public/ai/planning/message`
- **Request additions for voice mode:**
  - `response_mode: "voice"`
  - `voice_target_language_code: "en-IN"`
  - `cart_owner_session_id` (recommended for anonymous cart-aware tools)
- **Success response additions in voice mode:**

```json
{
  "reply": "Planner response text",
  "speech_text": "Voice-safe condensed text",
  "voice": {
    "tts_endpoint": "/api/public/ai/planning/tts",
    "target_language_code": "en-IN"
  },
  "ai_meta": {
    "source": "mastra",
    "provider": "gemini",
    "model": "google/gemini-2.0-flash"
  }
}
```

### C. TTS route

- **Endpoint:** `POST /api/public/ai/planning/tts`
- **Body:**
  - `text` (required)
  - `response_format` (`stream` or `base64`, optional; default `stream`)
  - `target_language_code` (optional, default `en-IN`)
  - `speaker` (optional override)
  - `model` (optional override)
  - `pace` (optional, 0.5 to 2.0)
- **Responses:**
  - `stream`: audio stream response (`audio/mpeg`)
  - `base64`: JSON with `audio_base64`, `mime_type`, and metadata

## 3) Webhook Configuration

### Sarvam webhook

- **Endpoint:** `POST /api/public/sarvam/webhook`
- **Optional signature headers accepted:** `x-sarvam-signature` or `x-signature`
- **Secret env:** `SARVAM_WEBHOOK_SECRET`
- **Verification:** HMAC-SHA256 over raw request body

### Vapi webhook

- **Endpoint:** `POST /api/public/vapi/webhook`
- **Optional signature headers accepted:** `x-vapi-signature` or `x-signature`
- **Secret env:** `VAPI_WEBHOOK_SECRET`
- **Current behavior:** verifies signature (if configured), extracts user text, calls Mastra `event-planning-agent`, returns `reply` + `speech_text`

## 4) Prompt Templates for Sarvam Voice Interface

Use these prompts on any external Sarvam interface that forwards into Ekatraa tools/agent.

### System prompt (primary)

```text
You are Ekatraa Agentic AI voice planner.
Always keep responses concise, natural, and easy to speak aloud.
Use plain text only: no markdown tables, no links, no code blocks.
Ground recommendations in tool outputs and known catalog data; do not invent vendor names, prices, or guarantees.
If data is missing, say what is missing and ask one short clarifying question.
When recommending next steps, limit to 2-4 short bullet-like spoken items.
```

### Tool-failure fallback prompt

```text
A backend tool is unavailable right now.
Apologize briefly, continue with safe high-level guidance only, and ask the user for one concrete detail (city, occasion, or budget) so you can retry.
Do not fabricate unavailable tool data.
```

### Voice response style prompt

```text
Respond in 1-5 short sentences.
Use punctuation that is easy for TTS to read naturally.
Avoid long numeric dumps; summarize ranges and offer to share detailed breakdown in app chat.
```

## 5) Tool-to-Speech Mapping

- Recommendation tables -> short spoken summary of top 2-3 options + price band
- Vendor lists -> name + one qualifier + one actionable next step
- Cart outputs -> current total + one next action (review/add/remove/checkout)
- Errors -> one-line apology + one recovery action

## 6) End-to-End Sequence

### Legacy chunked voice (mobile / web fallback)

1. Client records audio and sends multipart payload to `POST /api/public/ai/planning/stt`
2. Client receives transcript
3. Client sends transcript to `POST /api/public/ai/planning/message` with `response_mode: "voice"`
4. Client receives `reply` + `speech_text`
5. Client calls `POST /api/public/ai/planning/tts` with `speech_text`
6. Client plays returned audio

### Live Pipecat voice (recommended when enabled)

Uses [Pipecat](https://docs.pipecat.ai/pipecat/get-started/introduction) for sub-second round-trip audio with Sarvam streaming STT/TTS. Mastra agents remain the brain via an OpenAI-compatible proxy.

1. Client calls `POST /api/public/ai/voice/session` → receives Pipecat `start_url` + session metadata
2. Client connects WebRTC to Pipecat (`pipecat-service/bot.py` or Pipecat Cloud)
3. Pipecat pipeline: Sarvam STT → `POST /api/public/ai/voice/chat/completions` (Mastra) → Sarvam TTS
4. RTVI transcripts + audio stream to the client in real time

| Component | Path / command |
| --- | --- |
| Pipecat bot | `cd ekatraa_backend/pipecat-service && uv run bot.py` |
| Session bootstrap | `POST /api/public/ai/voice/session` |
| Mastra OpenAI proxy (customer) | `POST /api/public/ai/voice/chat/completions` |
| Mastra OpenAI proxy (vendor) | `POST /api/vendor/ai/voice/chat/completions` |

**Client flags:** `EXPO_PUBLIC_PIPECAT_VOICE=1` (mobile), `NEXT_PUBLIC_PIPECAT_VOICE=1` (web).

**Backend env:** `PIPECAT_SERVICE_URL=http://localhost:7860` (returned to clients from session route).

## 7) Troubleshooting Checklist

- `503` from STT/TTS routes -> verify `SARVAM_API_KEY` / `SARVAM_API_SUBSCRIPTION_KEY`
- Empty transcript -> validate audio MIME, duration, and size (< 12 MB)
- Voice sounds incorrect -> confirm `SARVAM_TTS_MODEL` and speaker compatibility
- Voice mode ignored -> confirm `response_mode: "voice"` in planning message body
- Lost conversation memory -> set persistent `MASTRA_LIBSQL_URL` (avoid `:memory:` in production)
- Cart-aware tools fail for anonymous users → pass `cart_owner_session_id` consistently
- Live Pipecat cannot connect → verify `PIPECAT_SERVICE_URL`, Pipecat bot running, and WebRTC/mic permissions
- Pipecat connects but agent is generic → confirm `EKATRAA_BACKEND_URL` in pipecat `.env` and Mastra keys on backend
