// Theme Handling
// Theme Handling
const THEME_STORAGE_KEY = 'airtime_theme';

// Only run theme logic if we are in a browser context (not Service Worker)
if (typeof document !== 'undefined') {
    // Storage Abstraction (Chrome vs Local)
    const storageAPI = {
        async get(key) {
            // Chrome Extension Environment
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const res = await chrome.storage.local.get(key);
                return key === null ? res : res[key];
            }
            // LocalStorage Fallback (Dev/File Protocol)
            else if (typeof localStorage !== 'undefined') {
                if (key === null) {
                    // "Get All" emulation
                    const all = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        try {
                            all[k] = JSON.parse(localStorage.getItem(k));
                        } catch (e) {
                            all[k] = localStorage.getItem(k);
                        }
                    }
                    return all;
                }
                // Get Single
                try {
                    return JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    return localStorage.getItem(key);
                }
            }
            return key === null ? {} : null;
        },
        async set(key, value) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                // Determine if key is object (set multiple) or string
                if (typeof key === 'object' && key !== null) {
                    await chrome.storage.local.set(key);
                } else {
                    await chrome.storage.local.set({ [key]: value });
                }
            } else if (typeof localStorage !== 'undefined') {
                if (typeof key === 'object' && key !== null) {
                    Object.entries(key).forEach(([k, v]) => {
                        localStorage.setItem(k, JSON.stringify(v));
                    });
                } else {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            }
        }
    };

    /**
     * Load categories from storage
     */
    async function loadCategories() {
        const stored = await storageAPI.get('custom_categories');
        if (stored) {
            CATEGORIES = stored;
        } else {
            // Initialize storage with defaults if nothing exists
            await storageAPI.set('custom_categories', DEFAULT_CATEGORIES);
            CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        }
        return CATEGORIES;
    }

    /**
     * Save current categories to storage
     */
    async function saveCategories(newCategories) {
        CATEGORIES = newCategories;
        await storageAPI.set('custom_categories', CATEGORIES);
    }

    async function initTheme() {
        const theme = (await storageAPI.get(THEME_STORAGE_KEY)) || 'dark';
        applyTheme(theme);
    }


    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        // Update toggle icon if present
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = theme === 'light' ? 'light_mode' : 'dark_mode';
        }
    }

    async function toggleTheme() {
        const isLight = document.body.classList.contains('light-mode');
        const newTheme = isLight ? 'dark' : 'light';

        applyTheme(newTheme);
        await storageAPI.set(THEME_STORAGE_KEY, newTheme);
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.addEventListener('click', toggleTheme);
    });

    // Listen for theme changes from other contexts (Chrome Storage)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes[THEME_STORAGE_KEY]) {
                applyTheme(changes[THEME_STORAGE_KEY].newValue);
            }
        });
    }

    // Listen for theme changes from other contexts (LocalStorage for dev)
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
            if (e.key === THEME_STORAGE_KEY) {
                applyTheme(e.newValue);
            }
        });
    }

    // Make functions available globally in window context
    window.initTheme = initTheme;
    window.applyTheme = applyTheme;
    window.toggleTheme = toggleTheme;
    window.storageAPI = storageAPI;
    window.loadCategories = loadCategories;
    window.saveCategories = saveCategories;
}

// ============================================================
// Airtime — Shared Utilities (Original)
// ============================================================

// Default Categories (Fallback)
const DEFAULT_CATEGORIES = {
    social: {
        label: 'Social Media',
        color: '#f472b6',
        icon: '💬',
        domains: [
            'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
            'snapchat.com', 'reddit.com', 'linkedin.com', 'pinterest.com',
            'tumblr.com', 'mastodon.social', 'threads.net', 'bsky.app', 'vk.com',
            'ok.ru', 'weibo.com', 'wechat.com', 'line.me', 'telegram.org', 'whatsapp.com'
        ]
    },
    entertainment: {
        label: 'Entertainment',
        color: '#c084fc',
        icon: '🎬',
        domains: [
            'youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com',
            'hulu.com', 'disneyplus.com', 'primevideo.com', 'crunchyroll.com',
            'soundcloud.com', 'vimeo.com', 'dailymotion.com', 'hbomax.com',
            'steamcommunity.com', 'steampowered.com', 'epicgames.com', 'roblox.com',
            'ign.com', 'gamespot.com', 'kotaku.com'
        ]
    },
    development: {
        label: 'Development',
        color: '#34d399',
        icon: '💻',
        domains: [
            'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
            'codepen.io', 'codesandbox.io', 'replit.com', 'vercel.com',
            'netlify.com', 'heroku.com', 'npmjs.com', 'pypi.org',
            'developer.mozilla.org', 'w3schools.com', 'dev.to', 'medium.com',
            'docker.com', 'kubernetes.io', 'terraform.io', 'aws.amazon.com',
            'console.cloud.google.com', 'portal.azure.com', 'jetbrains.com'
        ]
    },
    productivity: {
        label: 'Productivity',
        color: '#60a5fa',
        icon: '📋',
        domains: [
            'notion.so', 'trello.com', 'asana.com', 'monday.com',
            'clickup.com', 'todoist.com', 'airtable.com', 'miro.com',
            'figma.com', 'canva.com', 'slack.com', 'discord.com',
            'zoom.us', 'meet.google.com', 'teams.microsoft.com', 'calendly.com',
            'zoom.com', 'docusign.com', 'dropbox.com', 'box.com'
        ]
    },
    ai_tools: {
        label: 'AI Tools',
        color: '#818cf8',
        icon: '🤖',
        domains: [
            'chatgpt.com', 'openai.com', 'claude.ai', 'anthropic.com',
            'gemini.google.com', 'perplexity.ai', 'midjourney.com',
            'remix.al', 'character.ai', 'deepseek.com', 'mistral.ai',
            'hf.co', 'huggingface.co', 'poe.com', 'flowith.io', 'opus.pro',
            'opusclip.com', 'descript.com', 'runwayml.com', 'pika.art'
        ]
    },
    search: {
        label: 'Search',
        color: '#fbbf24',
        icon: '🔍',
        domains: [
            'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com',
            'baidu.com', 'ecosia.org', 'brave.com', 'yandex.com', 'wolframalpha.com'
        ]
    },
    finance: {
        label: 'Finance',
        color: '#10b981',
        icon: '💰',
        domains: [
            'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'paypal.com',
            'stripe.com', 'coinbase.com', 'binance.com', 'revolut.com',
            'finance.yahoo.com', 'bloomberg.com', 'wsj.com', 'mint.com', 'robinhood.com'
        ]
    },
    email: {
        label: 'Email',
        color: '#fb923c',
        icon: '📧',
        domains: [
            'mail.google.com', 'outlook.live.com', 'outlook.office.com',
            'mail.yahoo.com', 'protonmail.com', 'proton.me', 'zoho.com'
        ]
    },
    shopping: {
        label: 'Shopping',
        color: '#f87171',
        icon: '🛒',
        domains: [
            'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com',
            'aliexpress.com', 'shopify.com', 'target.com', 'bestbuy.com',
            'nike.com', 'adidas.com', 'zara.com', 'h&m.com', 'ikea.com'
        ]
    },
    news: {
        label: 'News',
        color: '#a78bfa',
        icon: '📰',
        domains: [
            'cnn.com', 'bbc.com', 'bbc.co.uk', 'reuters.com', 'aljazeera.com',
            'nytimes.com', 'theguardian.com', 'washingtonpost.com',
            'news.ycombinator.com', 'techcrunch.com', 'theverge.com', 'wired.com',
            'arstechnica.com', 'engadget.com', 'forbes.com', 'un.org', 'economist.com'
        ]
    },
    education: {
        label: 'Education',
        color: '#2dd4bf',
        icon: '📚',
        domains: [
            'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org',
            'skillshare.com', 'codecademy.com', 'freecodecamp.org',
            'leetcode.com', 'hackerrank.com', 'duolingo.com',
            'wikipedia.org', 'scholar.google.com', 'researchgate.net', 'jstor.org'
        ]
    },
    other: {
        label: 'Other',
        color: '#94a3b8',
        icon: '🌐',
        domains: []
    }
};

// Category Keywords (Heuristics for unknown domains)
const HEURISTICS = {
    ai_tools: ['ai', 'gpt', 'bot', 'gemini', 'claude', 'perplexity', 'anthropic', 'character', 'llm', 'midjourney', 'mistral', 'deepseek', 'flux', 'opus', 'flow'],
    social: ['social', 'chat', 'network', 'messenger', 'community', 'forum'],
    entertainment: ['video', 'movie', 'stream', 'play', 'game', 'music', 'tv', 'show', 'clip', 'anime', 'manga'],
    development: ['dev', 'code', 'git', 'stack', 'cloud', 'api', 'docker', 'kube', 'linux', 'repo'],
    shopping: ['shop', 'buy', 'store', 'cart', 'deal', 'market', 'commerce'],
    news: ['news', 'journal', 'daily', 'times', 'press', 'tribune', 'post'],
    finance: ['bank', 'card', 'pay', 'wallet', 'crypto', 'coin', 'trade', 'invest', 'stock', 'finance', 'ledger'],
    education: ['edu', 'learn', 'academy', 'school', 'university', 'research', 'wiki', 'study', 'course'],
};

// Variable to hold current categories (loaded from storage)
let CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));

/**
 * Load categories from storage, falling back to defaults
 */
async function loadCategories() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get('custom_categories');
        if (result && result.custom_categories) {
            CATEGORIES = result.custom_categories;
        } else {
            // Initialize storage with defaults if nothing exists
            await chrome.storage.local.set({ custom_categories: DEFAULT_CATEGORIES });
            CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        }
    }
    return CATEGORIES;
}

/**
 * Save current categories to storage
 */
async function saveCategories(newCategories) {
    CATEGORIES = newCategories;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ custom_categories: CATEGORIES });
    }
}

// Productive categories boost, distracting categories penalize
const CATEGORY_PRODUCTIVITY = {
    development: 1.0,
    ai_tools: 0.9,
    productivity: 1.0,
    education: 0.8,
    email: 0.5,
    search: 0.3,
    finance: 0.3,
    news: 0.0,
    other: 0.0,
    shopping: -0.3,
    entertainment: -0.5,
    social: -0.7
};

/**
 * Extract clean domain from a URL
 */
function getDomain(url) {
    try {
        const u = new URL(url);
        let host = u.hostname.replace(/^www\./, '');
        // Special case: keep subdomain for mail, meet, etc.
        if (host.startsWith('mail.') || host.startsWith('meet.') || host.startsWith('docs.') || host.startsWith('drive.')) {
            return host;
        }
        return host;
    } catch {
        return null;
    }
}

/**
 * Categorize a domain into one of the predefined categories
 */
function categorizeDomain(domain) {
    if (!domain) return 'other';
    const lower = domain.toLowerCase();

    // 1. Exact or suffix match from hardcoded lists
    for (const [catKey, catData] of Object.entries(CATEGORIES)) {
        if (catKey === 'other') continue;
        for (const d of catData.domains) {
            if (lower === d || lower.endsWith('.' + d)) {
                return catKey;
            }
        }
    }

    // 2. Heuristic keyword match for unknown domains
    for (const [catKey, keywords] of Object.entries(HEURISTICS)) {
        for (const kw of keywords) {
            // Check if keyword is in the domain name (excluding TLD if possible, but simple inclusion is fine)
            if (lower.includes(kw)) {
                return catKey;
            }
        }
    }

    return 'other';
}

/**
 * Format seconds as human-readable time string
 */
function formatTime(seconds) {
    if (!seconds || seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * Format seconds as compact time (e.g. "2h 15m")
 */
function formatTimeCompact(seconds) {
    if (!seconds || seconds < 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

/**
 * Get date key in YYYY-MM-DD format
 */
function getDateKey(date) {
    const d = date || new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Get Google's favicon service URL
 */
function getFavicon(domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/**
 * Calculate Focus Score (0-100) from a day's data
 */
function calculateFocusScore(dayData) {
    if (!dayData || Object.keys(dayData).length === 0) return 0;

    let totalTime = 0;
    let weightedScore = 0;

    for (const [domain, info] of Object.entries(dayData)) {
        const time = info.time || 0;
        const cat = info.category || categorizeDomain(domain);
        const weight = CATEGORY_PRODUCTIVITY[cat] || 0;
        totalTime += time;
        weightedScore += time * weight;
    }

    if (totalTime === 0) return 0;

    // Normalize: raw score is in range [-0.7, 1.0], map to [0, 100]
    const raw = weightedScore / totalTime;
    const normalized = Math.round(((raw + 0.7) / 1.7) * 100);
    return Math.max(0, Math.min(100, normalized));
}

/**
 * Get total time from a day's data
 */
function getTotalTime(dayData) {
    if (!dayData) return 0;
    return Object.values(dayData).reduce((sum, info) => sum + (info.time || 0), 0);
}

/**
 * Get top sites sorted by time from a day's data
 */
function getTopSites(dayData, limit = 5) {
    if (!dayData) return [];
    return Object.entries(dayData)
        .map(([domain, info]) => ({ domain, ...info }))
        .sort((a, b) => (b.time || 0) - (a.time || 0))
        .slice(0, limit);
}

/**
 * Get category totals from a day's data
 */
function getCategoryTotals(dayData) {
    const totals = {};
    if (!dayData) return totals;
    for (const [domain, info] of Object.entries(dayData)) {
        const cat = info.category || categorizeDomain(domain);
        totals[cat] = (totals[cat] || 0) + (info.time || 0);
    }
    return totals;
}

/**
 * Get the focus score label and color
 */
function getFocusScoreInfo(score) {
    if (score >= 80) return { label: 'Excellent', color: '#34d399' };
    if (score >= 60) return { label: 'Good', color: '#60a5fa' };
    if (score >= 40) return { label: 'Average', color: '#fbbf24' };
    if (score >= 20) return { label: 'Low', color: '#fb923c' };
    return { label: 'Poor', color: '#f87171' };
}

/**
 * Aggregate multiple days of data
 */
function aggregateData(allData, dateKeys) {
    const merged = {};
    for (const key of dateKeys) {
        const dayData = allData[key];
        if (!dayData) continue;
        for (const [domain, info] of Object.entries(dayData)) {
            if (!merged[domain]) {
                merged[domain] = { time: 0, visits: 0, category: info.category || categorizeDomain(domain) };
            }
            merged[domain].time += info.time || 0;
            merged[domain].visits += info.visits || 0;
        }
    }
    return merged;
}

/**
 * Get array of date keys for last N days
 */
function getDateRange(days) {
    const keys = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        keys.push(getDateKey(d));
    }
    return keys;
}

// Export for use in different contexts
if (typeof module !== 'undefined') {
    module.exports = {
        DEFAULT_CATEGORIES, CATEGORIES, CATEGORY_PRODUCTIVITY,
        getDomain, categorizeDomain, formatTime, formatTimeCompact,
        getDateKey, getFavicon, calculateFocusScore, getTotalTime,
        getTopSites, getCategoryTotals, getFocusScoreInfo, aggregateData, getDateRange,
        loadCategories, saveCategories
    };
}
