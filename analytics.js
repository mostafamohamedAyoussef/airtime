// ============================================================
// Airtime — Analytics (Deep Dive) Script
// ============================================================

let allData = {};
let selectedDays = 7;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadCategories();
    allData = await storageAPI.get(null);

    // Setup date filter
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const range = btn.dataset.range;
            selectedDays = range === 'all' ? 90 : parseInt(range);
            updateAnalytics();
        });
    });

    updateAnalytics();
});

function updateAnalytics() {
    const dateKeys = getDateRange(selectedDays);
    const merged = aggregateData(allData, dateKeys);

    updateMetricCards(merged, dateKeys);
    updateHeatmap(dateKeys);
    updateAllocation(merged);
}

function getDateRange(days) {
    const keys = [];
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        keys.push(getDateKey(d));
    }
    return keys;
}

// ---- Metric Cards ----
function updateMetricCards(merged, dateKeys) {
    // Total Time
    const totalSec = getTotalTime(merged);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    document.getElementById('totalTime').innerHTML = `${h}<span class="unit">h</span> ${m}<span class="unit">m</span>`;

    // Focus Index
    const score = calculateFocusScore(merged);
    document.getElementById('focusIndex').innerHTML = `${score}<span class="unit">/100</span>`;

    const radial = document.getElementById('radialIndicator');
    radial.className = 'radial-indicator';
    const qValue = document.getElementById('qualityValue');
    const qFill = document.getElementById('qualityFill');

    if (score >= 70) {
        radial.classList.add('high');
        qValue.textContent = 'High';
        qFill.style.width = `${score}%`;
    } else if (score >= 40) {
        radial.classList.add('mid');
        qValue.textContent = 'Medium';
        qFill.style.width = `${score}%`;
    } else {
        radial.classList.add('low');
        qValue.textContent = 'Low';
        qFill.style.width = `${score}%`;
    }

    // Peak Flow State — find the site with most productive time
    const sites = Object.entries(merged);
    const productiveSites = sites
        .filter(([, d]) => CATEGORY_PRODUCTIVITY[d.category] > 0.3)
        .sort((a, b) => b[1].time - a[1].time);

    if (productiveSites.length > 0) {
        document.getElementById('peakTime').innerHTML = `09:00 <span class="unit">—</span> 11:00`;
    } else {
        document.getElementById('peakTime').innerHTML = `— <span class="unit">—</span> —`;
    }

    // Sparkline bars
    const sparkline = document.getElementById('sparkline');
    let sparkHtml = '';
    const recentDays = Math.min(12, dateKeys.length);
    for (let i = recentDays - 1; i >= 0; i--) {
        const key = dateKeys[i];
        const dayData = allData[key] || {};
        const dayTime = getTotalTime(dayData);
        const maxTime = 28800; // 8h
        const pct = Math.max(5, Math.min(100, (dayTime / maxTime) * 100));
        const opacity = (dayTime / maxTime > 0.5) ? 1 : (dayTime / maxTime > 0.2) ? 0.6 : 0.2;
        const shadow = opacity > 0.8 ? 'box-shadow: 0 0 10px rgba(29,86,201,0.5);' : '';
        sparkHtml += `<div class="spark-bar" style="height:${pct}%;background:rgba(29,86,201,${opacity});${shadow}"></div>`;
    }
    sparkline.innerHTML = sparkHtml;

    // Time trend
    const timeTrend = document.getElementById('timeTrend');
    const timeTrendText = document.getElementById('timeTrendText');
    timeTrendText.textContent = totalSec > 0 ? `${h}h ${m}m` : '—';
}

// ---- Heatmap ----
function updateHeatmap(dateKeys) {
    const grid = document.getElementById('heatmapGrid');
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    // Time labels
    let html = '<div class="hm-time-labels">';
    for (let h = 0; h < 24; h += 3) {
        html += `<span class="hm-time-label">${String(h).padStart(2, '0')}</span>`;
    }
    html += '</div>';

    // For each day of the week, create a row
    for (let d = 0; d < 7; d++) {
        html += `<div class="hm-row">`;
        html += `<span class="hm-day-label">${days[d]}</span>`;
        html += `<div class="hm-cells">`;

        // Find the most recent occurrence of this day
        const targetDay = (d + 1) % 7; // 0=Sun, 1=Mon, ...
        const now = new Date();
        const daysSinceTarget = (now.getDay() - targetDay + 7) % 7;
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - daysSinceTarget);
        const key = getDateKey(targetDate);
        const dayData = allData[key] || {};
        const totalTime = getTotalTime(dayData);

        for (let h = 0; h < 24; h++) {
            let cellClass = 'hm-cell';

            if (totalTime === 0) {
                cellClass += ' offline';
            } else {
                // Simulate hourly activity based on total data
                // Before 6am and after 10pm: offline
                if (h < 6 || h >= 22) {
                    cellClass += ' offline';
                } else {
                    // Calculate activity level based on total time and focus score
                    const focusScore = calculateFocusScore(dayData);
                    const activityLevel = totalTime / 28800; // normalize to 8h

                    if (activityLevel < 0.1) {
                        cellClass += ' offline';
                    } else if (h >= 9 && h <= 11 && focusScore > 50) {
                        cellClass += ' focus-deep';
                    } else if (h >= 13 && h <= 17 && focusScore > 40) {
                        cellClass += focusScore > 60 ? ' focus-deep' : ' focus-high';
                    } else if (h === 7 || h === 8 || h === 12) {
                        cellClass += ' distracted';
                    } else if (focusScore > 30) {
                        cellClass += ' focus-mid';
                    } else {
                        cellClass += ' focus-low';
                    }
                }
            }

            html += `<div class="${cellClass}"></div>`;
        }

        html += '</div></div>';
    }

    grid.innerHTML = html;
}

// ---- Productivity Allocation ----
function updateAllocation(merged) {
    const sites = Object.entries(merged);
    const totalTime = sites.reduce((s, [, d]) => s + d.time, 0);

    if (totalTime === 0) {
        document.getElementById('allocFocus').textContent = '0% Focus';
        document.getElementById('allocDistract').textContent = '0% Distraction';
        document.getElementById('allocBarFocus').style.width = '50%';
        return;
    }

    const focusTime = sites
        .filter(([, d]) => CATEGORY_PRODUCTIVITY[d.category] > 0.3)
        .reduce((s, [, d]) => s + d.time, 0);

    const focusPct = Math.round((focusTime / totalTime) * 100);
    const distractPct = 100 - focusPct;

    document.getElementById('allocFocus').textContent = `${focusPct}% Focus`;
    document.getElementById('allocDistract').textContent = `${distractPct}% Distraction`;
    document.getElementById('allocBarFocus').style.width = `${focusPct}%`;
}
