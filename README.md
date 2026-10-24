# ⚡ Nexus AI Pro — Ultimate Multimodal AI Studio (Vision • Voice • Web Search)

<div align="center">

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)
![Flask](https://img.shields.io/badge/Flask-3.x-black.svg)
![Vision](https://img.shields.io/badge/Vision-Multimodal-ff69b4.svg)
![Streaming](https://img.shields.io/badge/Streaming-SSE-purple.svg)
![Language](https://img.shields.io/badge/Language-English%20%7C%20%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE-orange.svg)

**A high-speed, versatile Multimodal AI Studio with Vision (ছবি আপলোড), Voice Chat (মাইক ও স্পিকার), Live Web Search, and Bilingual AI assistance (বাংলা ও English).**

[English](#-english-overview) • [বাংলা বিবরণ](#-বাংলা-বিবরণ) • [Quick Start](#-quick-start) • [Deployment](#-free-cloud-deployment)

</div>

---

## 🌟 Key Features / প্রধান বৈশিষ্ট্যসমূহ

### 1. 📸 Multimodal Vision (ছবি ও স্ক্রিনশট বিশ্লেষণ)
- **Image Upload & Analysis**: Upload or drag-and-drop any image, diagram, chart, or screenshot.
- **Clipboard Paste (`Ctrl + V`)**: Direct paste screenshots from clipboard for instant analysis.
- **Math & Problem Solving from Photos**: Take a photo of math or homework problems and get instant step-by-step solutions.

### 2. 🎙️ Voice Chat (ভয়েস ইনপুট ও অডিও স্পিকার)
- **Speech-to-Text (Voice Dictation)**: Click the microphone icon to speak in Bengali or English; audio is transcribed directly in real time.
- **Text-to-Speech (TTS - Listen)**: Click "🔊 Listen" on any response to have the AI read the explanation aloud in natural Bengali or English.

### 3. 🌐 Live Web Search
- **Real-Time Knowledge**: Toggle Web Search to pull live internet facts and enrich AI responses.

### 4. 🎓 Student & Academic Mentor Mode (শিক্ষার্থীদের জন্য)
- **Step-by-Step Math Solver**: Solves quadratic equations, calculus, algebra, and physics numericals with clear formulas.
- **Science & Concept Explainer**: Breaks down complex topics with intuitive everyday analogies.
- **বাংলায় রচনা ও সারাংশ**: স্কুল, কলেজ ও বিশ্ববিদ্যালয়ের পরীক্ষার জন্য মানসম্মত রচনা, ভাবসম্প্রসারণ এবং সংক্ষিপ্ত নোট।
- **KaTeX Formula Rendering**: Beautiful mathematical formulas rendered seamlessly.

### 5. 🎮 Streamer & Content Creator Studio
- **Viral YouTube Titles & Hooks**: High-CTR, click-worthy video titles and opening hooks.
- **Live Chat Banter & Polls**: Keeps live viewers engaged with witty commentary and chat games.
- **High-SEO Video Descriptions & Tags**: Optimized descriptions with trending hashtags.

### 6. 💻 Senior Coder Pro Mode
- **Production-Grade Code**: Clean, secure code in Python, JavaScript, TypeScript, C++, Java, Go, Rust, SQL, Bash.
- **Syntax Highlighting & 1-Click Copy**: Atom One Dark theme with language badges and instant copy button.

### 7. 🚀 Multi-Provider & 100% Free AI Engine Fallback
- **Built-in Zero-Key Fallback**: Guaranteed 100% uptime even if API quotas expire.
- **⚡ Groq**: Blazing 800 tokens/second powered by Llama 3.3 70B & Llama 3.2 11B Vision.
- **✨ Google Gemini**: Free tier integration via Gemini 2.0 Flash / 1.5 Flash.
- **🟢 OpenAI & DeepSeek**: Full compatibility with OpenAI GPT-4o-mini / GPT-4o and DeepSeek.

---

## 🚀 Quick Start (স্থানীয়ভাবে চালু করার নিয়ম)

### 1. Clone the repository
```bash
git clone https://github.com/rounakbera75/AI-Coding-Assistant.git
cd AI-Coding-Assistant
```

### 2. Set up Virtual Environment
```bash
python -m venv .venv

# Windows:
.\.venv\Scripts\activate

# macOS / Linux:
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure API Key
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your free API key from [Groq](https://console.groq.com/keys), [Google AI Studio](https://aistudio.google.com/apikey), or [OpenAI](https://platform.openai.com/api-keys).

### 5. Run the Server
```bash
python app.py
```
Open **`http://localhost:5000`** in your browser!

---

## ☁️ Free Cloud Deployment (সারাজীবন ফ্রীতে লাইভ করার নিয়ম)

### Option 1: Render (1-Click Free Hosting)
1. Push your repository to **GitHub** (Public repository).
2. Go to [render.com](https://render.com) and create a **New Web Service**.
3. Select your GitHub repository.
4. Set:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
5. In **Environment Variables**, add:
   - `OPENAI_BASE_URL`: `https://api.groq.com/openai/v1` (or OpenAI/Gemini)
   - `OPENAI_API_KEY`: `your_key_here`
   - `OPENAI_MODEL`: `llama-3.3-70b-versatile`
6. Click **Deploy Web Service** — Render will give you a permanent public link like `https://nexus-ai.onrender.com`!

---

## 🔒 Privacy & Security
- API keys entered via the frontend dashboard are strictly stored in the user's browser `localStorage` and never saved to any external database.
- `.env` is included in `.gitignore` to ensure secret keys are never accidentally pushed to public GitHub.

---

## 📄 License
Released under the [MIT License](LICENSE).
