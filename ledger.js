// ============================================================
// Airtime — Ledger Script
// ============================================================

let allData = {};
let classifications = {}; // { domain: 'focus'|'neutral'|'distract' }
let currentFilter = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    // Load browsing data and classifications
    await loadCategories(); // Load categories
    // Load browsing data and classifications
    const stored = await storageAPI.get(null);

    // Separate classifications from browsing data
    if (stored._classifications) {
        classifications = stored._classifications;
        delete stored._classifications;
    }
    allData = stored;

    // Setup search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderLedger();
    });

    // Setup filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderLedger();
        });
    });

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    });

    renderLedger();
});

function getAllDomains() {
    const domainMap = {};

    // Aggregate all domains across all days
    for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('20') && typeof value === 'object') {
            for (const [domain, data] of Object.entries(value)) {
                if (!domainMap[domain]) {
                    domainMap[domain] = { time: 0, visits: 0, category: data.category, days: 0 };
                }
                domainMap[domain].time += data.time;
                domainMap[domain].visits += (data.visits || 0);
                domainMap[domain].days++;
            }
        }
    }

    // Calculate average time per day
    return Object.entries(domainMap).map(([domain, data]) => ({
        domain,
        avgTime: Math.round(data.time / Math.max(data.days, 1)),
        totalTime: data.time,
        category: data.category || 'other',
        classification: classifications[domain] || 'neutral'
    })).sort((a, b) => b.totalTime - a.totalTime);
}

function getClassificationStatus(domain) {
    if (classifications[domain]) return classifications[domain];

    // Auto-classify based on category
    const cat = categorizeDomain(domain);
    const prod = CATEGORY_PRODUCTIVITY[cat] || 0;
    if (prod >= 0.5) return 'focus';
    if (prod <= -0.3) return 'distract';
    return 'neutral';
}

function renderLedger() {
    const domains = getAllDomains();
    const container = document.getElementById('ledgerList');

    // Filter
    let filtered = domains;

    if (searchQuery) {
        filtered = filtered.filter(d => d.domain.toLowerCase().includes(searchQuery));
    }

    if (currentFilter === 'unsorted') {
        filtered = filtered.filter(d => !classifications[d.domain]);
    } else if (currentFilter === 'focused') {
        filtered = filtered.filter(d => getClassificationStatus(d.domain) === 'focus');
    } else if (currentFilter === 'distracted') {
        filtered = filtered.filter(d => getClassificationStatus(d.domain) === 'distract');
    }

    // Update counts
    const all = domains.length;
    const unsorted = domains.filter(d => !classifications[d.domain]).length;
    const focused = domains.filter(d => getClassificationStatus(d.domain) === 'focus').length;
    const distracted = domains.filter(d => getClassificationStatus(d.domain) === 'distract').length;

    document.getElementById('countAll').textContent = all;
    document.getElementById('countUnsorted').textContent = unsorted;
    document.getElementById('countFocused').textContent = focused;
    document.getElementById('countDistracted').textContent = distracted;
    document.getElementById('totalEntities').textContent = `TOTAL ENTITIES: ${all}`;
    document.getElementById('unsortedLabel').textContent = `UNSORTED: ${unsorted}`;

    // Render rows
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:48px;text-align:center;color:#666;font-family:var(--font-mono);">No domains found.</div>';
        return;
    }

    // Generate category options
    const categoryOptions = Object.entries(CATEGORIES)
        .filter(([key]) => key !== 'other')
        .map(([key, data]) => `<option value="${key}">${data.label}</option>`)
        .join('');
    // Add "Other" at the end
    const otherOption = `<option value="other">Other</option>`;

    let html = '';
    filtered.forEach(item => {
        const status = getClassificationStatus(item.domain);
        const isSorted = !!classifications[item.domain];
        const currentCat = categorizeDomain(item.domain); // dynamic check
        const catInfo = CATEGORIES[currentCat] || CATEGORIES.other;

        // Determine dot class
        let dotClass = 'neutral-dot';
        if (!isSorted) dotClass = 'unsorted';
        else if (status === 'focus') dotClass = 'focused';
        else if (status === 'distract') dotClass = 'distracted';

        // Determine toggle state
        let indicatorClass = 'neutral-pos';
        let distBtn = '', neutBtn = '', focusBtn = '';
        if (status === 'distract') {
            indicatorClass = 'distract-pos';
            distBtn = 'active-distract';
        } else if (status === 'focus') {
            indicatorClass = 'focus-pos';
            focusBtn = 'active-focus';
        } else {
            neutBtn = 'active-neutral';
        }

        html += `
        <div class="ledger-row ${isSorted ? 'sorted' : ''}">
            <div class="domain-cell">
                <div class="status-dot ${dotClass}"></div>
                <img src="${getFavicon(item.domain)}" alt="" class="domain-favicon" onerror="this.style.display='none'">
                <div class="domain-info">
                    <span class="domain-name">${item.domain}</span>
                    <select class="category-select" data-domain="${item.domain}">
                        ${categoryOptions}
                        ${otherOption}
                    </select>
                </div>
            </div>
            <div class="time-cell">${formatTimeCompact(item.avgTime)}</div>
            <div class="toggle-cell">
                <div class="tri-toggle" data-domain="${item.domain}">
                    <div class="toggle-indicator ${indicatorClass}"></div>
                    <button class="toggle-btn ${distBtn}" data-value="distract" title="Distracting">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                    <button class="toggle-btn ${neutBtn}" data-value="neutral" title="Neutral">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <button class="toggle-btn ${focusBtn}" data-value="focus" title="Focus">
                        <span class="material-symbols-outlined">circle</span>
                    </button>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;

    // Set selected values for dropdowns
    container.querySelectorAll('.category-select').forEach(select => {
        const domain = select.dataset.domain;
        const currentCat = categorizeDomain(domain);
        select.value = currentCat;

        // Event listener for category change
        select.addEventListener('change', async (e) => {
            const newCat = e.target.value;
            await updateDomainCategory(domain, newCat);
            renderLedger(); // Re-render to update categorization
        });
    });

    // Attach toggle event listeners
    container.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const toggle = btn.closest('.tri-toggle');
            const domain = toggle.dataset.domain;
            const value = btn.dataset.value;

            classifications[domain] = value;
            await chrome.storage.local.set({ _classifications: classifications });
            renderLedger();
        });
    });
}

/**
 * Move a domain to a new category
 */
async function updateDomainCategory(domain, newCategory) {
    // Remove from old category
    let found = false;
    for (const [catKey, catData] of Object.entries(CATEGORIES)) {
        const idx = catData.domains.indexOf(domain);
        if (idx !== -1) {
            catData.domains.splice(idx, 1);
            found = true;
        }
        // Also check if it was matching by suffix/wildcard? 
        // For simplicity in V3 MVP: we only support exact domain matches for re-categorization logic 
        // OR we add it to the explicit list of the new category.
        // If we remove it from "social", we should check if it was explicitly there.
    }

    // Add to new category (if not 'other' which is empty by default)
    if (newCategory !== 'other') {
        if (!CATEGORIES[newCategory].domains.includes(domain)) {
            CATEGORIES[newCategory].domains.push(domain);
        }
    }

    await saveCategories(CATEGORIES);
}

