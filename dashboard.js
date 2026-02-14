// ============================================================
// Airtime — Dashboard (Headquarters) Script
// ============================================================

let allData = {};
let selectedRange = 'today';

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories(); // Load custom categories first
    // Load all data
    allData = await storageAPI.get(null);

    // Setup date toggle
    document.querySelectorAll('.date-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRange = btn.dataset.range;
            updateDashboard();
        });
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('downloadBtn').addEventListener('click', exportData);

    updateDashboard();
    // Real-time tracker for the current site logo
    setInterval(updateRunningStatus, 1000);
    updateRunningStatus();
});

async function updateRunningStatus() {
    const logoEl = document.getElementById('currentSiteLogo');
    if (!logoEl) return;

    try {
        const status = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATUS' });
        if (status && status.domain && status.isTracking) {
            const letter = status.domain.charAt(0).toUpperCase();
            // Only update if domain changed to prevent flicker
            if (logoEl.dataset.domain !== status.domain) {
                logoEl.dataset.domain = status.domain;
                logoEl.innerHTML = `<img src="${getFavicon(status.domain)}" alt="${status.domain}" onerror="this.parentElement.innerHTML='<span>${letter}</span>'">`;
                logoEl.classList.add('active');
            }
        } else {
            logoEl.innerHTML = '';
            logoEl.classList.remove('active');
            logoEl.dataset.domain = '';
        }
    } catch (e) {
        // Background script might be updating
    }
}

function updateDashboard() {
    const dateKeys = getSelectedDateKeys();
    const merged = aggregateData(allData, dateKeys);

    updateFocusScore(merged, dateKeys);
    updateTrendLine(dateKeys);
    updateSitesTable(merged);
}

// ---- Date key helpers ----
function getSelectedDateKeys() {
    const now = new Date();
    const keys = [];

    if (selectedRange === 'today') {
        keys.push(getDateKey(now));
    } else if (selectedRange === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        keys.push(getDateKey(y));
    } else if (selectedRange === 'week') {
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            keys.push(getDateKey(d));
        }
    }

    return keys;
}

// ---- Focus Score ----
function updateFocusScore(merged, dateKeys) {
    const todayKey = getDateKey(new Date());
    const todayData = allData[todayKey] || {};
    const score = calculateFocusScore(selectedRange === 'today' ? todayData : merged);

    document.getElementById('focusScore').textContent = score;

    // Calculate trend
    const trendEl = document.getElementById('trendText');
    const trendIcon = document.querySelector('.trend-icon');

    if (selectedRange === 'today') {
        // Compare with yesterday
        const yKey = getDateKey(new Date(Date.now() - 86400000));
        const yData = allData[yKey] || {};
        const yScore = calculateFocusScore(yData);

        if (getTotalTime(todayData) > 0 && getTotalTime(yData) > 0) {
            const diff = score - yScore;
            if (diff > 0) {
                trendEl.textContent = `+${diff}% vs yesterday`;
                trendEl.style.color = '#1d56c9';
                trendIcon.textContent = 'trending_up';
                trendIcon.style.color = '#1d56c9';
            } else if (diff < 0) {
                trendEl.textContent = `${diff}% vs yesterday`;
                trendEl.style.color = '#ef4444';
                trendIcon.textContent = 'trending_down';
                trendIcon.style.color = '#ef4444';
            } else {
                trendEl.textContent = 'Same as yesterday';
                trendEl.style.color = '#666';
                trendIcon.textContent = 'trending_flat';
                trendIcon.style.color = '#666';
            }
        } else {
            trendEl.textContent = 'Collecting data...';
            trendEl.style.color = '#666';
            trendIcon.textContent = 'trending_flat';
            trendIcon.style.color = '#666';
        }
    } else {
        const totalTime = getTotalTime(merged);
        trendEl.textContent = totalTime > 0 ? `${formatTime(totalTime)} tracked` : 'No data for this period';
        trendEl.style.color = '#666';
        trendIcon.textContent = 'schedule';
        trendIcon.style.color = '#666';
    }
}

// ---- SVG Trend Line ----
function updateTrendLine(dateKeys) {
    const svg = document.getElementById('trendSvg');
    const pathEl = document.getElementById('trendPath');

    if (selectedRange === 'today' || selectedRange === 'yesterday') {
        // Show hourly activity
        const key = dateKeys[0];
        const dayData = allData[key] || {};
        const totalTime = getTotalTime(dayData);

        if (totalTime === 0) {
            pathEl.setAttribute('d', 'M0,90 L800,90');
            // Remove any existing circles/lines
            svg.querySelectorAll('.trend-dot, .trend-dashed').forEach(el => el.remove());
            return;
        }

        // Build hourly buckets (simplified — we just create a rough shape)
        // Since we don't have hourly data, create a basic representation
        const sites = Object.entries(dayData);
        const productiveTime = sites
            .filter(([, d]) => CATEGORY_PRODUCTIVITY[d.category] > 0.3)
            .reduce((s, [, d]) => s + d.time, 0);
        const ratio = productiveTime / totalTime;

        // Create an interesting line shape based on data
        const points = [];
        const segments = 20;
        for (let i = 0; i <= segments; i++) {
            const x = (i / segments) * 800;
            // Create a varied pattern
            const noise = Math.sin(i * 0.8) * 20 + Math.cos(i * 1.2) * 15;
            const base = 90 - (ratio * 70);
            const y = Math.max(10, Math.min(90, base + noise));
            points.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
        }

        pathEl.setAttribute('d', points.join(' '));

        // Update gradient based on focus vs distraction
        const gradEl = document.getElementById('gradientLine');
        gradEl.innerHTML = '';

        // Build gradient: distracted = #333, neutral = #666, focused = blue, deep focus = white
        const stops = [
            { offset: '0%', color: '#333333' },
            { offset: '30%', color: ratio > 0.3 ? '#1d56c9' : '#333333' },
            { offset: '60%', color: ratio > 0.5 ? '#1d56c9' : '#333333' },
            { offset: '80%', color: ratio > 0.7 ? '#FFFFFF' : '#1d56c9' },
            { offset: '100%', color: '#333333' }
        ];

        stops.forEach(s => {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', s.offset);
            stop.setAttribute('stop-color', s.color);
            gradEl.appendChild(stop);
        });

        // Remove old decorations
        svg.querySelectorAll('.trend-dot, .trend-dashed').forEach(el => el.remove());

        // Add current position dot
        const lastPoint = points[points.length - 1];
        const [, lx, ly] = lastPoint.match(/L?(\d+),(\d+)/);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', lx);
        circle.setAttribute('cy', ly);
        circle.setAttribute('r', '3');
        circle.setAttribute('fill', '#FFFFFF');
        circle.classList.add('trend-dot');
        svg.appendChild(circle);

        // Dashed line down
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', lx);
        line.setAttribute('y1', ly);
        line.setAttribute('x2', lx);
        line.setAttribute('y2', '100');
        line.setAttribute('stroke', '#FFFFFF');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2 2');
        line.setAttribute('opacity', '0.3');
        line.classList.add('trend-dashed');
        svg.appendChild(line);

    } else {
        // Week view — show daily bars as line
        const points = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = getDateKey(d);
            const data = allData[key] || {};
            const time = getTotalTime(data);
            const maxTime = 28800; // 8 hours as max
            const x = ((6 - i) / 6) * 800;
            const y = 90 - Math.min((time / maxTime) * 80, 80);
            points.push(`${points.length === 0 ? 'M' : 'L'}${x},${y}`);
        }
        pathEl.setAttribute('d', points.join(' '));
        svg.querySelectorAll('.trend-dot, .trend-dashed').forEach(el => el.remove());

        // Simple gradient
        const gradEl = document.getElementById('gradientLine');
        gradEl.innerHTML = `
            <stop offset="0%" stop-color="#333333"></stop>
            <stop offset="50%" stop-color="#1d56c9"></stop>
            <stop offset="100%" stop-color="#FFFFFF"></stop>
        `;
    }
}

// ---- Sites Table ----
function updateSitesTable(merged) {
    const container = document.getElementById('sitesTableBody');
    const sites = getTopSites(merged, 10);

    if (sites.length === 0) {
        container.innerHTML = '<div class="empty-row"><span class="empty-text">No data recorded.</span></div>';
        return;
    }

    // Map categories to material icons
    const catIcons = {
        development: 'code',
        productivity: 'work',
        social: 'public',
        entertainment: 'movie',
        education: 'school',
        email: 'mail',
        search: 'search',
        shopping: 'shopping_bag',
        news: 'newspaper',
        other: 'language'
    };

    // Map categories to status type
    const catStatus = {
        development: 'focus',
        productivity: 'focus',
        education: 'focus',
        email: 'neutral',
        search: 'neutral',
        other: 'neutral',
        news: 'neutral',
        shopping: 'distract',
        entertainment: 'distract',
        social: 'distract'
    };

    let html = '';
    sites.forEach(site => {
        const catInfo = CATEGORIES[site.category] || CATEGORIES.other;
        const icon = catIcons[site.category] || 'language';
        const statusType = catStatus[site.category] || 'neutral';
        const statusLabel = statusType.toUpperCase();
        const durationClass = statusType === 'focus' ? 'focus-dur' : statusType === 'distract' ? 'distract-dur' : '';

        html += `
        <div class="site-row">
            <div class="site-domain-cell">
                <div class="site-icon">
                    <img src="${getFavicon(site.domain)}" alt="" onerror="this.outerHTML='<span class=\'material-symbols-outlined\'>${icon}</span>'">
                </div>
                <div class="site-name-info">
                    <span class="site-domain-text">${site.domain}</span>
                    <span class="site-category-text">${catInfo.label}</span>
                </div>
            </div>
            <div class="site-status-cell">
                <span class="status-badge ${statusType}">${statusLabel}</span>
            </div>
            <div class="site-duration-cell ${durationClass}">
                ${formatTimeDashboard(site.time)}
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// Format time as "Xh Ym"
function formatTimeDashboard(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ---- Export ----
function exportData() {
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airtime-export-${getDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
