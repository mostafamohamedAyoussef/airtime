// ============================================================
// Airtime — Modals & Navigation Logic
// ============================================================

const MODAL_HTML = `
<div class="modal-overlay" id="modalOverlay">
    <div class="modal-container" id="settingsModal">
        <div class="modal-header">
            <h3>Settings</h3>
            <button class="close-modal-btn"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="modal-body">
            <div class="setting-group">
                <h4>DATA MANAGEMENT</h4>
                <div class="setting-row">
                    <span>Export Data</span>
                    <button class="action-btn-sm" id="modalExportBtn">
                        <span class="material-symbols-outlined">download</span> Export
                    </button>
                </div>
                <div class="setting-row">
                    <span>Clear All Data</span>
                    <button class="action-btn-sm danger" id="modalClearBtn">
                        <span class="material-symbols-outlined">delete</span> Clear
                    </button>
                </div>
            </div>
            <div class="setting-group">
                <h4>PREFERENCES</h4>
                <div class="setting-row">
                    <span>Categories</span>
                    <a href="ledger.html" class="action-link">Manage in Ledger</a>
                </div>
                <div class="setting-row">
                    <span>Theme</span>
                    <button class="action-btn-sm" id="modalThemeToggle">Toggle</button>
                </div>
            </div>
            <div class="setting-group">
                <h4>ABOUT</h4>
                <div class="setting-row">
                    <span>Version</span>
                    <span class="version-badge">v2.1.0</span>
                </div>
            </div>
        </div>
    </div>

    <div class="modal-container" id="profileModal">
        <div class="modal-header">
            <h3>Profile</h3>
            <button class="close-modal-btn"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="modal-body profile-body">
            <div class="profile-avatar">
                <span class="material-symbols-outlined avatar-icon">account_circle</span>
            </div>
            <h2 class="profile-name">Focus Explorer</h2>
            <div class="profile-stats">
                <div class="stat-item">
                    <span class="stat-label">FOCUS SCORE</span>
                    <span class="stat-val" id="modalFocusScore">—</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">LEVEL</span>
                    <span class="stat-val">Novice</span>
                </div>
            </div>
            <div class="profile-badge-row">
                <span class="status-badge focus">Free Plan</span>
            </div>
            <p class="profile-join-date">Member since 2026</p>
        </div>
    </div>
</div>
`;

function initModals() {
    // Inject HTML
    if (!document.getElementById('modalOverlay')) {
        document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
    }

    // Event Listeners for Open Buttons
    // Settings
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => openModal('settingsModal'));
    }
    document.querySelectorAll('.btn-settings').forEach(b => {
        b.addEventListener('click', () => openModal('settingsModal'));
    });

    // Profile
    const btnProfile = document.getElementById('btnProfile');
    if (btnProfile) {
        btnProfile.addEventListener('click', () => {
            updateProfileStats();
            openModal('profileModal');
        });
    }

    // Modal Actions
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') closeModal();
    });

    // Settings Functionality
    document.getElementById('modalExportBtn').addEventListener('click', handleExport);
    document.getElementById('modalClearBtn').addEventListener('click', handleClearData);
    document.getElementById('modalThemeToggle').addEventListener('click', () => {
        if (window.toggleTheme) window.toggleTheme();
    });
}

function openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.querySelectorAll('.modal-container').forEach(el => el.classList.remove('active'));
    document.getElementById(modalId).classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// Data Handlers
function handleExport() {
    const data = window.allData || {};
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airtime-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function handleClearData() {
    if (confirm('Are you sure? This will delete all local history.')) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.clear(() => location.reload());
        } else {
            localStorage.clear();
            location.reload();
        }
    }
}

async function updateProfileStats() {
    // Calculate simple stats based on loaded data
    if (window.storageAPI) {
        const stored = await window.storageAPI.get(null);
        let totalTime = 0;
        let weighted = 0;

        // Calculate All-Time Focus Score (Safety fallback)
        Object.values(stored).forEach(day => {
            if (day && typeof day === 'object') {
                Object.values(day).forEach(site => {
                    if (site.time) {
                        totalTime += site.time;
                        // Hacky calc for now
                        if (site.category === 'development' || site.category === 'productivity') weighted += site.time;
                    }
                });
            }
        });

        const score = totalTime > 0 ? Math.round((weighted / totalTime) * 100) : 0;
        // Or pull from Dashboard logic if available?
        // For now, simpler: just show "Active"
        document.getElementById('modalFocusScore').textContent = score > 0 ? score : '—';
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initModals);
