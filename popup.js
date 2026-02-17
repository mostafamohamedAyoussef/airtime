// ============================================================
// Airtime — The Pulse (Popup Script)
// ============================================================

let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    refreshInterval = setInterval(loadData, 1000);

    // Open Dashboard (Focus) Button
    const dashboardBtn = document.getElementById('openDashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
            window.close();
        });
    }

    // Classification Buttons
    document.querySelectorAll('.classify-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // Remove active class from all
            document.querySelectorAll('.classify-btn').forEach(b => b.classList.remove('active-focus', 'active-neutral', 'active-distract'));

            // Add to clicked
            const cls = btn.dataset.class;
            if (cls === 'focus') btn.classList.add('active-focus');
            if (cls === 'neutral') btn.classList.add('active-neutral');
            if (cls === 'distract') btn.classList.add('active-distract');

            // Save classification for current domain
            const status = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATUS' });
            if (status && status.domain) {
                const stored = await chrome.storage.local.get('_classifications');
                const classifications = stored._classifications || {};
                classifications[status.domain] = cls;
                await chrome.storage.local.set({ _classifications: classifications });

                // Force reload
                loadData();
            }
        });
    });
});

async function loadData() {
    const dateKey = getDateKey(new Date());

    // Get today's data
    // Get today's data
    const stored = await storageAPI.get(null); // Get all to be safe or just dateKey
    const dayData = stored[dateKey] || {};

    // Get current tracking status
    let status = { domain: null, isTracking: false, isIdle: false, isWindowFocused: true };
    try {
        status = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATUS' });
    } catch (e) { /* background might not be ready */ }

    // Update status indicator
    updateStatus(status);

    // Update current context
    updateContext(status, dayData);

    // Update focus score
    const score = calculateFocusScore(dayData);
    updateFocusScore(score, dayData);
}

// ---- Status Indicator ----
function updateStatus(status) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (!dot || !text) return;

    if (status.isIdle) {
        dot.classList.add('idle');
        text.textContent = 'IDLE';
    } else if (!status.isWindowFocused) {
        dot.classList.add('idle');
        text.textContent = 'UNFOCUSED';
    } else if (status.isTracking) {
        dot.classList.remove('idle');
        text.textContent = 'LIVE';
    } else {
        dot.classList.add('idle');
        text.textContent = 'PAUSED';
    }
}

// ---- Current Context ----
function updateContext(status, dayData) {
    const domainEl = document.getElementById('currentDomain');
    const faviconEl = document.getElementById('domainFavicon');
    const timerEl = document.getElementById('currentTimer');
    const classifyGrid = document.getElementById('classifyGrid');

    if (!domainEl) return;

    if (status.domain && status.isTracking) {
        domainEl.textContent = status.domain;

        // Show favicon or letter
        const letter = status.domain.charAt(0).toUpperCase();
        faviconEl.innerHTML = `<img src="${getFavicon(status.domain)}" alt="" onerror="this.parentElement.innerHTML='<span>${letter}</span>'">`;

        // Show timer
        const siteData = dayData[status.domain];
        let seconds = siteData ? siteData.time : 0;

        // Add live tracking delta if currently tracking
        if (status.isTracking && status.trackingStartTime) {
            const liveDelta = Math.floor((Date.now() - status.trackingStartTime) / 1000);
            if (liveDelta > 0) seconds += liveDelta;
        }

        timerEl.textContent = formatTimeChrono(seconds);

        // Show classify buttons
        classifyGrid.style.display = 'grid';
    } else {
        domainEl.textContent = 'No active site';
        faviconEl.innerHTML = '<span>—</span>';
        timerEl.textContent = '00:00:00';
        classifyGrid.style.display = 'none';
    }
}

// Format seconds as HH:MM:SS chronometer
function formatTimeChrono(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---- Focus Score ----
function updateFocusScore(score, dayData) {
    const numberEl = document.getElementById('focusNumber');
    const barFill = document.getElementById('scoreBarFill');
    const deltaEl = document.getElementById('scoreDelta');

    if (!numberEl) return;

    numberEl.textContent = score;
    barFill.style.width = `${score}%`;

    // Show up / down indicator based on score
    if (score >= 70) {
        deltaEl.textContent = '▲ High';
        deltaEl.style.color = '#1d56c9';
    } else if (score >= 40) {
        deltaEl.textContent = '— Mid';
        deltaEl.style.color = '#666';
    } else if (score > 0) {
        deltaEl.textContent = '▼ Low';
        deltaEl.style.color = '#ef4444';
    } else {
        deltaEl.textContent = '';
    }
}
