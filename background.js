// ============================================================
// Airtime — Background Service Worker (Tracking Engine)
// ============================================================

importScripts('utils.js');

// -- State --
let currentDomain = null;
let currentTabId = null;
let trackingStartTime = null;
let isIdle = false;
let isWindowFocused = true;
let isInitialized = false;
let isAudible = false;

// -- Constants --
const IDLE_THRESHOLD = 60; // seconds before considered idle
const SAVE_INTERVAL = 5; // save every 5 seconds
const DATA_RETENTION_DAYS = 90;
const SESSION_KEY = 'airtime_session';
const MAX_TRACKABLE_CHUNK = 300; // 5 minutes max tracking chunk to prevent ghost sleep time

// ============================================================
// Core Tracking
// ============================================================

/**
 * Check if ANY tab across all Chrome windows is audible
 */
async function checkAnyTabAudible() {
    try {
        const audibleTabs = await chrome.tabs.query({ audible: true });
        return audibleTabs.length > 0;
    } catch {
        return false;
    }
}

/**
 * Start tracking a new domain
 */
async function startTracking(domain) {
    // Save time for previous domain first
    await saveCurrentTime();

    currentDomain = domain;
    trackingStartTime = Date.now();
    await persistSession();
}

/**
 * Stop tracking the current domain
 */
async function stopTracking() {
    await saveCurrentTime();
    currentDomain = null;
    trackingStartTime = null;
    await persistSession();
}

/**
 * Save accumulated time for the current domain
 */
async function saveCurrentTime() {
    if (!isInitialized) await initializeState();

    // 1. Verify exact audible state globally before processing
    const hasGlobalAudio = await checkAnyTabAudible();
    isAudible = hasGlobalAudio; // sync state

    // If idle or unfocused but a tab is globally audible (e.g. video playing in another window), we continue tracking
    const effectiveIdle = isIdle && !isAudible;
    const effectiveUnfocused = !isWindowFocused && !isAudible;

    if (!currentDomain || !trackingStartTime) return;

    if (effectiveIdle || effectiveUnfocused) {
        // Paused state detected. Clear start time so we don't hold a ghost timer.
        trackingStartTime = null;
        await persistSession();
        return;
    }

    let elapsed = Math.floor((Date.now() - trackingStartTime) / 1000);

    // 2. Sceeping/Suspend Bug Guard (The "10-Hour Ghost" Bug)
    // If the elapsed time is massive (e.g. Chrome went to sleep and woke up 5 hours later),
    // we cap it to our expected chunk size so it doesn't log 5 ghost hours to the website.
    if (elapsed > MAX_TRACKABLE_CHUNK) {
        console.warn(`Airtime: Unusually large time chunk detected (${elapsed}s). Capping to ${MAX_TRACKABLE_CHUNK}s to prevent sleep-ghosting.`);
        elapsed = MAX_TRACKABLE_CHUNK;
    }

    if (elapsed <= 0) return;

    const dateKey = getDateKey(new Date());

    try {
        const data = await chrome.storage.local.get(dateKey);
        const dayData = data[dateKey] || {};

        if (!dayData[currentDomain]) {
            dayData[currentDomain] = {
                time: 0,
                activeTime: 0,
                passiveTime: 0,
                visits: 0,
                category: categorizeDomain(currentDomain)
            };
        }

        dayData[currentDomain].time += elapsed;

        // Split metrics:
        // If the user was NOT idle, the time spent is Active Time
        // If the user WAS idle (but tab was audible, allowing tracking to continue), it's Passive Time
        if (!isIdle) {
            dayData[currentDomain].activeTime = (dayData[currentDomain].activeTime || 0) + elapsed;
        } else {
            dayData[currentDomain].passiveTime = (dayData[currentDomain].passiveTime || 0) + elapsed;
        }

        await chrome.storage.local.set({ [dateKey]: dayData });
    } catch (e) {
        console.error('Airtime: Error saving time', e);
    }

    // Reset tracking start
    trackingStartTime = Date.now();
    await persistSession();
}

/**
 * Persist current tracking session to storage
 */
async function persistSession() {
    try {
        await chrome.storage.local.set({
            [SESSION_KEY]: {
                currentDomain,
                trackingStartTime,
                isIdle,
                isWindowFocused,
                lastUpdated: Date.now()
            }
        });
    } catch (e) {
        console.error('Airtime: Error persisting session', e);
    }
}

/**
 * Initialize state from storage
 */
async function initializeState() {
    if (isInitialized) return;
    try {
        const data = await chrome.storage.local.get(SESSION_KEY);
        const session = data[SESSION_KEY];

        if (session) {
            currentDomain = session.currentDomain;
            trackingStartTime = session.trackingStartTime;
            isIdle = session.isIdle ?? false;
            isWindowFocused = session.isWindowFocused ?? true;
            isAudible = await checkAnyTabAudible(); // Fresh global audible check on wake

            // 3. Suspend/Wake Drift Check
            // If it's been more than 5 minutes since the `lastUpdated` heartbeat,
            // Chrome likely Suspended the worker or the OS slept. 
            // We shouldn't blindly resume the tracking start time from hours ago.
            const SUSPEND_THRESHOLD = MAX_TRACKABLE_CHUNK * 1000;
            if (trackingStartTime && session.lastUpdated && (Date.now() - session.lastUpdated > SUSPEND_THRESHOLD)) {
                console.log('Airtime: Long suspend/sleep detected during initialization. Resetting track timer.');
                // We DON'T call saveCurrentTime here to prevent the massive spike. 
                // We just gently reset the timer for the current domain.
                trackingStartTime = Date.now();
            }
        }
        await loadCategories();
        isInitialized = true;
        console.log('Airtime: State initialized', { currentDomain, isIdle, isWindowFocused, isAudible });
    } catch (e) {
        console.error('Airtime: Error initializing state', e);
        isInitialized = true; // Mark initialized anyway to avoid loops
    }
}

/**
 * Record a visit to a domain
 */
async function recordVisit(domain) {
    if (!isInitialized) await initializeState();
    const dateKey = getDateKey(new Date());

    try {
        const data = await chrome.storage.local.get(dateKey);
        const dayData = data[dateKey] || {};

        if (!dayData[domain]) {
            dayData[domain] = {
                time: 0,
                visits: 0,
                category: categorizeDomain(domain)
            };
        }

        dayData[domain].visits += 1;
        await chrome.storage.local.set({ [dateKey]: dayData });
    } catch (e) {
        console.error('Airtime: Error recording visit', e);
    }
}

// ============================================================
// Tab & Window Event Listeners
// ============================================================

/**
 * Handle active tab changes
 */
async function handleTabChange(tabId) {
    if (!isInitialized) await initializeState();
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url) {
            await stopTracking();
            return;
        }

        const domain = getDomain(tab.url);
        if (!domain || domain === 'newtab' || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            await stopTracking();
            return;
        }

        if (domain !== currentDomain) {
            await startTracking(domain);
            await recordVisit(domain);
        }

        currentTabId = tabId;
        isAudible = tab.audible || false;
        await persistSession();
    } catch (e) {
        // Tab might have been closed
        await stopTracking();
    }
}

// Tab activated (switched tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await handleTabChange(activeInfo.tabId);
});

// Tab updated (navigated to new URL or audible state changed)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId === currentTabId) {
        if (changeInfo.url) {
            const domain = getDomain(changeInfo.url);
            if (!domain || domain === 'newtab' || changeInfo.url.startsWith('chrome://') || changeInfo.url.startsWith('chrome-extension://')) {
                await stopTracking();
                return;
            }
            if (domain !== currentDomain) {
                await startTracking(domain);
                await recordVisit(domain);
            }
        }

        // Track global audible state
        if (changeInfo.audible !== undefined) {
            isAudible = await checkAnyTabAudible();
            await persistSession();
        }
    } else {
        // Even if it's not the active tab, another tab becoming audible/silent 
        // affects our global `isAudible` state!
        if (changeInfo.audible !== undefined) {
            isAudible = await checkAnyTabAudible();
            await persistSession();
        }
    }
});

// Window focus changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Browser lost focus
        isWindowFocused = false;

        // Only stop tracking if not audible
        if (!isAudible) {
            await saveCurrentTime();
            trackingStartTime = null;
        }
        await persistSession();
    } else {
        // Browser gained focus
        isWindowFocused = true;

        // Start tracking only if it was stopped (not currently tracking)
        if (currentDomain && !trackingStartTime) {
            trackingStartTime = Date.now();
        }
        await persistSession();
        // Re-check the active tab
        try {
            const [tab] = await chrome.tabs.query({ active: true, windowId });
            if (tab) {
                await handleTabChange(tab.id);
            }
        } catch (e) { /* ignore */ }
    }
});

// ============================================================
// Idle Detection
// ============================================================

chrome.idle.setDetectionInterval(IDLE_THRESHOLD);

chrome.idle.onStateChanged.addListener(async (state) => {
    if (state === 'idle' || state === 'locked') {
        isIdle = true;

        // Only stop tracking if not audible
        if (!isAudible) {
            await saveCurrentTime();
            trackingStartTime = null;
        }
        await persistSession();
    } else if (state === 'active') {
        isIdle = false;

        // Start tracking only if it was stopped (not currently tracking)
        if (currentDomain && (isWindowFocused || isAudible)) {
            if (!trackingStartTime) {
                trackingStartTime = Date.now();
            }
        }
        await persistSession();
    }
});

// ============================================================
// Periodic Save (Alarm-based for Manifest V3)
// ============================================================

chrome.alarms.create('airtime-save', { periodInMinutes: 0.1 }); // ~6 seconds

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'airtime-save') {
        await saveCurrentTime();
    }
    if (alarm.name === 'airtime-cleanup') {
        await cleanupOldData();
    }
});

// Daily cleanup alarm
chrome.alarms.create('airtime-cleanup', { periodInMinutes: 1440 }); // once per day

/**
 * Remove data older than DATA_RETENTION_DAYS
 */
async function cleanupOldData() {
    try {
        const all = await chrome.storage.local.get(null);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - DATA_RETENTION_DAYS);
        const cutoffKey = getDateKey(cutoff);

        const keysToRemove = Object.keys(all).filter(key => {
            return /^\d{4}-\d{2}-\d{2}$/.test(key) && key < cutoffKey;
        });

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log(`Airtime: Cleaned up ${keysToRemove.length} old entries`);
        }
    } catch (e) {
        console.error('Airtime: Error during cleanup', e);
    }
}

// ============================================================
// Initialization
// ============================================================

// On install/update
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Airtime installed/updated');
    await initializeState();
    // Initialize tracking for the current active tab
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await handleTabChange(tab.id);
        }
    } catch (e) { /* ignore */ }
});

// On startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('Airtime started');
    await initializeState();
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await handleTabChange(tab.id);
        }
    } catch (e) { /* ignore */ }
});

// Initialize on first breath
initializeState();

// Message handler for popup/dashboard communication
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_CURRENT_STATUS') {
        // We can't await initializeState here because the listener must return sync or true
        sendResponse({
            domain: currentDomain,
            isTracking: !!trackingStartTime && ((!isIdle && isWindowFocused) || isAudible),
            isIdle,
            isAudible,
            isWindowFocused,
            trackingStartTime
        });
        return true;
    }
});
