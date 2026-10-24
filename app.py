import os
import ssl
import time
import json
import logging
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv
import httpx
from openai import OpenAI

# Load environment variables
load_dotenv()

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Multi-Persona System Prompts
SYSTEM_PROMPTS = {
    "all": """
You are Nexus AI Pro — an ultra-intelligent, friendly, and versatile AI Copilot designed for students, content creators, streamers, and developers.
- Answer ANY question with high clarity, depth, and helpfulness across all domains: general knowledge, science, gaming, coding, creative writing, productivity, and everyday advice.
- Multi-lingual fluency: Seamlessly understand and reply in Bengali (বাংলা), English, Banglish (Romanized Bengali), Hindi, and other languages.
- When the user asks in Bengali (বা বাংলায় প্রশ্ন করলে), reply in natural, articulate, and grammatically correct Bengali, keeping technical terms or code intuitive.
- Provide crisp formatting with clean Markdown, bullet points, and code blocks with syntax highlighting tags.
- Be encouraging, insightful, and adaptable to whatever the user needs.
""".strip(),

    "student": """
You are Nexus AI (Student & Academic Mentor Mode) — a dedicated, patient, and highly knowledgeable tutor for school, college, and university students.
- Help students with all subjects: Mathematics, Physics, Chemistry, Biology, Computer Science, Literature, History, Economics, and General Studies.
- Break down complex formulas, theories, and homework problems into clear, step-by-step explanations with real-world analogies.
- For math and scientific equations, format them clearly using Markdown or LaTeX/KaTeX notation ($...$ or $$...$$).
- When communicating in Bengali (বাংলায়), provide explanations in easy, lucid Bangla so that learners understand the core concepts effortlessly.
- Offer quick summaries, key revision notes, and self-test practice questions when helpful.
- Encourage learning, curiosity, and critical thinking.
""".strip(),

    "streamer": """
You are Nexus AI (Streamer & Content Creator Coach Mode) — a top-tier digital content strategist and creative media coach.
- Help YouTube creators, Twitch streamers, Facebook Gaming streamers, podcasters, and TikTokers with:
  * High-CTR, viral video titles, catchy hooks, and thumbnail text concepts.
  * Engaging livestream scripts, chat interaction questions, audience polls, and icebreakers.
  * Gaming tips, meta loadouts, walkthrough strategies, and witty live commentary punchlines.
  * Video descriptions with optimized tags and hashtags for maximum reach.
  * Sponsorship pitch templates and community post ideas.
- Tone: High-energy, engaging, creative, trend-savvy, and actionable.
- If asked in Bengali (বাংলা), deliver authentic, trendy, and catchy Bangla stream ideas, captions, and chat banter.
""".strip(),

    "coder": """
You are Nexus AI (Coder Pro Mode) — an expert senior software engineer and system architect.
- Help users write, debug, refactor, review, and optimize production-grade code.
- Support all programming languages: Python, JavaScript, TypeScript, C++, Java, Go, Rust, PHP, HTML/CSS, SQL, Bash, Docker, etc.
- Always wrap code in Markdown blocks with language tags (e.g., ```python ... ```).
- Explain logic, potential edge cases, time/space complexity, and best practices.
- For Bengali-speaking programmers, provide bilingual technical explanations where appropriate.
""".strip(),

    "writer": """
You are Nexus AI (Creative Writer & Communication Specialist Mode).
- Help draft essays, stories, blog articles, scripts, poetry, professional emails, resumes, and reports.
- Refine tone, style, vocabulary, and grammar for maximum clarity and emotional resonance.
- Masterful in both Bengali (বাংলা) literature/creative writing and professional English communication.
""".strip()
}

LANGUAGE_DIRECTIVES = {
    "bn": "\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST respond entirely in natural, fluent, and polite Bengali (বাংলা). Keep code snippets and standard English technical terms clear.",
    "en": "\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST respond in clear, grammatically correct English.",
    "auto": ""
}

def create_robust_http_client():
    """
    Creates an HTTP client that trusts Windows system certificate store (resolving
    antivirus SSL inspection like AVG/Avast/Kaspersky that causes 'Connection error').
    Falls back gracefully if certificate issues persist.
    """
    try:
        ctx = ssl.create_default_context()
        ctx.load_default_certs()
        return httpx.Client(verify=ctx, timeout=45.0)
    except Exception:
        return httpx.Client(verify=False, timeout=45.0)

def get_ai_client(custom_key=None, custom_base_url=None):
    """
    Initializes OpenAI client with custom or env-provided credentials,
    with explicit timeout and Windows-native SSL verification.
    """
    key = (custom_key or os.getenv("OPENAI_API_KEY", "")).strip()
    base_url = (custom_base_url or os.getenv("OPENAI_BASE_URL", "")).strip() or None

    if not key:
        return None, "API Key is missing. Please configure your API Key in .env or Settings (⚙️)."

    try:
        http_client = create_robust_http_client()
        client_kwargs = {
            "api_key": key,
            "http_client": http_client,
            "max_retries": 2
        }
        if base_url:
            client_kwargs["base_url"] = base_url

        client = OpenAI(**client_kwargs)
        return client, None
    except Exception as exc:
        return None, f"Failed to initialize AI client: {str(exc)}"

def parse_friendly_error(exc):
    """
    Parses exceptions into clear bilingual explanations with exact troubleshooting steps.
    """
    err_str = str(exc)
    err_lower = err_str.lower()

    if "insufficient_quota" in err_lower or "credit_balance_exhausted" in err_lower or "429" in err_lower:
        return (
            "⚠️ Quota Exceeded (আপনার অ্যাকাউন্টের ব্যালেন্স শেষ):\n"
            "OpenAI API Key-তে কোনো ক্রেডিট নেই ($0.00 balance)।\n\n"
            "💡 সমাধান (১০০% ফ্রীতে চালাতে Groq বা Google Gemini ব্যবহার করুন):\n"
            "১. Groq (ফ্রী ও আল্ট্রা ফাস্ট - 800 tokens/sec):\n"
            "   - https://console.groq.com/keys এ গিয়ে ১ মিনিটে ফ্রী API Key তৈরি করুন।\n"
            "   - Settings (⚙️) এ ক্লিক করে '⚡ Groq' সিলেক্ট করে Key টি বসিয়ে Save করুন।\n\n"
            "২. Google Gemini (ফ্রী):\n"
            "   - https://aistudio.google.com/apikey এ গিয়ে ফ্রী Key নিন।\n"
            "   - Settings (⚙️) এ '✨ Gemini' সিলেক্ট করে Key টি বসিয়ে Save করুন।"
        )
    elif "invalid_api_key" in err_lower or "401" in err_lower or "authentication" in err_lower:
        return (
            "⚠️ Invalid API Key (ভুল এপিআই কী):\n"
            "আপনার দেওয়া API Key টি সঠিক নয় বা নিষ্ক্রিয় করা হয়েছে।\n"
            "অনুগ্রহ করে Settings (⚙️) থেকে সঠিক API Key দিন।"
        )
    elif "connection error" in err_lower or "connect" in err_lower or "timeout" in err_lower:
        return (
            "⚠️ Connection Error (সার্ভারে কানেক্ট করা যায়নি):\n"
            "AI সার্ভারে যোগাযোগ করতে পারছে না।\n\n"
            "১. আপনার ইন্টারনেট কানেকশন সক্রিয় আছে কিনা পরীক্ষা করুন।\n"
            "২. কোনো VPN চালু থাকলে বন্ধ করুন বা Settings থেকে Groq/Gemini নির্বাচন করুন।\n\n"
            f"Technical: {err_str}"
        )
    elif "model_not_found" in err_lower or "404" in err_lower:
        return f"⚠️ Model Not Found: উল্লেখিত মডেলটি পাওয়া যায়নি। অনুগ্রহ করে সঠিক মডেল নির্বাচন করুন। ({err_str})"
    else:
        return f"⚠️ AI Request Failed: {err_str}"


def build_system_prompt(persona="all", language="auto"):
    base_prompt = SYSTEM_PROMPTS.get(persona, SYSTEM_PROMPTS["all"])
    lang_directive = LANGUAGE_DIRECTIVES.get(language, "")
    return base_prompt + lang_directive


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health")
@app.route("/api/config")
def config_status():
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    base_url = os.getenv("OPENAI_BASE_URL", "").strip()
    return jsonify({
        "status": "healthy",
        "api_configured": bool(api_key),
        "default_model": model,
        "base_url_configured": bool(base_url),
        "base_url": base_url or "https://api.openai.com/v1",
        "app_name": "Nexus AI Pro",
        "personas": ["all", "student", "streamer", "coder", "writer"]
    })


@app.route("/api/test-connection", methods=["GET", "POST"])
def test_connection():
    """
    Tests connection to the AI provider with a tiny ping to measure latency
    and verify API key + network connectivity immediately.
    """
    data = request.get_json(silent=True) or {}
    custom_key = data.get("api_key")
    custom_base_url = data.get("base_url")
    custom_model = data.get("model")

    client, err = get_ai_client(custom_key, custom_base_url)
    if err:
        return jsonify({"status": "error", "error": err}), 400

    active_model = (custom_model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")).strip() or "gpt-4o-mini"

    t0 = time.time()
    try:
        test_resp = client.chat.completions.create(
            model=active_model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=2,
            temperature=0.0
        )
        latency_ms = int((time.time() - t0) * 1000)
        return jsonify({
            "status": "success",
            "message": "Connection successful! AI service is active and responding.",
            "latency_ms": latency_ms,
            "model": active_model
        })
    except Exception as exc:
        app.logger.exception("Connection test failed")
        return jsonify({
            "status": "error",
            "error": parse_friendly_error(exc),
            "raw_error": str(exc)
        }), 500


@app.route("/chat/stream", methods=["POST"])
def chat_stream():
    """
    Real-time streaming endpoint using Server-Sent Events (SSE).
    Sends tokens immediately as they are generated for ultra-fast, responsive UX.
    Supports dynamic personas (all, student, streamer, coder, writer) and bilingual output.
    """
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Please enter a valid message."}), 400

    custom_key = data.get("api_key")
    custom_base_url = data.get("base_url")
    custom_model = data.get("model")
    persona = data.get("persona", "all")
    language = data.get("language", "auto")
    temperature = float(data.get("temperature", 0.7))

    client, err = get_ai_client(custom_key, custom_base_url)
    if err:
        return jsonify({"error": err}), 400

    history = data.get("history", [])
    if not isinstance(history, list):
        history = []

    sys_prompt = build_system_prompt(persona, language)
    messages = [{"role": "system", "content": sys_prompt}]

    for item in history[-14:]:
        if isinstance(item, dict):
            role = item.get("role")
            content = item.get("content")
            if role in ("user", "assistant") and isinstance(content, str):
                messages.append({
                    "role": role,
                    "content": content[:9000]
                })

    messages.append({
        "role": "user",
        "content": message.strip()[:9000]
    })

    active_model = (custom_model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")).strip() or "gpt-4o-mini"

    def event_generator():
        try:
            stream = client.chat.completions.create(
                model=active_model,
                messages=messages,
                max_tokens=3000,
                temperature=temperature,
                stream=True
            )

            for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        payload = json.dumps({"content": delta.content})
                        yield f"data: {payload}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as exc:
            app.logger.exception("AI stream failed")
            friendly_err = parse_friendly_error(exc)
            yield f"data: {json.dumps({'error': friendly_err})}\n\n"

    response = Response(
        stream_with_context(event_generator()),
        mimetype="text/event-stream"
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Connection"] = "keep-alive"
    return response


@app.route("/chat", methods=["POST"])
def chat_sync():
    """
    Standard non-streaming endpoint for backwards compatibility.
    """
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Please enter a valid message."}), 400

    custom_key = data.get("api_key")
    custom_base_url = data.get("base_url")
    custom_model = data.get("model")
    persona = data.get("persona", "all")
    language = data.get("language", "auto")
    temperature = float(data.get("temperature", 0.7))

    client, err = get_ai_client(custom_key, custom_base_url)
    if err:
        return jsonify({"error": err}), 400

    history = data.get("history", [])
    if not isinstance(history, list):
        history = []

    sys_prompt = build_system_prompt(persona, language)
    messages = [{"role": "system", "content": sys_prompt}]
    for item in history[-12:]:
        if isinstance(item, dict):
            role = item.get("role")
            content = item.get("content")
            if role in ("user", "assistant") and isinstance(content, str):
                messages.append({"role": role, "content": content[:9000]})

    messages.append({"role": "user", "content": message.strip()[:9000]})
    active_model = (custom_model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")).strip() or "gpt-4o-mini"

    try:
        response = client.chat.completions.create(
            model=active_model,
            messages=messages,
            max_tokens=3000,
            temperature=temperature
        )
        reply = response.choices[0].message.content or "No response generated."
        return jsonify({"reply": reply})

    except Exception as exc:
        app.logger.exception("AI sync request failed")
        return jsonify({"error": parse_friendly_error(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
