/**
 * CodeMate AI - Advanced Client-side Engine
 * Features:
 * - Real-time SSE (Server-Sent Events) streaming for ultra-fast response
 * - Marked.js + Highlight.js with code-block header & one-click copy
 * - LocalStorage chat session management (Multiple chats, persistent history)
 * - Provider & Connection Settings (OpenAI, Groq, OpenRouter, DeepSeek)
 * - Live Connection Diagnostic test with latency measurement
 * - Bengali + English bilingual error handling
 */

// State Management
const STATE = {
    chats: [],
    activeChatId: null,
    isStreaming: false,
    abortController: null,
    settings: {
        apiKey: localStorage.getItem("codemate_api_key") || "",
        baseUrl: localStorage.getItem("codemate_base_url") || "",
        model: localStorage.getItem("codemate_model") || "gpt-4o-mini"
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
            elements.chatForm?.requestSubmit();
        }
    });

    // Form submit
    elements.chatForm?.addEventListener("submit", handleChatSubmit);

    // Stop button
    elements.stopBtn?.addEventListener("click", stopStreaming);

    // Quick starter prompt cards
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

    // Model Selector sync
    elements.quickModelSelect?.addEventListener("change", (e) => {
        if (e.target.value === "custom") {
            openSettingsModal();
        } else {
            STATE.settings.model = e.target.value;
            localStorage.setItem("codemate_model", e.target.value);
            showToast(`Switched model to ${e.target.value}`);
        }
    });

    // Top action buttons
    elements.testConnectionBtn?.addEventListener("click", () => runConnectionDiagnostic());
    elements.sidebarConnectionStatus?.addEventListener("click", () => runConnectionDiagnostic());
    elements.exportChatBtn?.addEventListener("click", exportCurrentChat);
    elements.clearCurrentChatBtn?.addEventListener("click", clearCurrentChat);
    elements.clearAllChatsBtn?.addEventListener("click", clearAllChats);

    // Settings Modal
    elements.openSettingsBtn?.addEventListener("click", openSettingsModal);
    elements.closeSettingsBtn?.addEventListener("click", closeSettingsModal);
    elements.modalResetBtn?.addEventListener("click", resetSettingsToDefault);
    elements.modalSaveBtn?.addEventListener("click", saveSettingsFromModal);
    elements.modalTestBtn?.addEventListener("click", testModalSettings);

    // Toggle API Key password visibility
    elements.toggleKeyVisibility?.addEventListener("click", () => {
        const input = elements.settingApiKey;
        input.type = input.type === "password" ? "text" : "password";
    });

    // Provider Presets in Modal
    document.querySelectorAll(".preset-badge").forEach(btn => {
        btn.addEventListener("click", () => {
            const preset = btn.getAttribute("data-preset");
            applyProviderPreset(preset);
        });
    });
}

// Auto-expand textarea height
function autoResizeTextarea() {
    const textarea = elements.promptTextarea;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${newHeight}px`;
}

function toggleSidebar(open) {
    if (open) {
        elements.sidebar.classList.add("open");
        elements.sidebarBackdrop.classList.add("show");
    } else {
        elements.sidebar.classList.remove("open");
        elements.sidebarBackdrop.classList.remove("show");
    }
}

// =========================================================
// Chat Session & History Management
// =========================================================
function loadChatsFromStorage() {
    try {
        const stored = localStorage.getItem("codemate_chats");
        STATE.chats = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to parse chats from localStorage", e);
        STATE.chats = [];
    }

    if (STATE.chats.length === 0) {
        createNewChat();
    } else {
        // Activate the most recent chat
        const lastChat = STATE.chats[0];
        setActiveChat(lastChat.id);
    }
    renderChatHistory();
}

function saveChatsToStorage() {
    try {
        localStorage.setItem("codemate_chats", JSON.stringify(STATE.chats));
    } catch (e) {
        console.warn("Storage quota exceeded", e);
    }
}

function createNewChat() {
    const newChat = {
        id: "chat_" + Date.now(),
        title: "New Coding Session",
        created_at: new Date().toISOString(),
        messages: []
    };

    STATE.chats.unshift(newChat);
    saveChatsToStorage();
    renderChatHistory();
    setActiveChat(newChat.id);

    if (window.innerWidth <= 820) {
        toggleSidebar(false);
    }
    elements.promptTextarea.focus();
}

function setActiveChat(chatId) {
    STATE.activeChatId = chatId;
    const chat = STATE.chats.find(c => c.id === chatId);
    if (!chat) return;

    elements.currentChatTitle.textContent = chat.title || "Coding Session";

    // Render messages
    elements.messagesList.innerHTML = "";
    if (chat.messages.length === 0) {
        elements.welcomeHero.style.display = "block";
    } else {
        elements.welcomeHero.style.display = "none";
        chat.messages.forEach(msg => {
            renderMessageBubble(msg.role, msg.content, msg.timestamp, false);
        });
    }

    renderChatHistory();
    scrollToBottom();
}

function renderChatHistory() {
    elements.chatHistoryList.innerHTML = "";

    STATE.chats.forEach(chat => {
        const item = document.createElement("div");
        item.className = `history-item ${chat.id === STATE.activeChatId ? "active" : ""}`;

        const titleSpan = document.createElement("span");
        titleSpan.className = "history-item-title";
        titleSpan.textContent = chat.title || "Untitled Chat";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "history-item-delete";
        deleteBtn.title = "Delete Chat";
        deleteBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;

        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        item.appendChild(titleSpan);
        item.appendChild(deleteBtn);

        item.addEventListener("click", () => {
            setActiveChat(chat.id);
            if (window.innerWidth <= 820) {
                toggleSidebar(false);
            }
        });

        elements.chatHistoryList.appendChild(item);
    });
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

    let mdContent = `# ${chat.title}\n*Exported from CodeMate AI on ${new Date().toLocaleString()}*\n\n---\n\n`;

    chat.messages.forEach(msg => {
        const sender = msg.role === "user" ? "### 👤 User" : "### ⚡ CodeMate AI";
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

// =========================================================
// Real-Time Streaming & Message Handling
// =========================================================
async function handleChatSubmit(e) {
    e.preventDefault();
    const prompt = elements.promptTextarea.value.trim();

    if (!prompt || STATE.isStreaming) return;

    const chat = STATE.chats.find(c => c.id === STATE.activeChatId);
    if (!chat) return;

    // First prompt automatically sets the title of the chat
    if (chat.messages.length === 0) {
        chat.title = prompt.length > 32 ? prompt.slice(0, 32) + "..." : prompt;
        elements.currentChatTitle.textContent = chat.title;
        elements.welcomeHero.style.display = "none";
    }

    // Add user message
    const userMsg = {
        role: "user",
        content: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    chat.messages.push(userMsg);
    renderMessageBubble("user", prompt, userMsg.timestamp, false);

    // Reset textarea
    elements.promptTextarea.value = "";
    autoResizeTextarea();

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

    // Build context history
    const contextHistory = chat.messages.slice(-12).map(m => ({
        role: m.role,
        content: m.content
    }));

    try {
        const response = await fetch("/chat/stream", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            signal: STATE.abortController.signal,
            body: JSON.stringify({
                message: prompt,
                history: contextHistory,
                api_key: STATE.settings.apiKey || undefined,
                base_url: STATE.settings.baseUrl || undefined,
                model: STATE.settings.model || undefined
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status}: Request failed`);
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
                    if (!jsonStr) continue;

                    try {
                        const parsed = JSON.parse(jsonStr);

                        if (parsed.error) {
                            throw new Error(parsed.error);
                        }

                        if (parsed.content) {
                            accumulatedText += parsed.content;
                            updateStreamingBubble(bubbleEl, accumulatedText);
                        }

                        if (parsed.done) {
                            break;
                        }
                    } catch (pe) {
                        if (pe.message.includes("Connection Error") || pe.message.includes("⚠️")) {
                            throw pe;
                        }
                        // Non-JSON line or partial payload
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
            finalizeStreamingBubble(bubbleEl, bubbleEl.getAttribute("data-raw") + "\n\n*(Generation stopped by user)*");
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
        elements.sendBtn.style.display = "none";
        elements.stopBtn.style.display = "inline-flex";
    } else {
        elements.sendBtn.style.display = "inline-flex";
        elements.stopBtn.style.display = "none";
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
function renderMessageBubble(role, content, timestamp, isLiveStream = false) {
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
    sender.textContent = role === "user" ? "You" : "CodeMate AI";

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = timestamp || "";

    header.appendChild(sender);
    header.appendChild(time);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.setAttribute("data-raw", content);

    if (role === "user") {
        bubble.textContent = content;
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

    // Assistant action buttons (Copy text, etc.)
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
            Error Encountered
        </div>
        <div style="font-size: 0.9rem; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(errorMessage)}</div>
        <div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="openSettingsModal()" style="font-size: 0.78rem; padding: 4px 10px;">
                ⚙️ Check Settings / Switch Provider
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
        return marked.parse(text);
    } catch (e) {
        return escapeHtml(text);
    }
}

/**
 * Enhances all `<pre><code>` blocks inside a container:
 * - Adds a language badge header
 * - Adds one-click "Copy Code" button with visual feedback
 * - Applies Highlight.js syntax highlighting
 */
function enhanceCodeBlocks(container) {
    const preBlocks = container.querySelectorAll("pre");

    preBlocks.forEach(pre => {
        // Skip if already wrapped
        if (pre.parentElement && pre.parentElement.classList.contains("code-block-container")) {
            return;
        }

        const code = pre.querySelector("code");
        if (!code) return;

        // Extract language class e.g. "language-python"
        let lang = "CODE";
        const classes = code.className.split(" ");
        for (const cls of classes) {
            if (cls.startsWith("language-")) {
                lang = cls.replace("language-", "").toUpperCase();
                break;
            }
        }

        // Apply highlight.js
        if (window.hljs) {
            try {
                hljs.highlightElement(code);
            } catch (e) {
                // Ignore syntax highlight error
            }
        }

        // Create container wrapper
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

        // Replace pre with wrapper containing header & pre
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

function createMessageActions(text) {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn";
    copyBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy message</span>
    `;

    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied message to clipboard");
        });
    });

    actions.appendChild(copyBtn);
    return actions;
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================================================
// Connection Diagnostic & Ping
// =========================================================
async function checkConnectionStatus() {
    try {
        const res = await fetch("/health");
        const data = await res.json();
        if (data.api_configured) {
            updateStatusIndicator(true, `Ready (${data.default_model})`);
        } else {
            updateStatusIndicator(false, "API Key Missing");
        }
    } catch (e) {
        updateStatusIndicator(false, "Server Offline");
    }
}

async function runConnectionDiagnostic() {
    elements.testBtnText.textContent = "Testing...";
    elements.testConnectionBtn.disabled = true;

    try {
        const res = await fetch("/api/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: STATE.settings.apiKey || undefined,
                base_url: STATE.settings.baseUrl || undefined,
                model: STATE.settings.model || undefined
            })
        });

        const data = await res.json();

        if (res.ok && data.status === "success") {
            elements.testBtnText.textContent = `${data.latency_ms}ms ⚡`;
            updateStatusIndicator(true, `Connected (${data.latency_ms}ms)`);
            showToast(`Connection active! Latency: ${data.latency_ms}ms`);
        } else {
            elements.testBtnText.textContent = "Failed ⚠️";
            updateStatusIndicator(false, "Connection Error");
            showToast("Connection failed. Check settings.", true);
            openSettingsModal();
            showModalTestFeedback(data.error || "Connection error", false);
        }
    } catch (err) {
        elements.testBtnText.textContent = "Error ⚠️";
        updateStatusIndicator(false, "Network Failed");
        showToast("Server could not be reached.", true);
    } finally {
        elements.testConnectionBtn.disabled = false;
        setTimeout(() => {
            elements.testBtnText.textContent = "Test Ping";
        }, 4000);
    }
}

function updateStatusIndicator(isOnline, text) {
    elements.statusText.textContent = text;
    elements.statusDot.className = `status-dot ${isOnline ? "online" : "offline"}`;
}

// =========================================================
// Settings Modal & Provider Presets
// =========================================================
function openSettingsModal() {
    elements.settingBaseUrl.value = STATE.settings.baseUrl;
    elements.settingApiKey.value = STATE.settings.apiKey;
    elements.settingModel.value = STATE.settings.model;
    elements.modalTestFeedback.style.display = "none";
    elements.settingsModal.style.display = "flex";
}

function closeSettingsModal() {
    elements.settingsModal.style.display = "none";
}

function applyProviderPreset(preset) {
    if (preset === "openai") {
        elements.settingBaseUrl.value = "";
        elements.settingModel.value = "gpt-4o-mini";
        showToast("Selected OpenAI Preset");
    } else if (preset === "groq") {
        elements.settingBaseUrl.value = "https://api.groq.com/openai/v1";
        elements.settingModel.value = "llama-3.3-70b-versatile";
        showToast("Selected Groq Preset (Ultra Fast!)");
    } else if (preset === "gemini") {
        elements.settingBaseUrl.value = "https://generativelanguage.googleapis.com/v1beta/openai/";
        elements.settingModel.value = "gemini-2.0-flash";
        showToast("Selected Google Gemini Free Preset");
    } else if (preset === "openrouter") {
        elements.settingBaseUrl.value = "https://openrouter.ai/api/v1";
        elements.settingModel.value = "meta-llama/llama-3.3-70b-instruct:free";
        showToast("Selected OpenRouter Free Preset");
    } else if (preset === "deepseek") {
        elements.settingBaseUrl.value = "https://api.deepseek.com";
        elements.settingModel.value = "deepseek-chat";
        showToast("Selected DeepSeek Preset");
    }
}

function resetSettingsToDefault() {
    elements.settingBaseUrl.value = "";
    elements.settingApiKey.value = "";
    elements.settingModel.value = "gpt-4o-mini";
    showToast("Settings reset to server defaults");
}

function saveSettingsFromModal() {
    STATE.settings.baseUrl = elements.settingBaseUrl.value.trim();
    STATE.settings.apiKey = elements.settingApiKey.value.trim();
    STATE.settings.model = elements.settingModel.value.trim() || "gpt-4o-mini";

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
    showToast("Settings applied successfully!");
    checkConnectionStatus();
}

function syncModelSelector() {
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
    const model = elements.settingModel.value.trim() || "gpt-4o-mini";

    elements.modalTestBtn.disabled = true;
    elements.modalTestBtn.innerHTML = `<span>Testing...</span>`;

    try {
        const res = await fetch("/api/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: key || undefined,
                base_url: url || undefined,
                model: model
            })
        });

        const data = await res.json();
        if (res.ok && data.status === "success") {
            showModalTestFeedback(`✅ Success! Latency: ${data.latency_ms}ms\nModel "${data.model}" is active and responding.`, true);
        } else {
            showModalTestFeedback(data.error || "Connection failed.", false);
        }
    } catch (e) {
        showModalTestFeedback(`⚠️ Network Error: Unable to communicate with the local server: ${e.message}`, false);
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
    box.style.display = "block";
    box.className = `test-feedback-box ${isSuccess ? "success" : "error"}`;
    box.textContent = msg;
}

// =========================================================
// Toast Notifications
// =========================================================
function showToast(message, isError = false) {
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
