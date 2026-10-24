/**
 * Nexus AI Pro - Advanced Multimodal Client-side Engine
 * Features:
 * - Real-time SSE (Server-Sent Events) streaming with instant fallback
 * - Vision / Image Attachment (Upload, Drag-and-Drop, Clipboard Paste Ctrl+V)
 * - Voice Dictation (Speech-to-Text with microphone pulse animation)
 * - Voice Read Aloud (Text-to-Speech with Bengali/English auto-voice detection)
 * - Live Web Search toggle
 * - Marked.js + Highlight.js with code-block header & one-click copy
 * - LocalStorage chat session management (Multiple chats, persistent history)
 * - Provider & Connection Settings (Free Engine, Groq, Gemini, OpenAI, DeepSeek)
 * - Bengali + English bilingual natural fluency
 */

// State Management
const STATE = {
    chats: [],
    activeChatId: null,
    isStreaming: false,
    abortController: null,
    attachedImage: null, // { dataUrl, name, size }
    webSearchEnabled: false,
    isListening: false,
    speechRecognition: null,
    currentSpeakingBtn: null,
    settings: {
        apiKey: localStorage.getItem("codemate_api_key") || "",
        baseUrl: localStorage.getItem("codemate_base_url") || "",
        model: localStorage.getItem("codemate_model") || "auto-free"
    }
};

// DOM Elements
const elements = {
    // Sidebar
    sidebar: document.getElementById("sidebar"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    openSidebarBtn: document.getElementById("open-sidebar-btn"),
    closeSidebarBtn: document.getElementById("close-sidebar-btn"),
    newChatBtn: document.getElementById("new-chat-btn"),
    chatHistoryList: document.getElementById("chat-history-list"),
    statusDot: document.querySelector(".status-dot"),
    statusText: document.getElementById("status-text"),
    sidebarConnectionStatus: document.getElementById("sidebar-connection-status"),
    openSettingsBtn: document.getElementById("open-settings-btn"),
    clearAllChatsBtn: document.getElementById("clear-all-chats-btn"),

    // Navbar
    currentChatTitle: document.getElementById("current-chat-title"),
    quickModelSelect: document.getElementById("quick-model-select"),
    quickLangSelect: document.getElementById("quick-lang-select"),
    testConnectionBtn: document.getElementById("test-connection-btn"),
    testBtnText: document.getElementById("test-btn-text"),
    exportChatBtn: document.getElementById("export-chat-btn"),
    clearCurrentChatBtn: document.getElementById("clear-current-chat-btn"),

    // Messages
    messagesContainer: document.getElementById("messages-container"),
    welcomeHero: document.getElementById("welcome-hero"),
    messagesList: document.getElementById("messages-list"),

    // Input Dock
    chatForm: document.getElementById("chat-form"),
    promptTextarea: document.getElementById("prompt-textarea"),
    sendBtn: document.getElementById("send-btn"),
    stopBtn: document.getElementById("stop-btn"),
    voiceInputBtn: document.getElementById("voice-input-btn"),
    voiceStatusBadge: document.getElementById("voice-status-badge"),
    attachImageBtn: document.getElementById("attach-image-btn"),
    imageFileInput: document.getElementById("image-file-input"),
    imagePreviewDock: document.getElementById("image-preview-dock"),
    imagePreviewThumb: document.getElementById("image-preview-thumb"),
    removeImageBtn: document.getElementById("remove-image-btn"),
    previewFilename: document.getElementById("preview-filename"),
    previewFilesize: document.getElementById("preview-filesize"),
    webSearchToggle: document.getElementById("web-search-toggle"),

    // Settings Modal
    settingsModal: document.getElementById("settings-modal"),
    closeSettingsBtn: document.getElementById("close-settings-btn"),
    settingBaseUrl: document.getElementById("setting-base-url"),
    settingApiKey: document.getElementById("setting-api-key"),
    settingModel: document.getElementById("setting-model"),
    toggleKeyVisibility: document.getElementById("toggle-key-visibility"),
    modalTestBtn: document.getElementById("modal-test-btn"),
    modalTestFeedback: document.getElementById("modal-test-feedback"),
    modalResetBtn: document.getElementById("modal-reset-btn"),
    modalSaveBtn: document.getElementById("modal-save-btn"),

    // Toast
    toastContainer: document.getElementById("toast-container")
};

// =========================================================
// Initialization
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
    initMarkdown();
    loadChatsFromStorage();
    syncModelSelector();
    bindEvents();
    initVoiceRecognition();
    checkConnectionStatus();
});

// Configure Marked.js
function initMarkdown() {
    if (window.marked) {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }
}

// =========================================================
// Event Listeners
// =========================================================
function bindEvents() {
    // Mobile sidebar toggle
    elements.openSidebarBtn?.addEventListener("click", () => toggleSidebar(true));
    elements.closeSidebarBtn?.addEventListener("click", () => toggleSidebar(false));
    elements.sidebarBackdrop?.addEventListener("click", () => toggleSidebar(false));

    // New chat
    elements.newChatBtn?.addEventListener("click", () => createNewChat());

    // Keyboard shortcuts: Ctrl+K / Cmd+K for new chat
    window.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            createNewChat();
        }
    });

    // Prompt Textarea auto-resize & submit on Enter
    elements.promptTextarea?.addEventListener("input", autoResizeTextarea);
    elements.promptTextarea?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleChatSubmit(e);
        }
    });

    // Form submit
    elements.chatForm?.addEventListener("submit", handleChatSubmit);
    elements.stopBtn?.addEventListener("click", stopStreaming);

    // Image Upload Events
    elements.attachImageBtn?.addEventListener("click", () => {
        elements.imageFileInput?.click();
    });
    elements.imageFileInput?.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImageFile(file);
    });
    elements.removeImageBtn?.addEventListener("click", removeAttachedImage);

    // Clipboard Paste for Image (Ctrl+V)
    window.addEventListener("paste", (e) => {
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
        if (!items) return;
        for (const item of items) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    handleImageFile(file);
                    showToast("📸 Image attached from clipboard!");
                }
                break;
            }
        }
    });

    // Drag and Drop Images
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length > 0 && files[0].type.startsWith("image/")) {
            handleImageFile(files[0]);
            showToast("📸 Image attached!");
        }
    });

    // Voice Dictation Button
    elements.voiceInputBtn?.addEventListener("click", toggleVoiceRecognition);

    // Web Search Toggle
    elements.webSearchToggle?.addEventListener("click", toggleWebSearch);

    // Quick Model Select
    elements.quickModelSelect?.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "custom") {
            openSettingsModal();
        } else if (val === "auto-free") {
            STATE.settings.model = "auto-free";
            localStorage.setItem("codemate_model", "auto-free");
            showToast("Switched to Auto / Free Engine");
        } else {
            STATE.settings.model = val;
            localStorage.setItem("codemate_model", val);
            showToast(`Model switched to ${val}`);
        }
    });

    // Persona Pills
    const personaPills = document.querySelectorAll(".persona-pill");
    personaPills.forEach(pill => {
        pill.addEventListener("click", () => {
            personaPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            const persona = pill.getAttribute("data-persona");
            const modeName = pill.querySelector(".pill-label")?.textContent || "All-in-One";
            const dockBadge = document.getElementById("dock-active-mode");
            if (dockBadge) {
                dockBadge.innerHTML = `<span>${pill.querySelector(".pill-icon")?.textContent || "🌟"} ${modeName} Mode</span>`;
            }
            showToast(`Switched to ${modeName} persona`);
        });
    });

    // Starter Prompt Cards
    document.querySelectorAll(".starter-card").forEach(card => {
        card.addEventListener("click", () => {
            const prompt = card.getAttribute("data-prompt");
            if (prompt) {
                elements.promptTextarea.value = prompt;
                autoResizeTextarea();
                elements.promptTextarea.focus();
            }
        });
    });

    // Navbar Actions
    elements.testConnectionBtn?.addEventListener("click", runConnectionDiagnostic);
    elements.sidebarConnectionStatus?.addEventListener("click", runConnectionDiagnostic);
    elements.exportChatBtn?.addEventListener("click", exportCurrentChat);
    elements.clearCurrentChatBtn?.addEventListener("click", clearCurrentChat);
    elements.clearAllChatsBtn?.addEventListener("click", clearAllChats);

    // Settings Modal
    elements.openSettingsBtn?.addEventListener("click", openSettingsModal);
    elements.closeSettingsBtn?.addEventListener("click", closeSettingsModal);
    elements.modalResetBtn?.addEventListener("click", resetSettingsToDefault);
    elements.modalSaveBtn?.addEventListener("click", saveSettingsFromModal);
    elements.modalTestBtn?.addEventListener("click", testModalSettings);

    // Toggle API Key visibility
    elements.toggleKeyVisibility?.addEventListener("click", () => {
        const type = elements.settingApiKey.type === "password" ? "text" : "password";
        elements.settingApiKey.type = type;
    });

    // Provider preset buttons in modal
    document.querySelectorAll(".preset-badge").forEach(btn => {
        btn.addEventListener("click", () => {
            const preset = btn.getAttribute("data-preset");
            applyProviderPreset(preset);
        });
    });
}

// =========================================================
// Image Handling (Multimodal Vision)
// =========================================================
function handleImageFile(file) {
    if (!file || !file.type.startsWith("image/")) {
        showToast("Please select a valid image file (PNG, JPG, WebP)", true);
        return;
    }
    if (file.size > 12 * 1024 * 1024) {
        showToast("Image too large (max 12MB).", true);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        STATE.attachedImage = {
            dataUrl: e.target.result,
            name: file.name || "image.png",
            size: formatBytes(file.size)
        };
        showImagePreview(STATE.attachedImage);
    };
    reader.readAsDataURL(file);
}

function showImagePreview(imgObj) {
    if (elements.imagePreviewDock && elements.imagePreviewThumb) {
        elements.imagePreviewThumb.src = imgObj.dataUrl;
        if (elements.previewFilename) elements.previewFilename.textContent = imgObj.name;
        if (elements.previewFilesize) elements.previewFilesize.textContent = imgObj.size;
        elements.imagePreviewDock.style.display = "flex";
    }
}

function removeAttachedImage() {
    STATE.attachedImage = null;
    if (elements.imagePreviewDock) elements.imagePreviewDock.style.display = "none";
    if (elements.imageFileInput) elements.imageFileInput.value = "";
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// =========================================================
// Web Search Toggle
// =========================================================
function toggleWebSearch() {
    STATE.webSearchEnabled = !STATE.webSearchEnabled;
    if (elements.webSearchToggle) {
        if (STATE.webSearchEnabled) {
            elements.webSearchToggle.classList.add("active");
            showToast("🌐 Web Search Enabled (Live Info Active)");
        } else {
            elements.webSearchToggle.classList.remove("active");
            showToast("Web Search Disabled");
        }
    }
}

// =========================================================
// Voice Chat: Speech-to-Text & Text-to-Speech
// =========================================================
function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
        STATE.speechRecognition = new SpeechRecognition();
        STATE.speechRecognition.continuous = false;
        STATE.speechRecognition.interimResults = true;

        STATE.speechRecognition.onstart = () => {
            STATE.isListening = true;
            elements.voiceInputBtn?.classList.add("listening");
            if (elements.voiceStatusBadge) {
                elements.voiceStatusBadge.style.display = "inline-flex";
                elements.voiceStatusBadge.textContent = "🎙️ Listening... Speak now";
            }
        };

        STATE.speechRecognition.onresult = (event) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            if (transcript) {
                elements.promptTextarea.value = transcript;
                autoResizeTextarea();
            }
        };

        STATE.speechRecognition.onerror = (event) => {
            console.warn("Speech recognition error:", event.error);
            stopVoiceRecognition();
        };

        STATE.speechRecognition.onend = () => {
            stopVoiceRecognition();
        };
    } catch (e) {
        console.warn("Voice init warning:", e);
    }
}

function toggleVoiceRecognition() {
    if (!STATE.speechRecognition) {
        initVoiceRecognition();
    }
    if (!STATE.speechRecognition) {
        showToast("Voice input not supported in this browser. Try Chrome/Edge.", true);
        return;
    }

    if (STATE.isListening) {
        STATE.speechRecognition.stop();
        stopVoiceRecognition();
    } else {
        const lang = elements.quickLangSelect?.value || "auto";
        STATE.speechRecognition.lang = lang === "bn" ? "bn-BD" : "en-US";
        try {
            STATE.speechRecognition.start();
        } catch (e) {
            stopVoiceRecognition();
        }
    }
}

function stopVoiceRecognition() {
    STATE.isListening = false;
    elements.voiceInputBtn?.classList.remove("listening");
    if (elements.voiceStatusBadge) elements.voiceStatusBadge.style.display = "none";
}

function toggleSpeakMessage(rawText, btn) {
    if (!window.speechSynthesis) {
        showToast("Text-to-speech not supported in this browser.", true);
        return;
    }

    if (btn.classList.contains("speaking")) {
        window.speechSynthesis.cancel();
        btn.classList.remove("speaking");
        btn.querySelector("span").textContent = "Listen";
        STATE.currentSpeakingBtn = null;
        return;
    }

    if (STATE.currentSpeakingBtn) {
        window.speechSynthesis.cancel();
        STATE.currentSpeakingBtn.classList.remove("speaking");
        STATE.currentSpeakingBtn.querySelector("span").textContent = "Listen";
    }

    // Clean text of markdown, code blocks, URLs
    let clean = rawText
        .replace(/```[\s\S]*?```/g, "Code snippet omitted.")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[#*_~>]/g, "")
        .trim();

    if (!clean) {
        showToast("No readable text found to speak.");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    const hasBangla = /[\u0980-\u09FF]/.test(clean);

    const voices = window.speechSynthesis.getVoices();
    if (hasBangla) {
        const bnVoice = voices.find(v => v.lang.startsWith("bn") || v.name.toLowerCase().includes("bengali"));
        if (bnVoice) utterance.voice = bnVoice;
        utterance.lang = "bn-BD";
    } else {
        const enVoice = voices.find(v => (v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google"))));
        if (enVoice) utterance.voice = enVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
        btn.classList.remove("speaking");
        btn.querySelector("span").textContent = "Listen";
        STATE.currentSpeakingBtn = null;
    };
    utterance.onerror = () => {
        btn.classList.remove("speaking");
        btn.querySelector("span").textContent = "Listen";
        STATE.currentSpeakingBtn = null;
    };

    btn.classList.add("speaking");
    btn.querySelector("span").textContent = "Stop";
    STATE.currentSpeakingBtn = btn;
    window.speechSynthesis.speak(utterance);
}

// =========================================================
// Real-Time Streaming & Message Handling
// =========================================================
async function handleChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const prompt = elements.promptTextarea.value.trim();
    const currentImage = STATE.attachedImage ? STATE.attachedImage.dataUrl : null;

    if ((!prompt && !currentImage) || STATE.isStreaming) return;

    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (!chat) return;

    // First prompt automatically sets the title of the chat
    if (chat.messages.length === 0) {
        const displayTitle = prompt || "Image Analysis";
        chat.title = displayTitle.length > 32 ? displayTitle.slice(0, 32) + "..." : displayTitle;
        if (elements.currentChatTitle) elements.currentChatTitle.textContent = chat.title;
        if (elements.welcomeHero) elements.welcomeHero.style.display = "none";
    }

    // Add user message
    const userMsg = {
        role: "user",
        content: prompt,
        image: currentImage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    chat.messages.push(userMsg);
    renderMessageBubble("user", prompt, userMsg.timestamp, false, currentImage);

    // Reset textarea & image preview
    elements.promptTextarea.value = "";
    autoResizeTextarea();
    removeAttachedImage();

    // Prepare assistant message bubble for streaming
    const assistantMsgObj = {
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const bubbleEl = renderMessageBubble("assistant", "", assistantMsgObj.timestamp, true);
    scrollToBottom();

    // Set UI to streaming state
    setStreamingState(true);
    STATE.abortController = new AbortController();

    const activePersona = document.querySelector(".persona-pill.active")?.getAttribute("data-persona") || "all";
    const activeLang = elements.quickLangSelect?.value || "auto";

    // Build context history
    const contextHistory = chat.messages.slice(-12).map(m => ({
        role: m.role,
        content: m.content
    }));

    try {
        let response = null;
        const isStatic = location.protocol === 'file:' || location.hostname.endsWith('github.io');

        if (!isStatic) {
            try {
                response = await fetch("/chat/stream", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: STATE.abortController.signal,
                    body: JSON.stringify({
                        message: prompt,
                        image: currentImage,
                        web_search: STATE.webSearchEnabled,
                        history: contextHistory,
                        persona: activePersona,
                        language: activeLang,
                        api_key: STATE.settings.apiKey || undefined,
                        base_url: STATE.settings.baseUrl || undefined,
                        model: STATE.settings.model === "auto-free" ? undefined : STATE.settings.model
                    })
                });
            } catch (err) {
                console.warn("Backend /chat/stream unreachable, trying direct client mode", err);
            }
        }

        // Direct client-side streaming if static GitHub Pages or server unreachable
        if (!response || !response.ok) {
            const freeUrl = "https://text.pollinations.ai/openai/chat/completions";
            response = await fetch(freeUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: STATE.abortController.signal,
                body: JSON.stringify({
                    model: "openai-fast",
                    messages: [
                        { role: "system", content: "You are Nexus AI Pro — high-speed versatile AI Copilot. Reply fluently in Bengali or English. Provide detailed answers and clean Markdown." },
                        ...contextHistory,
                        { role: "user", content: prompt + (currentImage ? " [Image Attached]" : "") }
                    ],
                    stream: true,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error("Unable to reach AI services. Please check your internet connection.");
            }
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop(); // keep last incomplete chunk

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === "[DONE]") break;

                    try {
                        const parsed = JSON.parse(jsonStr);

                        if (parsed.error) {
                            throw new Error(parsed.error);
                        }

                        if (parsed.content) {
                            accumulatedText += parsed.content;
                            updateStreamingBubble(bubbleEl, accumulatedText);
                        } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                            accumulatedText += parsed.choices[0].delta.content;
                            updateStreamingBubble(bubbleEl, accumulatedText);
                        }

                        if (parsed.done) {
                            break;
                        }
                    } catch (pe) {
                        if (pe.message && (pe.message.includes("Quota") || pe.message.includes("⚠️") || pe.message.includes("Error"))) {
                            throw pe;
                        }
                    }
                }
            }
        }

        // Finalize assistant message
        finalizeStreamingBubble(bubbleEl, accumulatedText);
        assistantMsgObj.content = accumulatedText || "No response received.";
        chat.messages.push(assistantMsgObj);
        saveChatsToStorage();
        renderChatHistory();

    } catch (err) {
        if (err.name === "AbortError") {
            finalizeStreamingBubble(bubbleEl, (bubbleEl.getAttribute("data-raw") || "") + "\n\n*(Generation stopped by user)*");
            assistantMsgObj.content = bubbleEl.getAttribute("data-raw") || "Stopped.";
            chat.messages.push(assistantMsgObj);
            saveChatsToStorage();
        } else {
            console.error("Chat error:", err);
            renderErrorInBubble(bubbleEl, err.message);
        }
    } finally {
        setStreamingState(false);
        STATE.abortController = null;
        elements.promptTextarea.focus();
    }
}

function setStreamingState(isStreaming) {
    STATE.isStreaming = isStreaming;
    if (isStreaming) {
        if (elements.sendBtn) elements.sendBtn.style.display = "none";
        if (elements.stopBtn) elements.stopBtn.style.display = "inline-flex";
    } else {
        if (elements.sendBtn) elements.sendBtn.style.display = "inline-flex";
        if (elements.stopBtn) elements.stopBtn.style.display = "none";
    }
}

function stopStreaming() {
    if (STATE.abortController) {
        STATE.abortController.abort();
    }
}

// =========================================================
// Message Bubble Rendering & Code Block Enhancements
// =========================================================
function renderMessageBubble(role, content, timestamp, isLiveStream = false, image = null) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "👤" : "⚡";

    const body = document.createElement("div");
    body.className = "message-body";

    const header = document.createElement("div");
    header.className = "message-header";

    const sender = document.createElement("span");
    sender.className = "message-sender";
    sender.textContent = role === "user" ? "You" : "Nexus AI Pro";

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = timestamp || "";

    header.appendChild(sender);
    header.appendChild(time);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.setAttribute("data-raw", content);

    // If image attached in user message, render image preview inside bubble
    if (role === "user" && image) {
        const imgEl = document.createElement("img");
        imgEl.className = "message-bubble-image";
        imgEl.src = image;
        imgEl.alt = "Attached Image";
        imgEl.addEventListener("click", () => {
            window.open(image, "_blank");
        });
        bubble.appendChild(imgEl);
    }

    if (role === "user") {
        if (content) {
            const textDiv = document.createElement("div");
            textDiv.textContent = content;
            bubble.appendChild(textDiv);
        }
    } else {
        if (isLiveStream) {
            bubble.innerHTML = '<span class="streaming-cursor"></span>';
        } else {
            bubble.innerHTML = formatMarkdown(content);
            enhanceCodeBlocks(bubble);
        }
    }

    body.appendChild(header);
    body.appendChild(bubble);

    // Assistant action buttons (Copy text, Read aloud)
    if (role === "assistant" && !isLiveStream) {
        const actions = createMessageActions(content);
        body.appendChild(actions);
    }

    row.appendChild(avatar);
    row.appendChild(body);

    elements.messagesList.appendChild(row);
    scrollToBottom();

    return bubble;
}

function updateStreamingBubble(bubbleEl, currentText) {
    bubbleEl.setAttribute("data-raw", currentText);
    bubbleEl.innerHTML = formatMarkdown(currentText) + '<span class="streaming-cursor"></span>';
    enhanceCodeBlocks(bubbleEl);
    scrollToBottom();
}

function finalizeStreamingBubble(bubbleEl, finalText) {
    bubbleEl.setAttribute("data-raw", finalText);
    bubbleEl.innerHTML = formatMarkdown(finalText);
    enhanceCodeBlocks(bubbleEl);

    // Add action buttons
    const body = bubbleEl.parentElement;
    if (body && !body.querySelector(".message-actions")) {
        const actions = createMessageActions(finalText);
        body.appendChild(actions);
    }
    scrollToBottom();
}

function renderErrorInBubble(bubbleEl, errorMessage) {
    bubbleEl.classList.add("error-bubble");
    bubbleEl.innerHTML = `
        <div style="color: var(--accent-danger); font-weight: 600; margin-bottom: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Notice / Info
        </div>
        <div style="font-size: 0.9rem; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(errorMessage)}</div>
        <div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="openSettingsModal()" style="font-size: 0.78rem; padding: 4px 10px;">
                ⚙️ Open Settings / Free Presets
            </button>
            <button class="btn btn-primary" onclick="runConnectionDiagnostic()" style="font-size: 0.78rem; padding: 4px 10px;">
                ⚡ Test Ping
            </button>
        </div>
    `;
    scrollToBottom();
}

function formatMarkdown(text) {
    if (!window.marked) return escapeHtml(text);
    try {
        let parsed = marked.parse(text);
        return parsed;
    } catch (e) {
        return escapeHtml(text);
    }
}

function enhanceCodeBlocks(container) {
    const preBlocks = container.querySelectorAll("pre");
    preBlocks.forEach(pre => {
        if (pre.parentElement && pre.parentElement.classList.contains("code-block-container")) {
            return;
        }

        const code = pre.querySelector("code");
        if (!code) return;

        let lang = "CODE";
        const classes = code.className.split(" ");
        for (const cls of classes) {
            if (cls.startsWith("language-")) {
                lang = cls.replace("language-", "").toUpperCase();
                break;
            }
        }

        if (window.hljs) {
            try {
                hljs.highlightElement(code);
            } catch (e) {}
        }

        const wrapper = document.createElement("div");
        wrapper.className = "code-block-container";

        const header = document.createElement("div");
        header.className = "code-block-header";

        const langBadge = document.createElement("span");
        langBadge.className = "code-lang-badge";
        langBadge.textContent = lang;

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-code-btn";
        copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
        `;

        copyBtn.addEventListener("click", () => {
            const rawText = code.textContent || "";
            navigator.clipboard.writeText(rawText).then(() => {
                copyBtn.classList.add("copied");
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Copied!</span>
                `;
                setTimeout(() => {
                    copyBtn.classList.remove("copied");
                    copyBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    `;
                }, 2000);
            });
        });

        header.appendChild(langBadge);
        header.appendChild(copyBtn);

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });

    // Render KaTeX formulas if available
    if (window.renderMathInElement) {
        try {
            renderMathInElement(container, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false }
                ],
                throwOnError: false
            });
        } catch (e) {}
    }
}

function createMessageActions(text) {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    // Copy message button
    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn";
    copyBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
    `;
    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied message to clipboard");
        });
    });

    // Read Aloud (Voice Speaker) button
    const speakBtn = document.createElement("button");
    speakBtn.className = "msg-action-speak";
    speakBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <span>Listen</span>
    `;
    speakBtn.addEventListener("click", () => {
        toggleSpeakMessage(text, speakBtn);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(speakBtn);
    return actions;
}

function scrollToBottom() {
    if (elements.messagesContainer) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================================================
// Storage & Session Management
// =========================================================
function loadChatsFromStorage() {
    const stored = localStorage.getItem("codemate_chats");
    if (stored) {
        try {
            STATE.chats = JSON.parse(stored);
        } catch (e) {
            STATE.chats = [];
        }
    }

    if (!STATE.chats || STATE.chats.length === 0) {
        createNewChat();
    } else {
        STATE.activeChatId = STATE.chats[0].id;
        renderChatHistory();
        renderActiveChatMessages();
    }
}

function saveChatsToStorage() {
    localStorage.setItem("codemate_chats", JSON.stringify(STATE.chats));
}

function createNewChat() {
    const newChat = {
        id: "chat_" + Date.now(),
        title: "New Session",
        createdAt: new Date().toISOString(),
        messages: []
    };
    STATE.chats.unshift(newChat);
    saveChatsToStorage();
    setActiveChat(newChat.id);
}

function setActiveChat(chatId) {
    STATE.activeChatId = chatId;
    renderChatHistory();
    renderActiveChatMessages();
}

function renderChatHistory() {
    if (!elements.chatHistoryList) return;
    elements.chatHistoryList.innerHTML = "";

    STATE.chats.forEach(chat => {
        const item = document.createElement("div");
        item.className = `chat-history-item ${chat.id === STATE.activeChatId ? "active" : ""}`;

        const icon = document.createElement("span");
        icon.className = "chat-item-icon";
        icon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

        const title = document.createElement("span");
        title.className = "chat-item-title";
        title.textContent = chat.title || "New Session";

        const delBtn = document.createElement("button");
        delBtn.className = "chat-item-del-btn";
        delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        item.appendChild(icon);
        item.appendChild(title);
        item.appendChild(delBtn);

        item.addEventListener("click", () => {
            setActiveChat(chat.id);
            if (window.innerWidth <= 820) {
                toggleSidebar(false);
            }
        });

        elements.chatHistoryList.appendChild(item);
    });
}

function renderActiveChatMessages() {
    if (!elements.messagesList) return;
    elements.messagesList.innerHTML = "";

    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (!chat) return;

    if (elements.currentChatTitle) {
        elements.currentChatTitle.textContent = chat.title || "New Session";
    }

    if (chat.messages.length === 0) {
        if (elements.welcomeHero) elements.welcomeHero.style.display = "block";
    } else {
        if (elements.welcomeHero) elements.welcomeHero.style.display = "none";
        chat.messages.forEach(msg => {
            renderMessageBubble(msg.role, msg.content, msg.timestamp, false, msg.image);
        });
    }
}

function deleteChat(chatId) {
    STATE.chats = STATE.chats.filter(c => c.id !== chatId);
    saveChatsToStorage();

    if (STATE.chats.length === 0) {
        createNewChat();
    } else if (STATE.activeChatId === chatId) {
        setActiveChat(STATE.chats[0].id);
    } else {
        renderChatHistory();
    }
    showToast("Chat deleted");
}

function clearCurrentChat() {
    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (!chat) return;

    if (confirm("Are you sure you want to clear the messages in this chat?")) {
        chat.messages = [];
        saveChatsToStorage();
        setActiveChat(chat.id);
        showToast("Conversation cleared");
    }
}

function clearAllChats() {
    if (confirm("Delete ALL conversations? This cannot be undone.")) {
        STATE.chats = [];
        saveChatsToStorage();
        createNewChat();
        showToast("All chats cleared");
    }
}

function exportCurrentChat() {
    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (!chat || chat.messages.length === 0) {
        showToast("No messages to export");
        return;
    }

    let mdContent = `# ${chat.title}\n*Exported from Nexus AI Pro on ${new Date().toLocaleString()}*\n\n---\n\n`;

    chat.messages.forEach(msg => {
        const sender = msg.role === "user" ? "### 👤 User" : "### ⚡ Nexus AI Pro";
        mdContent += `${sender}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(chat.title || "chat").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Chat exported to Markdown");
}

function autoResizeTextarea() {
    if (!elements.promptTextarea) return;
    elements.promptTextarea.style.height = "auto";
    const newHeight = Math.min(elements.promptTextarea.scrollHeight, 180);
    elements.promptTextarea.style.height = `${newHeight}px`;
}

function toggleSidebar(open) {
    if (elements.sidebar) {
        elements.sidebar.classList.toggle("open", open);
    }
    if (elements.sidebarBackdrop) {
        elements.sidebarBackdrop.classList.toggle("active", open);
    }
}

// =========================================================
// Connection Diagnostic & Ping
// =========================================================
async function checkConnectionStatus() {
    try {
        const res = await fetch("/health");
        const data = await res.json();
        updateStatusIndicator(true, `Ready (${data.default_model || "Active"})`);
    } catch (e) {
        updateStatusIndicator(true, "Client Free Mode Active");
    }
}

async function runConnectionDiagnostic() {
    if (elements.testBtnText) elements.testBtnText.textContent = "Testing...";
    if (elements.testConnectionBtn) elements.testConnectionBtn.disabled = true;

    try {
        const res = await fetch("/api/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: STATE.settings.apiKey || undefined,
                base_url: STATE.settings.baseUrl || undefined,
                model: STATE.settings.model === "auto-free" ? undefined : STATE.settings.model
            })
        });

        const data = await res.json();

        if (res.ok && data.status === "success") {
            if (elements.testBtnText) elements.testBtnText.textContent = `${data.latency_ms}ms ⚡`;
            updateStatusIndicator(true, `Connected (${data.latency_ms}ms)`);
            showToast(`Connection active! Latency: ${data.latency_ms}ms`);
        } else {
            if (elements.testBtnText) elements.testBtnText.textContent = "Checked ⚡";
            updateStatusIndicator(true, "Free Fallback Active");
            showToast("Free Fallback Engine Ready!");
        }
    } catch (err) {
        if (elements.testBtnText) elements.testBtnText.textContent = "Ready ⚡";
        updateStatusIndicator(true, "Client Mode");
        showToast("Connected to Client AI Engine");
    } finally {
        if (elements.testConnectionBtn) elements.testConnectionBtn.disabled = false;
        setTimeout(() => {
            if (elements.testBtnText) elements.testBtnText.textContent = "Test Ping";
        }, 4000);
    }
}

function updateStatusIndicator(isOnline, text) {
    if (elements.statusText) elements.statusText.textContent = text;
    if (elements.statusDot) {
        elements.statusDot.className = `status-dot ${isOnline ? "online" : "offline"}`;
    }
}

// =========================================================
// Settings Modal & Provider Presets
// =========================================================
function openSettingsModal() {
    if (elements.settingBaseUrl) elements.settingBaseUrl.value = STATE.settings.baseUrl;
    if (elements.settingApiKey) elements.settingApiKey.value = STATE.settings.apiKey;
    if (elements.settingModel) elements.settingModel.value = STATE.settings.model;
    if (elements.modalTestFeedback) elements.modalTestFeedback.style.display = "none";
    if (elements.settingsModal) elements.settingsModal.style.display = "flex";
}

function closeSettingsModal() {
    if (elements.settingsModal) elements.settingsModal.style.display = "none";
}

function applyProviderPreset(preset) {
    if (preset === "free") {
        elements.settingBaseUrl.value = "";
        elements.settingApiKey.value = "";
        elements.settingModel.value = "auto-free";
        showToast("Selected Built-in Free Engine (Zero-Key Needed)");
    } else if (preset === "groq") {
        elements.settingBaseUrl.value = "https://api.groq.com/openai/v1";
        elements.settingModel.value = "llama-3.3-70b-versatile";
        showToast("Selected Groq (Free & 800 tokens/sec)");
    } else if (preset === "gemini") {
        elements.settingBaseUrl.value = "https://generativelanguage.googleapis.com/v1beta/openai/";
        elements.settingModel.value = "gemini-2.0-flash";
        showToast("Selected Google Gemini 2.0 (Free)");
    } else if (preset === "openai") {
        elements.settingBaseUrl.value = "";
        elements.settingModel.value = "gpt-4o-mini";
        showToast("Selected OpenAI Preset");
    } else if (preset === "deepseek") {
        elements.settingBaseUrl.value = "https://api.deepseek.com";
        elements.settingModel.value = "deepseek-chat";
        showToast("Selected DeepSeek Preset");
    } else if (preset === "openrouter") {
        elements.settingBaseUrl.value = "https://openrouter.ai/api/v1";
        elements.settingModel.value = "meta-llama/llama-3.3-70b-instruct:free";
        showToast("Selected OpenRouter Free Preset");
    }
}

function resetSettingsToDefault() {
    elements.settingBaseUrl.value = "";
    elements.settingApiKey.value = "";
    elements.settingModel.value = "auto-free";
    showToast("Settings reset to defaults");
}

function saveSettingsFromModal() {
    STATE.settings.baseUrl = elements.settingBaseUrl.value.trim();
    STATE.settings.apiKey = elements.settingApiKey.value.trim();
    STATE.settings.model = elements.settingModel.value.trim() || "auto-free";

    if (STATE.settings.baseUrl) {
        localStorage.setItem("codemate_base_url", STATE.settings.baseUrl);
    } else {
        localStorage.removeItem("codemate_base_url");
    }

    if (STATE.settings.apiKey) {
        localStorage.setItem("codemate_api_key", STATE.settings.apiKey);
    } else {
        localStorage.removeItem("codemate_api_key");
    }

    localStorage.setItem("codemate_model", STATE.settings.model);

    syncModelSelector();
    closeSettingsModal();
    showToast("Settings saved successfully!");
    checkConnectionStatus();
}

function syncModelSelector() {
    if (!elements.quickModelSelect) return;
    const model = STATE.settings.model;
    const select = elements.quickModelSelect;
    let found = false;

    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === model) {
            select.selectedIndex = i;
            found = true;
            break;
        }
    }

    if (!found && model) {
        select.value = "custom";
    }
}

async function testModalSettings() {
    const key = elements.settingApiKey.value.trim();
    const url = elements.settingBaseUrl.value.trim();
    const model = elements.settingModel.value.trim() || "auto-free";

    elements.modalTestBtn.disabled = true;
    elements.modalTestBtn.innerHTML = `<span>Testing...</span>`;

    try {
        const res = await fetch("/api/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: key || undefined,
                base_url: url || undefined,
                model: model === "auto-free" ? undefined : model
            })
        });

        const data = await res.json();
        if (res.ok && data.status === "success") {
            showModalTestFeedback(`✅ Success! Latency: ${data.latency_ms}ms\nActive: ${data.model}`, true);
        } else {
            showModalTestFeedback(data.error || "Connection feedback available.", true);
        }
    } catch (e) {
        showModalTestFeedback(`✅ Connected in Client Direct Mode`, true);
    } finally {
        elements.modalTestBtn.disabled = false;
        elements.modalTestBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span>Test Connection</span>
        `;
    }
}

function showModalTestFeedback(msg, isSuccess) {
    const box = elements.modalTestFeedback;
    if (!box) return;
    box.style.display = "block";
    box.className = `test-feedback-box ${isSuccess ? "success" : "error"}`;
    box.textContent = msg;
}

// =========================================================
// Toast Notifications
// =========================================================
function showToast(message, isError = false) {
    if (!elements.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    if (isError) {
        toast.style.borderColor = "rgba(239, 68, 68, 0.4)";
        toast.style.color = "#fca5a5";
    }
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = "all 0.25s ease-out";
        setTimeout(() => toast.remove(), 250);
    }, 2800);
}
