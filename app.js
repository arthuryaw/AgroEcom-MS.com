// ============================================================
        //  API CONFIGURATION
        // ============================================================
        let API_BASE_URL = localStorage.getItem('apiUrl') || 'http://localhost:5000/api';
        let isOffline = !navigator.onLine;

        function getApiUrl() {
            return API_BASE_URL;
        }

        function setApiUrl(url) {
            API_BASE_URL = url;
            localStorage.setItem('apiUrl', url);
            updateApiStatus();
        }

        // ============================================================
        //  OFFLINE MODE SUPPORT
        // ============================================================
        async function initializeOfflineMode() {
            if (typeof OfflineStorage !== 'undefined') {
                try {
                    await OfflineStorage.init();
                    console.log('✅ Offline mode initialized');
                } catch (error) {
                    console.warn('⚠️ Offline mode init failed:', error);
                }
            }
        }

        function updateOfflineStatus() {
            const offlineIndicator = document.getElementById('offlineStatusDesktop');
            if (offlineIndicator) {
                if (isOffline) {
                    offlineIndicator.style.display = 'inline-block !important';
                } else {
                    offlineIndicator.style.display = 'none !important';
                }
            }
        }

        // Setup offline/online listeners
        window.addEventListener('online', () => {
            isOffline = false;
            updateOfflineStatus();
            showToast('✅ You are back online');
        });

        window.addEventListener('offline', () => {
            isOffline = true;
            updateOfflineStatus();
            showToast('❌ You are offline - changes will sync when online');
        });

        // ============================================================
        //  API HELPER FUNCTIONS
        // ============================================================
        function getAuthToken() {
            return localStorage.getItem('authToken');
        }

        function setAuthToken(token) {
            localStorage.setItem('authToken', token);
        }

        function clearAuthToken() {
            localStorage.removeItem('authToken');
        }

        function showSpinner() {
            document.getElementById('spinnerOverlay').classList.add('show');
        }

        function hideSpinner() {
            document.getElementById('spinnerOverlay').classList.remove('show');
        }

        async function apiRequest(endpoint, options = {}) {
            const url = `${getApiUrl()}${endpoint}`;
            const token = getAuthToken();

            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            try {
                const response = await fetch(url, {
                    ...options,
                    headers
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'API request failed' }));
                    if (response.status === 401) {
                        clearAuthToken();
                        document.getElementById('entranceOverlay').style.display = 'flex';
                        document.getElementById('mainApp').style.display = 'none';
                        toast('❌ Session expired. Please login again.');
                    }
                    throw new Error(error.error || `HTTP ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                if (error.message.includes('Failed to fetch')) {
                    updateApiStatus(false);
                    throw new Error('Cannot connect to server. Please check if the API is running.');
                }
                throw error;
            }
        }

        // ============================================================
        //  API STATUS
        // ============================================================
        function updateApiStatus(online = true) {
            const statusElements = [
                document.getElementById('apiStatusBadge'),
                document.getElementById('apiStatusBadgeHeader'),
                document.getElementById('dashboardApiStatus'),
                document.getElementById('footerApiStatus')
            ];

            statusElements.forEach(el => {
                if (!el) return;
                if (online) {
                    el.className = 'api-status online';
                    el.innerHTML = '<span class="dot"></span> Online';
                } else {
                    el.className = 'api-status offline';
                    el.innerHTML = '<span class="dot"></span> Offline';
                }
            });
        }

        async function checkApiStatus() {
            try {
                const response = await fetch(`${getApiUrl()}/auth/status`, {
                    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
                });
                updateApiStatus(response.ok);
                return response.ok;
            } catch {
                updateApiStatus(false);
                return false;
            }
        }

        // ============================================================
        //  API FUNCTIONS
        // ============================================================
        const api = {
            // Auth
            login: (username, password) =>
                apiRequest('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                }),

            // Farmers
            getFarmers: () => apiRequest('/farmers'),
            getFarmer: (id) => apiRequest(`/farmers/${id}`),
            createFarmer: (data) => apiRequest('/farmers', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            updateFarmer: (id, data) => apiRequest(`/farmers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            }),
            deleteFarmer: (id) => apiRequest(`/farmers/${id}`, {
                method: 'DELETE'
            }),

            // Records
            getRecords: (params = {}) => {
                const query = new URLSearchParams(params).toString();
                return apiRequest(`/records?${query}`);
            },
            createRecord: (data) => apiRequest('/records', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            updateRecord: (id, data) => apiRequest(`/records/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            }),
            deleteRecord: (id) => apiRequest(`/records/${id}`, {
                method: 'DELETE'
            }),
            bulkDeleteRecords: (ids) => apiRequest('/records/bulk-delete', {
                method: 'POST',
                body: JSON.stringify({ ids })
            }),

            // Settings
            getSetting: (key) => apiRequest(`/settings/${key}`),
            saveSetting: (key, value) => apiRequest('/settings', {
                method: 'POST',
                body: JSON.stringify({ key, value })
            }),

            // Dashboard
            getStats: () => apiRequest('/dashboard/stats'),

            // Backup
            backup: () => apiRequest('/backup'),
            restore: (data) => apiRequest('/restore', {
                method: 'POST',
                body: JSON.stringify(data)
            })
        };

        // ============================================================
        //  THEME MANAGEMENT
        // ============================================================
        function getSystemTheme() { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }

        function setTheme(theme) {
            document.documentElement.setAttribute('data-bs-theme', theme);
            localStorage.setItem('ecom_theme', theme);
            document.getElementById('themeIcon').className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
            document.querySelectorAll('.btn-close').forEach(el => el.style.filter = theme === 'dark' ? 'invert(1)' :
            'invert(0)');
        }
        document.getElementById('themeToggleBtn').addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
            setTheme(current === 'light' ? 'dark' : 'light');
        });
        (function initTheme() { const saved = localStorage.getItem('ecom_theme'); saved ? setTheme(saved) : setTheme(
                getSystemTheme()); })();

        // ============================================================
        //  TOAST NOTIFICATION
        // ============================================================
        function toast(msg, type = 'info') {
            const toastEl = document.getElementById('liveToast');
            const msgEl = document.getElementById('toastMsg');
            msgEl.textContent = msg;

            // Change color based on type
            const bgColor = type === 'success' ? '#d4edda' :
                type === 'error' ? '#f8d7da' :
                type === 'warning' ? '#fff3cd' :
                '#d1ecf1';
            const textColor = type === 'success' ? '#155724' :
                type === 'error' ? '#721c24' :
                type === 'warning' ? '#856404' :
                '#0c5460';

            toastEl.style.background = bgColor;
            toastEl.style.color = textColor;

            const t = new bootstrap.Toast(toastEl);
            t.show();

            // Reset after 3 seconds
            setTimeout(() => {
                toastEl.style.background = '';
                toastEl.style.color = '';
            }, 3000);
        }

        // ============================================================
        //  DATA STATE
        // ============================================================
        let farmers = [];
        let pcRecords = [];
        let cashIn = [];
        let cashOut = [];
        let stockIn = [];
        let stockOut = [];
        let loans = [];
        let bonusHistory = [];
        let settings = { pricePerKg: 0.50, bonusRate: 5, volumeTier: 10000, volumeBonusExtra: 10 };
        let systemMeta = { lastReset: null, dataStartDate: null };

        // ============================================================
        //  HELPERS
        // ============================================================
        const BAG_SIZE = 64;
        const DEFAULT_STATION = 'Purchase Clerk';
        const RETENTION_DAYS = 10000;

        function getFarmerName(id) { const f = farmers.find(x => x.id === id); return f ? f.name : 'Unknown'; }
        function getFarmerStation(id) { const f = farmers.find(x => x.id === id); return f ? f.station || DEFAULT_STATION :
                DEFAULT_STATION; }
        function getFarmerType(id) { const f = farmers.find(x => x.id === id); return f ? f.type || 'registered' : 'registered'; }
        function getFarmerStatus(id) { const f = farmers.find(x => x.id === id); return f ? f.status || 'active' : 'active'; }
        function getFarmerDob(id) { const f = farmers.find(x => x.id === id); return f ? f.dob || null : null; }
        function getFarmerTelephone(id) { const f = farmers.find(x => x.id === id); return f ? f.telephone || '' : ''; }
        function getPricePerKg() { return settings.pricePerKg || 0.50; }
        function getBonusRate() { return settings.bonusRate || 5; }
        function getVolumeTier() { return settings.volumeTier || 10000; }
        function getVolumeBonusExtra() { return settings.volumeBonusExtra || 10; }
        function calcPayment(kg, rate) { return kg * rate; }
        function calcBonus(totalPayment, rate, totalKg) {
            let bonus = totalPayment * (rate / 100);
            if (totalKg >= getVolumeTier()) bonus *= (1 + getVolumeBonusExtra() / 100);
            return Math.round(bonus * 100) / 100;
        }
        function formatDate(d) { if (!d) return ''; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
        function formatDisplayDate(d) { if (!d) return '—'; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
        function nowDate() { return new Date().toISOString().split('T')[0]; }

        function generateFarmerId() {
            const year = new Date().getFullYear();
            const existing = farmers.filter(f => f.id && f.id.startsWith(`FARM-${year}`));
            return `FARM-${year}-${String(existing.length + 1).padStart(3, '0')}`;
        }

        function generateWalkInCard() {
            let newID;
            const existingCards = farmers
                .map(f => f.ghanaCard)
                .filter(card => card && card.startsWith('WALKIN-'));
            do {
                const num = Math.floor(10000 + Math.random() * 90000);
                newID = `WALKIN-${num}`;
            } while (existingCards.includes(newID));
            return newID;
        }

        function getPcNames() {
            const names = new Set();
            const activeCashOut = cashOut.filter(c => getFarmerStatus(c.farmerId) === 'active');
            const activeStockIn = stockIn.filter(s => getFarmerStatus(s.farmerId) === 'active');
            const activePcRecords = pcRecords.filter(r => getFarmerStatus(r.farmerId) === 'active');
            activeCashOut.forEach(c => { if (c.pcName) names.add(c.pcName); });
            activeStockIn.forEach(s => { if (s.pcName) names.add(s.pcName); });
            activePcRecords.forEach(r => {
                const station = r.station || getFarmerStation(r.farmerId);
                if (station) names.add(station);
            });
            if (names.size === 0) names.add('Purchase Clerk');
            return Array.from(names);
        }

        function getDataAge() {
            const dates = [...pcRecords.map(r => r.date), ...cashIn.map(r => r.date), ...cashOut.map(r => r.date), ...stockIn
                .map(r => r.date), ...stockOut.map(r => r.date)
            ].filter(d => d);
            if (dates.length === 0) return 0;
            if (systemMeta.dataStartDate) {
                const start = new Date(systemMeta.dataStartDate);
                return Math.ceil(Math.abs(new Date() - start) / (1000 * 60 * 60 * 24));
            }
            const oldest = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
            return Math.ceil(Math.abs(new Date() - oldest) / (1000 * 60 * 60 * 24));
        }

        function updateStorageIndicators() {
            const total = farmers.length + pcRecords.length + cashIn.length + cashOut.length + stockIn.length + stockOut
                .length + loans.length + bonusHistory.length;
            document.getElementById('storageCount').textContent = total;
            document.getElementById('footerRecordCount').textContent = total + ' records';
            document.getElementById('footerDispatchCount').textContent = 'Dispatches: ' + stockOut.length;
            document.getElementById('statDispatchCount').textContent = stockOut.length;
            document.getElementById('settingsDispatchCount').textContent = stockOut.length;
            document.getElementById('dashboardTotalRecords').textContent = total;
            document.getElementById('dashboardDispatchCount').textContent = stockOut.length;
            const age = getDataAge();
            document.getElementById('footerDataAge').textContent = `Data age: ${age} days`;
            document.getElementById('dashboardDataAge').textContent = age + ' days';
            const active = farmers.filter(f => f.status === 'active').length;
            const archived = farmers.filter(f => f.status === 'archived').length;
            document.getElementById('dashboardActiveFarmers').textContent = active;
            document.getElementById('dashboardArchivedFarmers').textContent = archived;
        }

        // ============================================================
        //  DATA LOAD / SAVE
        // ============================================================
        async function loadAllData() {
            showSpinner();
            try {
                // Load farmers
                const farmersData = await api.getFarmers();
                farmers = farmersData || [];

                // Load records
                const recordsData = await api.getRecords();
                const allRecords = recordsData || [];

                pcRecords = allRecords.filter(r => r.recordType === 'pcRecords');
                cashIn = allRecords.filter(r => r.recordType === 'cashIn');
                cashOut = allRecords.filter(r => r.recordType === 'cashOut');
                stockIn = allRecords.filter(r => r.recordType === 'stockIn');
                stockOut = allRecords.filter(r => r.recordType === 'stockOut');
                loans = allRecords.filter(r => r.recordType === 'loans');
                bonusHistory = allRecords.filter(r => r.recordType === 'bonusHistory');

                // Load settings
                try {
                    const settingsData = await api.getSetting('appSettings');
                    if (settingsData) settings = settingsData.value || settings;
                } catch (e) {
                    console.log('No settings found, using defaults');
                }

                try {
                    const metaData = await api.getSetting('systemMeta');
                    if (metaData) systemMeta = metaData.value || systemMeta;
                } catch (e) {
                    console.log('No system meta found');
                }

                updateApiStatus(true);
                console.log(`📊 Loaded: ${farmers.length} farmers, ${pcRecords.length} Purchase Clerk records`);
                toast('✅ Data loaded from server', 'success');
            } catch (error) {
                console.error('❌ Error loading data:', error);
                updateApiStatus(false);
                toast('❌ ' + error.message, 'error');
            } finally {
                hideSpinner();
            }
        }

        async function saveAllData() {
            showSpinner();
            try {
                // Save farmers
                for (const f of farmers) {
                    try {
                        await api.getFarmer(f.id);
                        await api.updateFarmer(f.id, f);
                    } catch {
                        await api.createFarmer(f);
                    }
                }

                // Save records
                const allRecords = [...pcRecords, ...cashIn, ...cashOut, ...stockIn, ...stockOut, ...loans, ...bonusHistory];
                for (const r of allRecords) {
                    try {
                        const existing = await api.getRecords({ id: r.id });
                        if (existing && existing.length > 0) {
                            await api.updateRecord(r.id, r);
                        } else {
                            await api.createRecord(r);
                        }
                    } catch {
                        await api.createRecord(r);
                    }
                }

                // Save settings
                await api.saveSetting('appSettings', settings);
                await api.saveSetting('systemMeta', systemMeta);

                updateStorageIndicators();
                console.log('💾 Data saved to API');
                toast('✅ Data saved successfully', 'success');
            } catch (error) {
                console.error('❌ Error saving data:', error);
                toast('❌ Error saving data: ' + error.message, 'error');
            } finally {
                hideSpinner();
            }
        }

        // ============================================================
        //  LOGIN / LOGOUT
        // ============================================================
        document.getElementById('entranceForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('entranceUsername').value.trim();
            const password = document.getElementById('entrancePassword').value.trim();
            const errorEl = document.getElementById('entranceError');

            showSpinner();
            try {
                const result = await api.login(username, password);
                setAuthToken(result.token);
                document.getElementById('entranceOverlay').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                document.getElementById('loginTimeDisplay').textContent = `Logged in as ${result.user.username}`;
                document.getElementById('headerUsername').textContent = result.user.username;
                errorEl.classList.add('d-none');
                document.getElementById('entrancePassword').value = '';
                toast('🔐 System unlocked', 'success');
                await loadAllData();
                await initApp();
            } catch (error) {
                errorEl.classList.remove('d-none');
                errorEl.textContent = '❌ ' + error.message;
                document.getElementById('entrancePassword').classList.add('shake');
                setTimeout(() => document.getElementById('entrancePassword').classList.remove('shake'), 500);
                document.getElementById('entrancePassword').value = '';
                document.getElementById('entrancePassword').focus();
                toast('❌ Login failed: ' + error.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        document.getElementById('toggleEntrancePassword').addEventListener('click', function() {
            const input = document.getElementById('entrancePassword');
            const icon = this.querySelector('i');
            input.type = input.type === 'password' ? 'text' : 'password';
            icon.className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
        });

        document.getElementById('entrancePassword').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') document.getElementById('entranceForm').dispatchEvent(new Event('submit'));
        });

        let logoutModal = null;

        document.getElementById('logoutBtn').addEventListener('click', function() {
            if (!logoutModal) logoutModal = new bootstrap.Modal(document.getElementById('logoutPasswordModal'));
            document.getElementById('logoutPasswordInput').value = '';
            document.getElementById('logoutPasswordError').classList.add('d-none');
            logoutModal.show();
        });

        document.getElementById('toggleLogoutPassword').addEventListener('click', function() {
            const input = document.getElementById('logoutPasswordInput');
            const icon = this.querySelector('i');
            input.type = input.type === 'password' ? 'text' : 'password';
            icon.className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
        });

        document.getElementById('confirmLogoutBtn').addEventListener('click', function() {
            const pass = document.getElementById('logoutPasswordInput').value.trim();
            if (pass === 'Ecom@2027') {
                logoutModal.hide();
                clearAuthToken();
                document.getElementById('entranceOverlay').style.display = 'flex';
                document.getElementById('entrancePassword').value = '';
                document.getElementById('entranceError').classList.add('d-none');
                document.getElementById('mainApp').style.display = 'none';
                toast('👋 Logged out', 'success');
                document.getElementById('logoutPasswordInput').value = '';
            } else {
                document.getElementById('logoutPasswordError').classList.remove('d-none');
                document.getElementById('logoutPasswordInput').classList.add('shake');
                setTimeout(() => document.getElementById('logoutPasswordInput').classList.remove('shake'), 500);
                document.getElementById('logoutPasswordInput').value = '';
                document.getElementById('logoutPasswordInput').focus();
                toast('❌ Incorrect password', 'error');
            }
        });

        document.getElementById('logoutPasswordInput').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') document.getElementById('confirmLogoutBtn').click();
        });

        // ============================================================
        //  SEARCH
        // ============================================================
        let searchQuery = '';
        let showArchived = false;

        function filterFarmers() {
            const q = searchQuery.toLowerCase().trim();
            const rows = document.querySelectorAll('#farmersBody tr');
            let visible = 0;
            rows.forEach(row => {
                const match = !q || row.textContent.toLowerCase().includes(q);
                row.style.display = match ? '' : 'none';
                if (match) visible++;
            });
            const no = document.getElementById('noFarmersFound');
            const displayFarmers = showArchived ? farmers : farmers.filter(f => f.status === 'active');
            no.classList.toggle('d-none', visible > 0 || displayFarmers.length === 0);
            if (displayFarmers.length === 0) {
                no.innerHTML =
                    `<i class="bi bi-people"></i><p>${showArchived ? 'No archived farmers.' : 'No active farmers.'}</p>`;
                no.classList.remove('d-none');
            } else if (visible === 0 && displayFarmers.length > 0) {
                no.innerHTML =
                    `<i class="bi bi-search"></i><p>No farmers match.</p><button class="btn btn-sm btn-outline-secondary" id="clearSearchFromEmptyBtn">Clear</button>`;
                no.classList.remove('d-none');
                document.getElementById('clearSearchFromEmptyBtn')?.addEventListener('click', clearSearch);
            }
            document.getElementById('visibleFarmerCount').textContent = visible;
            document.getElementById('totalFarmerCount').textContent = displayFarmers.length;
        }

        function clearSearch() { document.getElementById('farmerSearchInput').value = '';
            searchQuery = '';
            filterFarmers(); }
        document.getElementById('farmerSearchInput').addEventListener('input', function() { searchQuery = this.value;
            filterFarmers(); });
        document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);

        document.getElementById('toggleArchivedView').addEventListener('click', function() {
            showArchived = !showArchived;
            this.innerHTML = showArchived ?
                '<i class="bi bi-people me-1"></i> Show Active' :
                '<i class="bi bi-archive me-1"></i> Show Archived';
            renderFarmers();
            clearSearch();
        });

        // ============================================================
        //  SEARCHABLE DROPDOWN
        // ============================================================
        let selectedFarmerId = null;

        function initSearchableDropdown() {
            const searchInput = document.getElementById('pcFarmerSearch');
            const dropdown = document.getElementById('pcFarmerDropdown');
            const hiddenId = document.getElementById('pcFarmerId');

            if (!searchInput || !dropdown || !hiddenId) return;

            document.getElementById('pcModal').addEventListener('shown.bs.modal', function() {
                const activeFarmers = farmers.filter(f => f.status === 'active');
                if (activeFarmers.length === 0) {
                    dropdown.innerHTML =
                        `<div class="dropdown-item text-muted">No active farmers</div>`;
                    dropdown.classList.add('show');
                    return;
                }
                dropdown.innerHTML = activeFarmers.map(f =>
                    `<div class="dropdown-item" data-id="${f.id}" data-name="${f.name}">${f.id} - ${f.name}</div>`
                ).join('');
                dropdown.querySelectorAll('.dropdown-item').forEach(el => {
                    el.addEventListener('click', function() {
                        const id = this.dataset.id;
                        const name = this.dataset.name;
                        hiddenId.value = id;
                        searchInput.value = name;
                        dropdown.classList.remove('show');
                        selectedFarmerId = id;
                        const station = getFarmerStation(id);
                        document.getElementById('pcStation').value = station || DEFAULT_STATION;
                        updatePcCalculations();
                    });
                });
                if (hiddenId.value) {
                    const f = farmers.find(x => x.id === hiddenId.value);
                    if (f) {
                        searchInput.value = f.name;
                        selectedFarmerId = f.id;
                        const station = getFarmerStation(f.id);
                        document.getElementById('pcStation').value = station || DEFAULT_STATION;
                    }
                }
            });

            searchInput.addEventListener('input', function() {
                const q = this.value.toLowerCase().trim();
                const items = dropdown.querySelectorAll('.dropdown-item');
                let visible = 0;
                items.forEach(el => {
                    const match = !q || el.textContent.toLowerCase().includes(q);
                    el.style.display = match ? '' : 'none';
                    if (match) visible++;
                });
                if (visible === 0) {
                    dropdown.innerHTML =
                        `<div class="dropdown-item text-muted">No matching farmers</div>`;
                }
                dropdown.classList.add('show');
            });

            searchInput.addEventListener('blur', function() {
                setTimeout(() => {
                    dropdown.classList.remove('show');
                }, 200);
            });

            document.addEventListener('click', function(e) {
                const container = document.querySelector('.searchable-dropdown');
                if (container && !container.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            searchInput.addEventListener('change', function() {
                if (!this.value.trim()) {
                    hiddenId.value = '';
                    selectedFarmerId = null;
                }
            });
        }

        // ============================================================
        //  RENDER FUNCTIONS
        // ============================================================
        function renderFarmers() {
            const displayFarmers = showArchived ? farmers : farmers.filter(f => f.status === 'active');
            const tbody = document.getElementById('farmersBody');
            if (displayFarmers.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="7" class="text-center py-4"><div class="empty-state"><i class="bi bi-people"></i><h5>${showArchived ? 'No Archived Farmers' : 'No Active Farmers'}</h5></div></td></tr>`;
                return;
            }
            tbody.innerHTML = displayFarmers.map((f, index) => {
                const recs = pcRecords.filter(r => r.farmerId === f.id && getFarmerStatus(r.farmerId) === 'active')
                    .length;
                const type = f.type || 'registered';
                const typeBadge = type === 'registered' ?
                    `<span class="farmer-type-badge-registered">✓ Registered</span>` :
                    `<span class="farmer-type-badge-casual">🔄 Casual</span>`;
                const telDisplay = f.telephone ? `<span class="tel-badge"><i class="bi bi-phone me-1"></i>${f.telephone}</span>` :
                    `<span class="text-muted">—</span>`;
                const actions = f.status === 'active' ?
                    `
                        <button class="btn btn-sm btn-outline-secondary editFarmerBtn" data-id="${f.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger archiveFarmerBtn" data-id="${f.id}" title="Archive"><i class="bi bi-archive"></i></button>
                        <button class="btn btn-sm btn-outline-info viewFarmerBtn" data-id="${f.id}" title="View Details"><i class="bi bi-eye"></i></button>
                    ` :
                    `
                        <button class="btn btn-sm btn-outline-success restoreFarmerBtn" data-id="${f.id}" title="Restore"><i class="bi bi-arrow-counterclockwise"></i></button>
                        <button class="btn btn-sm btn-outline-info viewFarmerBtn" data-id="${f.id}" title="View Details"><i class="bi bi-eye"></i></button>
                    `;
                return `<tr>
                    <td>${index + 1}</td>
                    <td><strong>${f.name}</strong> <span class="record-count-badge">${recs}</span></td>
                    <td><span class="ghana-card-badge"><i class="bi bi-credit-card me-1"></i>${f.ghanaCard || 'N/A'}</span></td>
                    <td>${typeBadge}</td>
                    <td>${telDisplay}</td>
                    <td><span class="station-tag">${f.station || DEFAULT_STATION}</span></td>
                    <td class="action-buttons">${actions}</td>
                </tr>`;
            }).join('');

            document.querySelectorAll('.editFarmerBtn').forEach(b => b.addEventListener('click', () => openFarmerModal(b
                .dataset.id)));
            document.querySelectorAll('.archiveFarmerBtn').forEach(b => b.addEventListener('click', async () => {
                const id = b.dataset.id;
                const f = farmers.find(x => x.id === id);
                if (!f) return;
                if (confirm(`Archive farmer "${f.name}"? Their PC records will be kept but hidden.`)) {
                    f.status = 'archived';
                    await saveAllData();
                    renderAll();
                    toast(`🗑️ Farmer ${f.name} archived.`, 'warning');
                }
            }));
            document.querySelectorAll('.restoreFarmerBtn').forEach(b => b.addEventListener('click', async () => {
                const id = b.dataset.id;
                const f = farmers.find(x => x.id === id);
                if (!f) return;
                f.status = 'active';
                await saveAllData();
                renderAll();
                toast(`✅ Farmer ${f.name} restored.`, 'success');
            }));
            document.querySelectorAll('.viewFarmerBtn').forEach(b => b.addEventListener('click', () => viewFarmerDetails(b
                .dataset.id)));

            filterFarmers();
            populateDropdowns();
        }

        function viewFarmerDetails(id) {
            const f = farmers.find(x => x.id === id);
            if (!f) return;
            const recs = pcRecords.filter(r => r.farmerId === id && getFarmerStatus(r.farmerId) === 'active');
            const totalKg = recs.reduce((s, r) => s + (r.kg || 0), 0);
            const totalPay = recs.reduce((s, r) => s + (r.payment || 0), 0);
            const totalBags = recs.reduce((s, r) => s + (r.bags || 0), 0);
            const farmerLoans = loans.filter(l => l.farmerId === id && getFarmerStatus(l.farmerId) === 'active');
            const activeLoans = farmerLoans.filter(l => l.status === 'Active').length;
            const type = f.type || 'registered';
            const status = f.status || 'active';
            const dob = f.dob ? formatDisplayDate(f.dob) : '—';
            const tel = f.telephone || '—';

            let html = `<div class="row g-2">
                <div class="col-6"><strong>ID:</strong> ${f.id}</div>
                <div class="col-6"><strong>Name:</strong> ${f.name}</div>
                <div class="col-6"><strong>Ghana Card:</strong> ${f.ghanaCard || 'N/A'}</div>
                <div class="col-6"><strong>Telephone:</strong> ${tel}</div>
                <div class="col-6"><strong>Station:</strong> ${f.station || DEFAULT_STATION}</div>
                <div class="col-6"><strong>DOB:</strong> ${dob}</div>
                <div class="col-6"><strong>Type:</strong> ${type === 'registered' ? 'Registered ✓' : 'Casual'}</div>
                <div class="col-6"><strong>Status:</strong> ${status === 'active' ? 'Active ✓' : 'Archived'}</div>
            </div><hr>
            <div class="row g-2">
                <div class="col-4"><strong>Total kg:</strong> ${totalKg.toFixed(1)}</div>
                <div class="col-4"><strong>Bags:</strong> ${totalBags.toFixed(2)}</div>
                <div class="col-4"><strong>Payment:</strong> ${totalPay.toFixed(2)} GHS</div>
                <div class="col-4"><strong>Records:</strong> ${recs.length}</div>
                ${type === 'registered' && status === 'active' ? `
                    <div class="col-4"><strong>Est. Bonus:</strong> ${calcBonus(totalPay, getBonusRate(), totalKg).toFixed(2)} GHS</div>
                    <div class="col-4"><strong>Loans:</strong> ${farmerLoans.length} (${activeLoans} active)</div>
                ` : ''}
            </div><hr>
            <div><strong>Recent Records (last 100):</strong></div>
            <ul class="small">`;
            recs.slice(-100).reverse().forEach(r => {
                html += `<li>${formatDate(r.date)}: ${r.kg}kg → ${r.payment.toFixed(2)} GHS</li>`;
            });
            if (!recs.length) html += `<li class="text-muted">No records yet.</li>`;
            html += `</ul>`;

            document.getElementById('farmerDetailBody').innerHTML = html;
            const modal = new bootstrap.Modal(document.getElementById('farmerDetailModal'));
            modal.show();
        }

        function renderPcRecords() {
            const activeRecords = pcRecords.filter(r => getFarmerStatus(r.farmerId) === 'active');
            const tbody = document.getElementById('pcBody');
            if (activeRecords.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="8" class="text-center py-4"><div class="empty-state"><i class="bi bi-shop"></i><h5>No Cocoa P.C Records</h5><button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#pcModal"><i class="bi bi-plus-circle"></i> Add</button></div></td></tr>`;
                return;
            }
            const sorted = [...activeRecords].sort((a, b) => a.date < b.date ? 1 : -1);
            tbody.innerHTML = sorted.map((r) => {
                const fType = getFarmerType(r.farmerId);
                const typeHint = fType === 'casual' ? ' 🟡 casual farmer' : '';
                return `<tr>
                    <td><strong>${getFarmerName(r.farmerId)}</strong>${typeHint}<br><small class="text-muted">${r.farmerId}</small></td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.kg || 0}</td>
                    <td><span class="bag-badge">${(r.bags || 0).toFixed(2)}</span></td>
                    <td>${(r.rate || 0).toFixed(2)}</td>
                    <td><strong class="text-success">${(r.payment || 0).toFixed(2)}</strong></td>
                    <td><span class="station-tag">${r.station || getFarmerStation(r.farmerId) || DEFAULT_STATION}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary editPcBtn" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger deletePcBtn" data-id="${r.id}"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
            }).join('');
            document.querySelectorAll('.editPcBtn').forEach(b => b.addEventListener('click', () => openPcModal(b.dataset
            .id)));
            document.querySelectorAll('.deletePcBtn').forEach(b => b.addEventListener('click', async () => {
                const id = b.dataset.id;
                if (confirm('Delete this record? This will also remove its Cash Out and Stock In entries.')) {
                    try {
                        const cashOutIds = cashOut.filter(r => r.pcId === id).map(r => r.id);
                        const stockInIds = stockIn.filter(r => r.pcId === id).map(r => r.id);
                        for (const cid of cashOutIds) { await api.deleteRecord(cid); }
                        for (const sid of stockInIds) { await api.deleteRecord(sid); }
                        await api.deleteRecord(id);
                        pcRecords = pcRecords.filter(r => r.id !== id);
                        cashOut = cashOut.filter(r => r.pcId !== id);
                        stockIn = stockIn.filter(r => r.pcId !== id);
                        renderAll();
                        toast('🗑️ Record and all linked entries deleted', 'success');
                    } catch (e) {
                        toast('❌ Error deleting record: ' + e.message, 'error');
                    }
                }
            }));
        }

        function renderCash() {
            const inBody = document.getElementById('cashInBody');
            if (cashIn.length === 0) {
                inBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No cash in records</td></tr>`;
            } else {
                inBody.innerHTML = cashIn.map(r => `<tr>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="pc-badge">${r.source || 'N/A'}</span></td>
                    <td>${r.purpose || 'N/A'}</td>
                    <td><strong class="text-success">${(r.amount || 0).toFixed(2)}</strong></td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary editCashInBtn" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger deleteCashInBtn" data-id="${r.id}"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`).join('');
                document.querySelectorAll('.editCashInBtn').forEach(b => b.addEventListener('click', () =>
                    openCashInModal(b.dataset.id)));
                document.querySelectorAll('.deleteCashInBtn').forEach(b => b.addEventListener('click', async () => {
                    if (confirm('Delete this cash in record?')) {
                        const id = b.dataset.id;
                        cashIn = cashIn.filter(r => r.id !== id);
                        await api.deleteRecord(id);
                        renderAll();
                        toast('🗑️ Cash in deleted', 'success');
                    }
                }));
            }

            const outBody = document.getElementById('cashOutBody');
            const activeCashOut = cashOut.filter(r => {
                let fid = r.farmerId;
                if (!fid) {
                    const pc = pcRecords.find(p => p.id === r.pcId);
                    if (pc) fid = pc.farmerId;
                }
                return getFarmerStatus(fid) === 'active';
            });
            if (activeCashOut.length === 0) {
                outBody.innerHTML =
                    `<tr><td colspan="4" class="text-center text-muted">No cash out from active farmers</td></tr>`;
            } else {
                const sorted = [...activeCashOut].sort((a, b) => a.date < b.date ? 1 : -1);
                outBody.innerHTML = sorted.map(r => `<tr>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="pc-badge">${r.pcName || 'N/A'}</span></td>
                    <td>${r.farmerName || 'N/A'}</td>
                    <td><strong class="text-danger">${(r.amount || 0).toFixed(2)}</strong></td>
                </tr>`).join('');
            }

            const totalIn = cashIn.reduce((s, r) => s + (r.amount || 0), 0);
            const totalOut = cashOut.reduce((s, r) => s + (r.amount || 0), 0);
            document.getElementById('totalCashIn').textContent = totalIn.toFixed(2) + ' GHS';
            document.getElementById('totalCashOut').textContent = totalOut.toFixed(2) + ' GHS';
            document.getElementById('cashBalanceDisplay').textContent = (totalIn - totalOut).toFixed(2) + ' GHS';
            document.getElementById('statCashBalance').textContent = (totalIn - totalOut).toFixed(2);
            document.getElementById('statCashIn').textContent = totalIn.toFixed(2);
            document.getElementById('statCashOut').textContent = totalOut.toFixed(2);
        }

        function renderStock() {
            const inBody = document.getElementById('stockInBody');
            const activeStockIn = stockIn.filter(r => {
                let fid = r.farmerId;
                if (!fid) {
                    const pc = pcRecords.find(p => p.id === r.pcId);
                    if (pc) fid = pc.farmerId;
                }
                return getFarmerStatus(fid) === 'active';
            });
            if (activeStockIn.length === 0) {
                inBody.innerHTML =
                    `<tr><td colspan="6" class="text-center text-muted">No stock in from active farmers</td></tr>`;
            } else {
                const sorted = [...activeStockIn].sort((a, b) => a.date < b.date ? 1 : -1);
                inBody.innerHTML = sorted.map(r => `<tr>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="pc-badge">${r.pcName || 'N/A'}</span></td>
                    <td>${(r.bags || 0).toFixed(2)}</td>
                    <td>${(r.kg || 0).toFixed(1)}</td>
                    <td>${(r.amount || 0).toFixed(2)}</td>
                    </td>
                </tr>`).join('');
            }

            const outBody = document.getElementById('stockOutBody');
            if (stockOut.length === 0) {
                outBody.innerHTML =
                    `<tr><td colspan="6" class="text-center text-muted">No dispatches</td></tr>`;
            } else {
                outBody.innerHTML = stockOut.map(r => `<tr>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="pc-badge">${r.pcName || 'N/A'}</span></td>
                    <td>${(r.bags || 0).toFixed(2)}</td>
                    <td>${(r.kg || 0).toFixed(1)}</td>
                    <td><span class="badge bg-success">${r.note || 'Dispatch'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary editStockOutBtn" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger deleteStockOutBtn" data-id="${r.id}"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`).join('');

                document.querySelectorAll('.editStockOutBtn').forEach(b => b.addEventListener('click', () =>
                    openStockOutModal(b.dataset.id)));
                document.querySelectorAll('.deleteStockOutBtn').forEach(b => b.addEventListener('click', async () => {
                    const id = b.dataset.id;
                    if (confirm('Delete this dispatch?')) {
                        stockOut = stockOut.filter(r => r.id !== id);
                        await api.deleteRecord(id);
                        renderAll();
                        toast('🗑️ Dispatch deleted', 'success');
                    }
                }));
            }

            const ledBody = document.getElementById('pcLedgerBody');
            const grouped = {};
            pcRecords.forEach(r => {
                if (getFarmerStatus(r.farmerId) !== 'active') return;
                const key = r.date + '|' + (r.station || DEFAULT_STATION);
                if (!grouped[key]) grouped[key] = { date: r.date, pcName: r.station || DEFAULT_STATION,
                    amount: 0 };
                grouped[key].amount += (r.payment || 0);
            });
            const sortedLedger = Object.values(grouped).sort((a, b) => a.date < b.date ? 1 : -1);
            if (sortedLedger.length === 0) {
                ledBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No payments</td></tr>`;
            } else {
                ledBody.innerHTML = sortedLedger.map(r => `<tr>
                    <td>${formatDate(r.date)}</td>
                    <td><span class="pc-badge">${r.pcName}</span></td>
                    <td><strong class="text-success">${(r.amount || 0).toFixed(2)}</strong></td>
                    <td>Cocoa Purchase</td>
                </tr>`).join('');
            }

            const totalStockIn = stockIn.reduce((s, r) => s + (r.kg || 0), 0);
            const totalStockOut = stockOut.reduce((s, r) => s + (r.kg || 0), 0);
            const totalBags = stockIn.reduce((s, r) => s + (r.bags || 0), 0);
            const dispatchBags = stockOut.reduce((s, r) => s + (r.bags || 0), 0);
            document.getElementById('stockTotalIn').textContent = totalStockIn.toFixed(1) + ' kg';
            document.getElementById('stockTotalOut').textContent = totalStockOut.toFixed(1) + ' kg';
            document.getElementById('stockBalanceDisplay').textContent = (totalStockIn - totalStockOut).toFixed(1) + ' kg';
            document.getElementById('stockTotalBags').textContent = totalBags.toFixed(2);
            document.getElementById('dispatchCountDisplay').textContent = stockOut.length;
            document.getElementById('dispatchKgDisplay').textContent = totalStockOut.toFixed(1) + ' kg';
            document.getElementById('dispatchBagsDisplay').textContent = dispatchBags.toFixed(2);
            document.getElementById('statStockBalance').textContent = (totalStockIn - totalStockOut).toFixed(1);
            document.getElementById('statStockIn').textContent = totalStockIn.toFixed(1) + ' kg';
            document.getElementById('statStockOut').textContent = totalStockOut.toFixed(1) + ' kg';
            const pcNames = getPcNames();
            ['stockOutPc'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel) {
                    const current = sel.value;
                    sel.innerHTML = pcNames.map(n => `<option value="${n}">${n}</option>`).join('');
                    if (pcNames.includes(current)) sel.value = current;
                }
            });
        }

        function renderLoans() {
            const activeLoans = loans.filter(l => getFarmerStatus(l.farmerId) === 'active');
            const tbody = document.getElementById('loanBody');
            if (activeLoans.length === 0) {
                tbody.innerHTML =
                    `<tr><td colspan="6" class="text-center py-4"><div class="empty-state"><i class="bi bi-credit-card"></i><h5>No Loan Records</h5><button class="btn btn-loan btn-sm" data-bs-toggle="modal" data-bs-target="#loanModal"><i class="bi bi-plus-circle"></i> Record Loan</button></div></td></tr>`;
            } else {
                const sorted = [...activeLoans].sort((a, b) => a.date < b.date ? 1 : -1);
                tbody.innerHTML = sorted.map(r => {
                    const statusClass = r.status === 'Paid' ? 'loan-paid-badge' : 'loan-badge';
                    const statusText = r.status === 'Paid' ? '✅ Paid' : '⏳ Active';
                    return `<tr>
                        <td>${formatDate(r.date)}</td>
                        <td><strong>${getFarmerName(r.farmerId)}</strong><br><small class="text-muted">${r.farmerId}</small></td>
                        <td><strong class="text-primary">${(r.amount || 0).toFixed(2)} GHS</strong></td>
                        <td><span class="pc-badge">${r.purpose || 'N/A'}</span></td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-secondary editLoanBtn" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger deleteLoanBtn" data-id="${r.id}"><i class="bi bi-trash"></i></button>
                            ${r.status === 'Active' ? `<button class="btn btn-sm btn-success repayLoanBtn" data-id="${r.id}"><i class="bi bi-check"></i></button>` : ''}
                        </td>
                    </tr>`;
                }).join('');
                document.querySelectorAll('.editLoanBtn').forEach(b => b.addEventListener('click', () =>
                    openLoanModal(b.dataset.id)));
                document.querySelectorAll('.deleteLoanBtn').forEach(b => b.addEventListener('click', async () => {
                    if (confirm('Delete this loan record?')) {
                        const id = b.dataset.id;
                        loans = loans.filter(l => l.id !== id);
                        await api.deleteRecord(id);
                        renderAll();
                        toast('🗑️ Loan deleted', 'success');
                    }
                }));
                document.querySelectorAll('.repayLoanBtn').forEach(b => b.addEventListener('click', async () => {
                    const id = b.dataset.id;
                    const loan = loans.find(l => l.id === id);
                    if (loan) {
                        if (confirm(
                                `Mark loan of ${loan.amount.toFixed(2)} GHS for ${getFarmerName(loan.farmerId)} as Paid?`
                                )) {
                            loan.status = 'Paid';
                            await api.updateRecord(id, loan);
                            renderAll();
                            toast('✅ Loan marked as paid', 'success');
                        }
                    }
                }));
            }
            const totalLoans = loans.filter(l => getFarmerStatus(l.farmerId) === 'active').reduce((s, l) => s + (l
                .amount || 0), 0);
            const totalRepaid = loans.filter(l => l.status === 'Paid' && getFarmerStatus(l.farmerId) === 'active').reduce((
                s, l) => s + (l.amount || 0), 0);
            const totalOutstanding = totalLoans - totalRepaid;
            document.getElementById('totalLoans').textContent = totalLoans.toFixed(2) + ' GHS';
            document.getElementById('totalRepaid').textContent = totalRepaid.toFixed(2) + ' GHS';
            document.getElementById('totalOutstanding').textContent = totalOutstanding.toFixed(2) + ' GHS';
            document.getElementById('statActiveLoans').textContent = loans.filter(l => l.status === 'Active' &&
                getFarmerStatus(l.farmerId) === 'active').length;
        }

        function calculateBonus(year) {
            const yearStr = String(year);
            const filtered = pcRecords.filter(r => r.date && r.date.startsWith(yearStr) && getFarmerStatus(r.farmerId) ===
                'active');
            const result = [];
            const activeFarmers = farmers.filter(f => f.status === 'active');
            activeFarmers.forEach(f => {
                const fType = f.type || 'registered';
                if (fType !== 'registered') {
                    result.push({ farmerId: f.id, farmerName: f.name, farmerType: fType, totalKg: 0, totalBags: 0,
                        totalPayment: 0, bonus: 0, paid: false });
                    return;
                }
                const recs = filtered.filter(r => r.farmerId === f.id);
                if (recs.length === 0) {
                    result.push({ farmerId: f.id, farmerName: f.name, farmerType: fType, totalKg: 0, totalBags: 0,
                        totalPayment: 0, bonus: 0, paid: false });
                    return;
                }
                const totalKg = recs.reduce((s, r) => s + (r.kg || 0), 0);
                const totalBags = recs.reduce((s, r) => s + (r.bags || 0), 0);
                const totalPayment = recs.reduce((s, r) => s + (r.payment || 0), 0);
                const bonus = calcBonus(totalPayment, getBonusRate(), totalKg);
                const paid = bonusHistory.some(b => b.farmerId === f.id && String(b.year) === yearStr);
                result.push({ farmerId: f.id, farmerName: f.name, farmerType: fType, totalKg, totalBags, totalPayment,
                    bonus, paid });
            });
            return result;
        }

        function renderBonuses() {
            const year = document.getElementById('bonusYear').value || new Date().getFullYear();
            const data = calculateBonus(year);
            const tbody = document.getElementById('bonusBody');
            if (data.length === 0 || data.every(d => d.totalKg === 0)) {
                tbody.innerHTML =
                    `<tr><td colspan="8" class="text-center py-4"><div class="empty-state"><i class="bi bi-cash-stack"></i><h5>No bonus data</h5></div></td></tr>`;
            } else {
                const sorted = [...data].sort((a, b) => b.totalKg - a.totalKg);
                tbody.innerHTML = sorted.map((d, i) => {
                    const status = d.paid ? 'Paid' : (d.bonus > 0 ? 'Pending' : 'N/A');
                    const statusClass = d.paid ? 'bg-success' : (d.bonus > 0 ? 'bg-warning' : 'bg-secondary');
                    const isTop = i === 0 && d.totalKg > 0;
                    const typeBadge = d.farmerType === 'registered' ?
                        `<span class="farmer-type-badge-registered" style="font-size:0.6rem;">Registered</span>` :
                        `<span class="farmer-type-badge-casual" style="font-size:0.6rem;">Casual</span>`;
                    return `<tr class="${isTop ? 'top-farmer' : ''}">
                        <td><span class="farmer-id-badge">${d.farmerId}</span></td>
                        <td><strong>${d.farmerName}${isTop ? ' 🏆' : ''}</strong> ${typeBadge}</td>
                        <td>${d.totalKg.toFixed(1)}</td>
                        <td>${d.totalBags.toFixed(2)}</td>
                        <td><strong class="text-success">${d.totalPayment.toFixed(2)}</strong></td>
                        <td><span class="bonus-badge">${getBonusRate()}%</span></td>
                        <td><strong class="text-primary">${d.bonus.toFixed(2)} GHS</strong></td>
                        <td><span class="badge ${statusClass}">${status}</span></td>
                    </tr>`;
                }).join('');
            }
            const histBody = document.getElementById('bonusHistoryBody');
            if (bonusHistory.length === 0) {
                histBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No bonus payments</td></tr>`;
            } else {
                histBody.innerHTML = bonusHistory.map(r => `<tr>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.farmerName || 'N/A'}</td>
                    <td><strong class="text-success">${(r.amount || 0).toFixed(2)} GHS</strong></td>
                    <td>${r.year || 'N/A'}</td>
                    <td><span class="badge bg-success">Paid</span></td>
                </tr>`).join('');
            }
            const totalBonus = data.reduce((s, d) => s + d.bonus, 0);
            document.getElementById('statTotalBonus').textContent = totalBonus.toFixed(2) + ' GHS';
        }

        function renderDashboard() {
            const activeFarmers = farmers.filter(f => f.status === 'active');
            document.getElementById('statFarmers').textContent = activeFarmers.length;
            document.getElementById('statPcRecords').textContent = pcRecords.filter(r => getFarmerStatus(r.farmerId) ===
                'active').length;
            const totalIn = cashIn.reduce((s, r) => s + (r.amount || 0), 0);
            const totalOut = cashOut.reduce((s, r) => s + (r.amount || 0), 0);
            document.getElementById('statCashBalance').textContent = (totalIn - totalOut).toFixed(2);
            document.getElementById('statCashIn').textContent = totalIn.toFixed(2);
            document.getElementById('statCashOut').textContent = totalOut.toFixed(2);
            const totalStockIn = stockIn.reduce((s, r) => s + (r.kg || 0), 0);
            const totalStockOut = stockOut.reduce((s, r) => s + (r.kg || 0), 0);
            document.getElementById('statStockBalance').textContent = (totalStockIn - totalStockOut).toFixed(1);
            document.getElementById('statStockIn').textContent = totalStockIn.toFixed(1) + ' kg';
            document.getElementById('statStockOut').textContent = totalStockOut.toFixed(1) + ' kg';
            const year = document.getElementById('bonusYear').value || new Date().getFullYear();
            const bonusData = calculateBonus(year);
            const top = [...bonusData].sort((a, b) => b.totalKg - a.totalKg)[0];
            document.getElementById('topFarmerYear').textContent = year;
            const display = document.getElementById('topFarmerDisplay');
            if (top && top.totalKg > 0) {
                display.innerHTML = `<div class="d-flex align-items-center gap-3 flex-wrap">
                    <div class="bonus-trophy" style="font-size:2.5rem;">🏆</div>
                    <div><h5 class="mb-0" style="color:var(--text-primary);">${top.farmerName}</h5>
                    <div><span class="badge bg-success">${top.totalKg.toFixed(1)} kg</span><span class="badge bg-warning text-dark">${top.totalBags.toFixed(2)} bags</span></div></div>
                    <div class="ms-auto"><span class="h4 text-success">${top.bonus.toFixed(2)} GHS</span></div>
                </div>`;
            } else {
                display.innerHTML = `<div class="text-muted">No records yet.</div>`;
            }
            document.getElementById('headerFarmerCount').textContent = activeFarmers.length;
            document.getElementById('settingsActiveFarmerCount').textContent = activeFarmers.length;
            document.getElementById('settingsArchivedFarmerCount').textContent = farmers.filter(f => f.status === 'archived')
                .length;
            document.getElementById('settingsRecordCount').textContent = pcRecords.length + cashIn.length + cashOut.length +
                stockIn.length + stockOut.length + loans.length;
            document.getElementById('settingsTotalKg').textContent = pcRecords.reduce((s, r) => s + (r.kg || 0), 0).toFixed(
                1) + ' kg';
            const age = getDataAge();
            document.getElementById('footerDataAge').textContent = `Data age: ${age} days`;
            checkRetention();
        }

        function renderAll() {
            renderFarmers();
            renderPcRecords();
            renderCash();
            renderStock();
            renderLoans();
            renderBonuses();
            renderDashboard();
            updateStorageIndicators();
        }

        // ============================================================
        //  BONUS
        // ============================================================
        document.getElementById('calculateBonusBtn').addEventListener('click', () => {
            const year = parseInt(document.getElementById('bonusYear').value) || new Date().getFullYear();
            renderBonuses();
            toast(`💰 Bonuses calculated for ${year}`, 'success');
        });

        document.getElementById('exportBonusBtn').addEventListener('click', () => {
            const year = parseInt(document.getElementById('bonusYear').value) || new Date().getFullYear();
            const data = calculateBonus(year);
            let csv = 'Farmer ID,Farmer Name,Type,Total Kg,Total Bags,Total Payment (GHS),Bonus (GHS),Paid\n';
            data.forEach(d => {
                csv +=
                    `${d.farmerId},${d.farmerName},${d.farmerType},${d.totalKg.toFixed(1)},${d.totalBags.toFixed(2)},${d.totalPayment.toFixed(2)},${d.bonus.toFixed(2)},${d.paid ? 'Yes' : 'No'}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `bonus_${year}.csv`;
            link.click();
            toast('📥 CSV downloaded', 'success');
        });

        document.getElementById('payBonusBtn').addEventListener('click', async () => {
            const year = parseInt(document.getElementById('bonusYear').value) || new Date().getFullYear();
            const data = calculateBonus(year);
            const pending = data.filter(d => d.bonus > 0 && d.farmerType === 'registered' && !d.paid);
            if (pending.length === 0) { toast('❌ No unpaid bonuses to pay', 'error'); return; }
            const total = pending.reduce((s, d) => s + d.bonus, 0);
            if (!confirm(`Pay ${pending.length} registered farmers ${total.toFixed(2)} GHS for ${year}?`)) return;
            showSpinner();
            try {
                for (const d of pending) {
                    if (!bonusHistory.find(b => b.farmerId === d.farmerId && b.year === year)) {
                        const newBonus = { id: Date.now() + Math.random().toString(36), date: nowDate(),
                            farmerId: d.farmerId,
                            farmerName: d.farmerName, amount: d.bonus, year: year, recordType: 'bonusHistory' };
                        bonusHistory.push(newBonus);
                        await api.createRecord(newBonus);
                    }
                }
                await saveAllData();
                toast(`✅ Bonuses paid: ${pending.length} farmers, ${total.toFixed(2)} GHS`, 'success');
                renderAll();
            } catch (e) {
                toast('❌ Error paying bonuses: ' + e.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        // ============================================================
        //  DISPATCH REPORT
        // ============================================================
        document.getElementById('generateDispatchReport').addEventListener('click', function() {
            const card = document.getElementById('dispatchReportCard');
            const body = document.getElementById('dispatchReportBody');
            if (stockOut.length === 0) {
                toast('❌ No dispatch records to report', 'error');
                return;
            }
            card.style.display = 'block';
            let html = `<div class="report-summary mb-3">
                <h6>Dispatch Summary</h6>
                <div class="row">
                    <div class="col-4"><strong>Total Dispatches:</strong> ${stockOut.length}</div>
                    <div class="col-4"><strong>Total kg:</strong> ${stockOut.reduce((s, r) => s + (r.kg || 0), 0).toFixed(1)} kg</div>
                    <div class="col-4"><strong>Total Bags:</strong> ${stockOut.reduce((s, r) => s + (r.bags || 0), 0).toFixed(2)}</div>
                </div>
            </div>`;
            html +=
                `<table class="table table-sm"><thead><tr><th>Date</th><th>PC</th><th>Bags</th><th>kg</th><th>Note</th></tr></thead><tbody>`;
            stockOut.forEach(r => {
                html +=
                    `<tr><td>${formatDate(r.date)}</td><td>${r.pcName}</td><td>${(r.bags||0).toFixed(2)}</td><td>${(r.kg||0).toFixed(1)}</td><td>${r.note || '-'}</td></tr>`;
            });
            html += `</tbody></table>`;
            body.innerHTML = html;
        });

        document.getElementById('closeDispatchReport').addEventListener('click', function() {
            document.getElementById('dispatchReportCard').style.display = 'none';
        });

        // ============================================================
        //  RETENTION CHECK
        // ============================================================
        function checkRetention() {
            const age = getDataAge();
            const banner = document.getElementById('resetBannerContainer');
            const hasData = pcRecords.length > 0 || cashIn.length > 0 || cashOut.length > 0 || stockIn.length > 0 ||
                stockOut.length > 0;
            if (!hasData) { banner.innerHTML = ''; return; }
            if (age >= RETENTION_DAYS) {
                banner.innerHTML =
                    `<div class="reset-banner"><div class="d-flex justify-content-between flex-wrap gap-2">
                    <div><i class="bi bi-exclamation-triangle-fill text-danger me-2"></i><strong>⚠️ DATA RETENTION!</strong> ${age} days old</div>
                    <div><button class="btn btn-danger btn-sm" id="resetNowBtn"><i class="bi bi-trash me-1"></i>Reset</button>
                    <button class="btn btn-outline-secondary btn-sm" id="dismissResetBanner">Dismiss</button></div></div></div>`;
                document.getElementById('resetNowBtn')?.addEventListener('click', resetSettingsOnly);
                document.getElementById('dismissResetBanner')?.addEventListener('click', function() { banner.innerHTML =
                        ''; });
            } else if (age >= RETENTION_DAYS - 30 && hasData) {
                banner.innerHTML =
                    `<div class="reset-banner"><div class="d-flex justify-content-between flex-wrap gap-2">
                    <div><i class="bi bi-clock-history text-warning me-2"></i>⏳ ${RETENTION_DAYS - age} days until data expires</div>
                    <div><button class="btn btn-outline-warning btn-sm" id="viewRetentionDetails">View</button></div></div></div>`;
                document.getElementById('viewRetentionDetails')?.addEventListener('click', function() { toast(
                        `Data age: ${age} days. Max: ${RETENTION_DAYS} days`); });
            }
        }

        // ============================================================
        //  RESET FUNCTIONS
        // ============================================================
        function resetSettingsOnly() {
            if (confirm(
                    "This will only clear Settings (price per kg, bonus rate, etc.). All farmers and records will be KEPT. Continue?"
                    )) {
                settings = { pricePerKg: 0.50, bonusRate: 5, volumeTier: 10000, volumeBonusExtra: 10 };
                document.getElementById('pricePerKg').value = settings.pricePerKg;
                document.getElementById('bonusRate').value = settings.bonusRate;
                document.getElementById('volumeTier').value = settings.volumeTier;
                document.getElementById('volumeBonusExtra').value = settings.volumeBonusExtra;
                saveAllData();
                toast('⚙️ Settings reset. Farmers and records are safe.', 'warning');
                renderAll();
            }
        }

        function factoryReset() {
            if (confirm("DANGER: This will delete ALL farmers, records, loans, bonuses, and settings from the database. Are you sure?")) {
                if (confirm("Last warning. Delete everything? This cannot be undone!")) {
                    showSpinner();
                    // Clear all data from API
                    Promise.all([
                        ...farmers.map(f => api.deleteFarmer(f.id)),
                        ...pcRecords.map(r => api.deleteRecord(r.id)),
                        ...cashIn.map(r => api.deleteRecord(r.id)),
                        ...cashOut.map(r => api.deleteRecord(r.id)),
                        ...stockIn.map(r => api.deleteRecord(r.id)),
                        ...stockOut.map(r => api.deleteRecord(r.id)),
                        ...loans.map(r => api.deleteRecord(r.id)),
                        ...bonusHistory.map(r => api.deleteRecord(r.id))
                    ]).then(() => {
                        farmers = [];
                        pcRecords = [];
                        cashIn = [];
                        cashOut = [];
                        stockIn = [];
                        stockOut = [];
                        loans = [];
                        bonusHistory = [];
                        settings = { pricePerKg: 0.50, bonusRate: 5, volumeTier: 10000, volumeBonusExtra: 10 };
                        systemMeta = { lastReset: null, dataStartDate: null };
                        renderAll();
                        toast('🗑️ Factory reset complete', 'warning');
                        hideSpinner();
                    }).catch(e => {
                        toast('❌ Error during reset: ' + e.message, 'error');
                        hideSpinner();
                    });
                }
            }
        }

        // ============================================================
        //  BACKUP & RESTORE
        // ============================================================
        document.getElementById('exportBackupBtn').addEventListener('click', async function() {
            showSpinner();
            try {
                const data = await api.backup();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `EcomGhana_Backup_${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                toast('📦 Backup exported successfully', 'success');
            } catch (e) {
                toast('❌ Error exporting backup: ' + e.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        document.getElementById('importBackupBtn').addEventListener('click', function() {
            document.getElementById('importBackupInput').click();
        });

        document.getElementById('importBackupInput').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function(ev) {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data.farmers || !data.records) {
                        toast('❌ Invalid backup file', 'error');
                        return;
                    }
                    if (!confirm(
                            `This will REPLACE all current data with the backup from ${data.exportedAt || 'unknown date'}. Are you sure?`
                            )) {
                        document.getElementById('importBackupInput').value = '';
                        return;
                    }
                    showSpinner();
                    await api.restore(data);
                    await loadAllData();
                    renderAll();
                    toast('✅ Backup restored successfully', 'success');
                    document.getElementById('importBackupInput').value = '';
                } catch (err) {
                    toast('❌ Error importing backup: ' + err.message, 'error');
                    console.error(err);
                } finally {
                    hideSpinner();
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('quickExportBackup').addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('exportBackupBtn').click();
        });

        // ============================================================
        //  SYNC BUTTON
        // ============================================================
        document.getElementById('syncBtn').addEventListener('click', async function() {
            toast('🔄 Syncing with server...', 'info');
            await loadAllData();
            renderAll();
        });

        // ============================================================
        //  API URL SETTINGS
        // ============================================================
        document.getElementById('apiUrlInput').value = getApiUrl();

        document.getElementById('saveApiUrlBtn').addEventListener('click', function() {
            const url = document.getElementById('apiUrlInput').value.trim();
            if (url) {
                setApiUrl(url);
                toast('✅ API URL saved', 'success');
                checkApiStatus();
            } else {
                toast('❌ Please enter a valid URL', 'error');
            }
        });

        // ============================================================
        //  FARMER MODAL LOGIC
        // ============================================================
        function openFarmerModal(id) {
            const modal = new bootstrap.Modal(document.getElementById('farmerModal'));
            document.getElementById('farmerEditId').value = id || '';
            document.getElementById('mainForm').reset();
            document.getElementById('mainForm').classList.remove('was-validated');
            document.getElementById('casualForm').reset();
            document.getElementById('casualForm').classList.remove('was-validated');

            const mainTab = document.getElementById('main-tab');
            const casualTab = document.getElementById('casual-tab');

            if (id) {
                const f = farmers.find(x => x.id === id);
                if (f) {
                    if (f.type === 'registered') {
                        const tab = new bootstrap.Tab(mainTab);
                        tab.show();
                        document.getElementById('mainName').value = f.name;
                        document.getElementById('mainGhanaCard').value = f.ghanaCard || '';
                        document.getElementById('mainTelephone').value = f.telephone || '';
                        document.getElementById('mainDob').value = f.dob || '';
                        document.getElementById('mainStation').value = f.station || DEFAULT_STATION;
                        document.getElementById('casualGhanaCard').value = generateWalkInCard();
                        document.getElementById('casualName').value = '';
                    } else {
                        const tab = new bootstrap.Tab(casualTab);
                        tab.show();
                        document.getElementById('casualName').value = f.name;
                        document.getElementById('casualGhanaCard').value = f.ghanaCard || generateWalkInCard();
                        document.getElementById('mainName').value = '';
                        document.getElementById('mainGhanaCard').value = '';
                        document.getElementById('mainTelephone').value = '';
                        document.getElementById('mainDob').value = '';
                        document.getElementById('mainStation').value = DEFAULT_STATION;
                    }
                }
            } else {
                const tab = new bootstrap.Tab(mainTab);
                tab.show();
                document.getElementById('mainName').value = '';
                document.getElementById('mainGhanaCard').value = '';
                document.getElementById('mainTelephone').value = '';
                document.getElementById('mainDob').value = '';
                document.getElementById('mainStation').value = DEFAULT_STATION;
                document.getElementById('casualName').value = '';
                document.getElementById('casualGhanaCard').value = generateWalkInCard();
            }
            modal.show();
        }

        function validateField(input, regex) {
            const value = input.value.trim();
            const isValid = regex ? regex.test(value) : value !== '';
            input.classList.toggle('is-invalid', !isValid);
            return isValid;
        }

        function validateForm(formId, fields) {
            const form = document.getElementById(formId);
            let allValid = true;
            for (const { id, regex, required } of fields) {
                const input = document.getElementById(id);
                if (required) {
                    const valid = validateField(input, regex);
                    if (!valid) allValid = false;
                }
            }
            form.classList.add('was-validated');
            return allValid;
        }

        document.getElementById('saveMainFarmerBtn').addEventListener('click', async function() {
            const fields = [
                { id: 'mainName', required: true },
                { id: 'mainGhanaCard', required: true, regex: /^GHA-\d{9}-\d$/ },
                { id: 'mainTelephone', required: true },
                { id: 'mainDob', required: true }
            ];
            if (!validateForm('mainForm', fields)) {
                toast('❌ Please fill in all required fields correctly.', 'error');
                return;
            }

            const id = document.getElementById('farmerEditId').value;
            const name = document.getElementById('mainName').value.trim();
            const ghanaCard = document.getElementById('mainGhanaCard').value.trim();
            const telephone = document.getElementById('mainTelephone').value.trim();
            const dob = document.getElementById('mainDob').value;
            const station = document.getElementById('mainStation').value.trim() || DEFAULT_STATION;
            const type = 'registered';

            showSpinner();
            try {
                if (id) {
                    const f = farmers.find(x => x.id === id);
                    if (f) {
                        f.name = name;
                        f.ghanaCard = ghanaCard;
                        f.telephone = telephone;
                        f.dob = dob;
                        f.station = station;
                        f.type = type;
                        await api.updateFarmer(id, f);
                        toast(`✅ ${name} updated`, 'success');
                    }
                } else {
                    const newId = generateFarmerId();
                    const newFarmer = { id: newId, name, ghanaCard, telephone, dob, station, type, status: 'active' };
                    await api.createFarmer(newFarmer);
                    farmers.push(newFarmer);
                    toast(`🎉 ${name} registered! ID: ${newId}`, 'success');
                }
                await loadAllData();
                renderAll();
                bootstrap.Modal.getInstance(document.getElementById('farmerModal')).hide();
            } catch (e) {
                toast('❌ Error saving farmer: ' + e.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        document.getElementById('saveCasualFarmerBtn').addEventListener('click', async function() {
            const fields = [
                { id: 'casualName', required: true }
            ];
            if (!validateForm('casualForm', fields)) {
                toast('❌ Please enter the full name.', 'error');
                return;
            }

            const id = document.getElementById('farmerEditId').value;
            const name = document.getElementById('casualName').value.trim();
            const ghanaCard = document.getElementById('casualGhanaCard').value.trim();
            const type = 'casual';

            showSpinner();
            try {
                if (id) {
                    const f = farmers.find(x => x.id === id);
                    if (f) {
                        f.name = name;
                        f.ghanaCard = ghanaCard;
                        f.type = type;
                        await api.updateFarmer(id, f);
                        toast(`✅ ${name} updated`, 'success');
                    }
                } else {
                    const newId = generateFarmerId();
                    const newFarmer = { id: newId, name, ghanaCard, type, telephone: '', dob: null, station: '',
                        status: 'active' };
                    await api.createFarmer(newFarmer);
                    farmers.push(newFarmer);
                    toast(`🎉 ${name} registered! ID: ${newId} (Casual)`, 'success');
                }
                await loadAllData();
                renderAll();
                bootstrap.Modal.getInstance(document.getElementById('farmerModal')).hide();
            } catch (e) {
                toast('❌ Error saving farmer: ' + e.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        // Tab toggle logic
        document.getElementById('main-tab').addEventListener('shown.bs.tab', function() {
            document.getElementById('mainGhanaCard').readOnly = false;
            document.getElementById('mainGhanaCard').style.backgroundColor = 'var(--bg-input)';
            document.getElementById('casualGhanaCard').readOnly = true;
            document.getElementById('casualGhanaCard').style.backgroundColor = '#f8f9fa';
        });

        document.getElementById('casual-tab').addEventListener('shown.bs.tab', function() {
            const editId = document.getElementById('farmerEditId').value;
            if (!editId) {
                document.getElementById('casualGhanaCard').value = generateWalkInCard();
            }
            document.getElementById('casualGhanaCard').readOnly = true;
            document.getElementById('casualGhanaCard').style.backgroundColor = '#f8f9fa';
            document.getElementById('mainGhanaCard').readOnly = false;
            document.getElementById('mainGhanaCard').style.backgroundColor = 'var(--bg-input)';
        });

        // ============================================================
        //  P.C RECORD MODAL
        // ============================================================
        let bagsManuallyEdited = false;
        let paymentManuallyEdited = false;

        function updatePcCalculations() {
            const kg = parseFloat(document.getElementById('pcKg').value) || 0;
            const rate = parseFloat(document.getElementById('pcRate').value) || getPricePerKg();
            const bagsInput = document.getElementById('pcBags');
            const paymentInput = document.getElementById('pcPayment');

            if (!bagsManuallyEdited) {
                if (kg > 0) {
                    const bags = kg / BAG_SIZE;
                    bagsInput.value = bags.toFixed(2);
                } else {
                    bagsInput.value = '';
                }
            }

            if (!paymentManuallyEdited) {
                if (kg > 0 && rate > 0) {
                    const payment = kg * rate;
                    paymentInput.value = payment.toFixed(2);
                } else {
                    paymentInput.value = '';
                }
            }
        }

        document.getElementById('pcKg').addEventListener('input', function() {
            bagsManuallyEdited = false;
            paymentManuallyEdited = false;
            updatePcCalculations();
        });

        document.getElementById('pcRate').addEventListener('input', function() {
            paymentManuallyEdited = false;
            updatePcCalculations();
        });

        document.getElementById('pcBags').addEventListener('input', function() {
            if (this.value.trim() !== '') {
                bagsManuallyEdited = true;
            } else {
                bagsManuallyEdited = false;
            }
        });

        document.getElementById('pcPayment').addEventListener('input', function() {
            if (this.value.trim() !== '') {
                paymentManuallyEdited = true;
            } else {
                paymentManuallyEdited = false;
            }
        });

        function openPcModal(id) {
            const modal = new bootstrap.Modal(document.getElementById('pcModal'));
            document.getElementById('pcEditId').value = id || '';
            document.getElementById('pcStation').value = DEFAULT_STATION;

            bagsManuallyEdited = false;
            paymentManuallyEdited = false;

            if (id) {
                const r = pcRecords.find(x => x.id === id);
                if (r) {
                    const f = farmers.find(x => x.id === r.farmerId);
                    if (f) {
                        document.getElementById('pcFarmerSearch').value = f.name;
                        document.getElementById('pcFarmerId').value = f.id;
                        selectedFarmerId = f.id;
                        document.getElementById('pcStation').value = f.station || DEFAULT_STATION;
                    } else {
                        document.getElementById('pcFarmerSearch').value = '';
                        document.getElementById('pcFarmerId').value = '';
                        selectedFarmerId = null;
                    }
                    document.getElementById('pcDate').value = r.date;
                    document.getElementById('pcKg').value = r.kg || '';
                    document.getElementById('pcBags').value = (r.bags || 0).toFixed(2);
                    document.getElementById('pcRate').value = r.rate || getPricePerKg();
                    document.getElementById('pcPayment').value = (r.payment || 0).toFixed(2);
                    bagsManuallyEdited = false;
                    paymentManuallyEdited = false;
                    updatePcCalculations();
                }
            } else {
                const activeFarmers = farmers.filter(f => f.status === 'active');
                if (activeFarmers.length > 0) {
                    const f = activeFarmers[0];
                    document.getElementById('pcFarmerSearch').value = f.name;
                    document.getElementById('pcFarmerId').value = f.id;
                    selectedFarmerId = f.id;
                    document.getElementById('pcStation').value = f.station || DEFAULT_STATION;
                } else {
                    document.getElementById('pcFarmerSearch').value = '';
                    document.getElementById('pcFarmerId').value = '';
                    selectedFarmerId = null;
                }
                document.getElementById('pcDate').value = nowDate();
                document.getElementById('pcKg').value = '';
                document.getElementById('pcBags').value = '';
                document.getElementById('pcRate').value = getPricePerKg();
                document.getElementById('pcPayment').value = '';
                bagsManuallyEdited = false;
                paymentManuallyEdited = false;
            }
            modal.show();
        }

        document.getElementById('savePcBtn').addEventListener('click', async function() {
            const editId = document.getElementById('pcEditId').value;
            const farmerId = document.getElementById('pcFarmerId').value;
            const date = document.getElementById('pcDate').value;
            const kg = parseFloat(document.getElementById('pcKg').value) || 0;
            const bags = parseFloat(document.getElementById('pcBags').value) || 0;
            const rate = parseFloat(document.getElementById('pcRate').value) || getPricePerKg();
            const payment = parseFloat(document.getElementById('pcPayment').value) || 0;
            const station = document.getElementById('pcStation').value.trim() || DEFAULT_STATION;

            if (!farmerId) { toast('❌ Please select a farmer', 'error'); return; }
            if (getFarmerStatus(farmerId) !== 'active') { toast('❌ Farmer is archived. Cannot add/edit records.',
                'error'); return; }
            if (!date) { toast('❌ Date is required', 'error'); return; }
            if (kg <= 0) { toast('❌ Cocoa kg must be greater than 0', 'error'); return; }
            if (bags <= 0) { toast('❌ Bags must be greater than 0', 'error'); return; }
            if (rate <= 0) { toast('❌ Rate must be greater than 0', 'error'); return; }

            showSpinner();
            try {
                const fname = getFarmerName(farmerId);
                const pcId = editId || Date.now() + Math.random().toString(36);

                if (editId) {
                    const r = pcRecords.find(x => x.id === editId);
                    if (!r) { toast('❌ Record not found', 'error'); return; }
                    r.farmerId = farmerId;
                    r.date = date;
                    r.kg = kg;
                    r.bags = bags;
                    r.rate = rate;
                    r.payment = payment;
                    r.station = station;
                    await api.updateRecord(editId, r);

                    const existingCashOut = cashOut.find(c => c.pcId === editId);
                    if (existingCashOut) {
                        existingCashOut.date = date;
                        existingCashOut.pcName = station;
                        existingCashOut.farmerName = fname;
                        existingCashOut.farmerId = farmerId;
                        existingCashOut.amount = payment;
                        await api.updateRecord(existingCashOut.id, existingCashOut);
                    } else {
                        const newCashOut = { id: Date.now() + Math.random().toString(36), pcId: editId,
                            farmerId: farmerId,
                            date, pcName: station, farmerName: fname, farmers: 1, amount: payment,
                            recordType: 'cashOut' };
                        cashOut.push(newCashOut);
                        await api.createRecord(newCashOut);
                    }

                    const existingStockIn = stockIn.find(s => s.pcId === editId);
                    if (existingStockIn) {
                        existingStockIn.date = date;
                        existingStockIn.pcName = station;
                        existingStockIn.bags = bags;
                        existingStockIn.kg = kg;
                        existingStockIn.amount = payment;
                        existingStockIn.farmerId = farmerId;
                        await api.updateRecord(existingStockIn.id, existingStockIn);
                    } else {
                        const newStockIn = { id: Date.now() + Math.random().toString(36), pcId: editId,
                            farmerId: farmerId,
                            date, pcName: station, bags, kg, amount: payment, recordType: 'stockIn' };
                        stockIn.push(newStockIn);
                        await api.createRecord(newStockIn);
                    }
                    toast(`✅ P.C record updated for ${fname}`, 'success');
                } else {
                    const newPc = { id: pcId, farmerId, date, kg, bags, rate, payment, station,
                        recordType: 'pcRecords' };
                    pcRecords.push(newPc);
                    await api.createRecord(newPc);

                    const newCashOut = { id: Date.now() + Math.random().toString(36), pcId: pcId, farmerId: farmerId,
                        date,
                        pcName: station, farmerName: fname, farmers: 1, amount: payment, recordType: 'cashOut' };
                    cashOut.push(newCashOut);
                    await api.createRecord(newCashOut);

                    const newStockIn = { id: Date.now() + Math.random().toString(36), pcId: pcId, farmerId: farmerId,
                        date,
                        pcName: station, bags, kg, amount: payment, recordType: 'stockIn' };
                    stockIn.push(newStockIn);
                    await api.createRecord(newStockIn);

                    toast(`🌱 ${kg}kg recorded for ${fname}!`, 'success');
                }

                await loadAllData();
                renderAll();

                const modalEl = document.getElementById('pcModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();

                document.getElementById('pcKg').value = '';
                document.getElementById('pcBags').value = '';
                document.getElementById('pcRate').value = getPricePerKg();
                document.getElementById('pcPayment').value = '';
                document.getElementById('pcDate').value = nowDate();
                document.getElementById('pcFarmerSearch').value = '';
                document.getElementById('pcFarmerId').value = '';
                selectedFarmerId = null;
                bagsManuallyEdited = false;
                paymentManuallyEdited = false;

            } catch (error) {
                console.error('❌ Error saving PC record:', error);
                toast('❌ Error saving record: ' + error.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        // ============================================================
        //  CASH IN MODAL
        // ============================================================
        function openCashInModal(id) {
            const modal = new bootstrap.Modal(document.getElementById('cashInModal'));
            document.getElementById('cashInEditId').value = id || '';
            if (id) {
                const r = cashIn.find(x => x.id === id);
                if (r) {
                    document.getElementById('cashInDate').value = r.date;
                    document.getElementById('cashInSource').value = r.source;
                    document.getElementById('cashInPurpose').value = r.purpose;
                    document.getElementById('cashInAmount').value = r.amount || '';
                }
            } else {
                document.getElementById('cashInDate').value = nowDate();
                document.getElementById('cashInSource').value = 'AgroEcom Depo';
                document.getElementById('cashInPurpose').value = 'Cocoa Purchase Clerk';
                document.getElementById('cashInAmount').value = '';
            }
            modal.show();
        }

        document.getElementById('saveCashInBtn').addEventListener('click', async () => {
            const id = document.getElementById('cashInEditId').value;
            const date = document.getElementById('cashInDate').value;
            const source = document.getElementById('cashInSource').value;
            const purpose = document.getElementById('cashInPurpose').value;
            const amount = parseFloat(document.getElementById('cashInAmount').value) || 0;

            if (!date) return toast('❌ Date required', 'error');
            if (amount <= 0) return toast('❌ Amount must be > 0', 'error');

            showSpinner();
            try {
                if (id) {
                    const r = cashIn.find(x => x.id === id);
                    if (r) {
                        r.date = date;
                        r.source = source;
                        r.purpose = purpose;
                        r.amount = amount;
                        await api.updateRecord(id, r);
                        toast('✅ Cash in updated', 'success');
                    }
                } else {
                    const newCashIn = { id: Date.now() + Math.random().toString(36), date, source, purpose, amount,
                        recordType: 'cashIn' };
                    cashIn.push(newCashIn);
                    await api.createRecord(newCashIn);
                    toast('💰 Cash In recorded: ' + amount.toFixed(2) + ' GHS', 'success');
                }
                await loadAllData();
                renderAll();
                bootstrap.Modal.getInstance(document.getElementById('cashInModal')).hide();
                document.getElementById('cashInAmount').value = '';
            } catch (e) {
                toast('❌ Error: ' + e.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        // ============================================================
        //  STOCK OUT / DISPATCH MODAL
        // ============================================================
        function openStockOutModal(id) {
            const modal = new bootstrap.Modal(document.getElementById('stockOutModal'));
            document.getElementById('stockOutEditId').value = id || '';
            if (id) {
                const r = stockOut.find(x => x.id === id);
                if (r) {
                    document.getElementById('stockOutDate').value = r.date;
                    document.getElementById('stockOutPc').value = r.pcName;
                    document.getElementById('stockOutBags').value = r.bags || '';
                    document.getElementById('stockOutKg').value = r.kg || '';
                    document.getElementById('stockOutNote').value = r.note || '';
                }
            } else {
                document.getElementById('stockOutDate').value = nowDate();
                document.getElementById('stockOutBags').value = '';
                document.getElementById('stockOutNote').value = '';
            }
            modal.show();
        }

        document.getElementById('stockOutBags').addEventListener('input', function() {
            const bags = parseFloat(this.value) || 0;
            document.getElementById('stockOutKg').value = (bags * BAG_SIZE).toFixed(1);
        });

        document.getElementById('saveStockOutBtn').addEventListener('click', async () => {
            const id = document.getElementById('stockOutEditId').value;
            const date = document.getElementById('stockOutDate').value;
            const pcName = document.getElementById('stockOutPc').value;
            const bags = parseFloat(document.getElementById('stockOutBags').value) || 0;
            const kg = parseFloat(document.getElementById('stockOutKg').value) || 0;
            const note = document.getElementById('stockOutNote').value.trim();

            if (!date) return toast('❌ Date required', 'error');
            if (!pcName) return toast('❌ PC Name required', 'error');
            if (bags <= 0) return toast('❌ Bags must be > 0', 'error');

            const currentStockIn = stockIn.filter(r => getFarmerStatus(r.farmerId) === 'active')
                .reduce((s, r) => s + (r.kg || 0), 0);
            const currentStockOut = stockOut.filter(r => getFarmerStatus(r.farmerId) === 'active')
                .reduce((s, r) => s + (r.kg || 0), 0);
            let balance = currentStockIn - currentStockOut;

            if (id) {
                const oldRec = stockOut.find(x => x.id === id);
                if (oldRec) balance += (oldRec.kg || 0);
            }

            if (kg > balance) {
                toast(`❌ Insufficient stock! You have ${balance.toFixed(1)} kg. Cannot dispatch ${kg.toFixed(1)} kg.`,
                    'error');
                return;
            }

            showSpinner();
            try {
                if (id) {
                    const r = stockOut.find(x => x.id === id);
                    if (r) {
                        r.date = date;
                        r.pcName = pcName;
                        r.bags = bags;
                        r.kg = kg;
                        r.note = note;
                        await api.updateRecord(id, r);
                        toast('✅ Dispatch updated', 'success');
                    }
                } else {
                    const newStockOut = { id: Date.now() + Math.random().toString(36), date, pcName, bags, kg, note,
                        status: 'Dispatched', recordType: 'stockOut' };
                    stockOut.push(newStockOut);
                    await api.createRecord(newStockOut);
                    toast('🚚 Dispatch recorded to Ecom Depo', 'success');
                }
                await loadAllData();
                renderAll();
                bootstrap.Modal.getInstance(document.getElementById('stockOutModal')).hide();
                document.getElementById('stockOutBags').value = '';
                document.getElementById('stockOutNote').value = '';
            } catch (e) {
                toast('❌ Error: ' + e.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        // ============================================================
        //  LOAN MODAL
        // ============================================================
        function openLoanModal(id) {
            const modal = new bootstrap.Modal(document.getElementById('loanModal'));
            document.getElementById('loanEditId').value = id || '';
            populateLoanDropdown();
            if (id) {
                const r = loans.find(x => x.id === id);
                if (r) {
                    document.getElementById('loanFarmerId').value = r.farmerId;
                    document.getElementById('loanDate').value = r.date;
                    document.getElementById('loanAmount').value = r.amount || '';
                    document.getElementById('loanPurpose').value = r.purpose || 'Cocoa Inputs';
                    document.getElementById('loanStatus').value = r.status || 'Active';
                }
            } else {
                document.getElementById('loanDate').value = nowDate();
                document.getElementById('loanAmount').value = '';
                document.getElementById('loanPurpose').value = 'Cocoa Inputs';
                document.getElementById('loanStatus').value = 'Active';
            }
            modal.show();
        }

        function populateLoanDropdown() {
            const sel = document.getElementById('loanFarmerId');
            const registeredActive = farmers.filter(f => (f.type || 'registered') === 'registered' && f.status === 'active');
            if (registeredActive.length === 0) {
                sel.innerHTML = '<option value="">No registered active farmers</option>';
            } else {
                sel.innerHTML = registeredActive.map(f =>
                    `<option value="${f.id}">${f.id} - ${f.name} ${f.telephone ? '📞'+f.telephone : ''}</option>`
                ).join('');
            }
        }

        document.getElementById('loanModal').addEventListener('shown.bs.modal', function() {
            populateLoanDropdown();
        });

        document.getElementById('saveLoanBtn').addEventListener('click', async () => {
            const id = document.getElementById('loanEditId').value;
            const farmerId = document.getElementById('loanFarmerId').value;
            const date = document.getElementById('loanDate').value;
            const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
            const purpose = document.getElementById('loanPurpose').value;
            const status = document.getElementById('loanStatus').value;

            if (!farmerId) return toast('❌ Select farmer', 'error');
            const farmer = farmers.find(f => f.id === farmerId);
            if (!farmer) return toast('❌ Farmer not found', 'error');
            if ((farmer.type || 'registered') !== 'registered') {
                return toast('❌ Only Registered Farmers can receive loans. This farmer is Casual.', 'error');
            }
            if (farmer.status !== 'active') {
                return toast('❌ Farmer is archived. Cannot issue loans.', 'error');
            }
            if (!date) return toast('❌ Date required', 'error');
            if (amount <= 0) return toast('❌ Amount must be > 0', 'error');

            showSpinner();
            try {
                if (id) {
                    const r = loans.find(x => x.id === id);
                    if (r) {
                        r.farmerId = farmerId;
                        r.date = date;
                        r.amount = amount;
                        r.purpose = purpose;
                        r.status = status;
                        await api.updateRecord(id, r);
                        toast('✅ Loan updated', 'success');
                    }
                } else {
                    const newLoan = { id: Date.now() + Math.random().toString(36), farmerId, date, amount, purpose,
                        status, recordType: 'loans' };
                    loans.push(newLoan);
                    await api.createRecord(newLoan);
                    toast('💳 Loan recorded: ' + amount.toFixed(2) + ' GHS to ' + getFarmerName(farmerId), 'success');
                }
                await loadAllData();
                renderAll();
                bootstrap.Modal.getInstance(document.getElementById('loanModal')).hide();
                document.getElementById('loanAmount').value = '';
            } catch (e) {
                toast('❌ Error: ' + e.message, 'error');
            } finally {
                hideSpinner();
            }
        });

        // ============================================================
        //  POPULATE DROPDOWNS
        // ============================================================
        function populateDropdowns() {
            populateLoanDropdown();
            const pcNames = getPcNames();
            ['stockOutPc'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel) {
                    const current = sel.value;
                    sel.innerHTML = pcNames.map(n => `<option value="${n}">${n}</option>`).join('');
                    if (pcNames.includes(current)) sel.value = current;
                }
            });
        }

        // ============================================================
        //  SETTINGS
        // ============================================================
        document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
            settings.pricePerKg = parseFloat(document.getElementById('pricePerKg').value) || 0.50;
            settings.bonusRate = parseFloat(document.getElementById('bonusRate').value) || 5;
            settings.volumeTier = parseFloat(document.getElementById('volumeTier').value) || 10000;
            settings.volumeBonusExtra = parseFloat(document.getElementById('volumeBonusExtra').value) || 10;
            await saveAllData();
            toast('⚙️ Settings saved', 'success');
        });

        document.getElementById('resetSettingsOnlyBtn').addEventListener('click', resetSettingsOnly);
        document.getElementById('factoryResetBtn').addEventListener('click', factoryReset);

        // ============================================================
        //  EXPORT FUNCTIONS
        // ============================================================
        function exportCSV(data, headers, filename) {
            if (data.length === 0) { toast('❌ No data to export', 'error'); return; }
            let csv = headers.join(',') + '\n';
            data.forEach(row => {
                csv += headers.map(h => {
                    let val = row[h] !== undefined ? row[h] : '';
                    if (typeof val === 'string' && val.includes(',')) val = '"' + val + '"';
                    return val;
                }).join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename + '_' + new Date().toISOString().split('T')[0] + '.csv';
            link.click();
            toast('📥 ' + filename + ' exported', 'success');
        }

        document.getElementById('exportStockInBtn').addEventListener('click', function() {
            const headers = ['date', 'pcName', 'bags', 'kg', 'amount'];
            const data = stockIn.map(r => ({
                date: r.date,
                pcName: r.pcName || 'N/A',
                bags: (r.bags || 0).toFixed(2),
                kg: (r.kg || 0).toFixed(1),
                amount: (r.amount || 0).toFixed(2)
            }));
            exportCSV(data, headers, 'Stock_In');
        });

        document.getElementById('exportStockOutBtn').addEventListener('click', function() {
            const headers = ['date', 'pcName', 'bags', 'kg', 'type'];
            const data = stockOut.map(r => ({
                date: r.date,
                pcName: r.pcName || 'N/A',
                bags: (r.bags || 0).toFixed(2),
                kg: (r.kg || 0).toFixed(1),
                type: r.note || 'Dispatch'
            }));
            exportCSV(data, headers, 'Dispatch');
        });

        document.getElementById('exportLedgerBtn').addEventListener('click', function() {
            const headers = ['date', 'pcName', 'amount'];
            const grouped = {};
            const activePcRecords = pcRecords.filter(r => getFarmerStatus(r.farmerId) === 'active');
            activePcRecords.forEach(r => {
                const key = r.date + '|' + (r.station || DEFAULT_STATION);
                if (!grouped[key]) grouped[key] = { date: r.date, pcName: r.station || DEFAULT_STATION,
                    amount: 0 };
                grouped[key].amount += (r.payment || 0);
            });
            const data = Object.values(grouped).map(r => ({
                date: r.date,
                pcName: r.pcName,
                amount: r.amount.toFixed(2)
            }));
            exportCSV(data, headers, 'Ledger');
        });

        document.getElementById('exportAllStockBtn').addEventListener('click', function() {
            let count = 0;
            if (stockIn.length > 0) { document.getElementById('exportStockInBtn').click();
                count++; }
            if (stockOut.length > 0) { document.getElementById('exportStockOutBtn').click();
                count++; }
            if (pcRecords.length > 0) { document.getElementById('exportLedgerBtn').click();
                count++; }
            if (count === 0) { toast('❌ No stock data to export', 'error'); }
        });

        document.getElementById('exportActiveLoansBtn').addEventListener('click', function() {
            const headers = ['date', 'farmerName', 'farmerId', 'amount', 'purpose', 'status'];
            const data = loans.filter(l => l.status === 'Active' && getFarmerStatus(l.farmerId) === 'active').map(r => ({
                date: r.date,
                farmerName: getFarmerName(r.farmerId),
                farmerId: r.farmerId,
                amount: (r.amount || 0).toFixed(2),
                purpose: r.purpose || 'N/A',
                status: r.status || 'Active'
            }));
            exportCSV(data, headers, 'Active_Loans');
        });

        document.getElementById('exportPaidLoansBtn').addEventListener('click', function() {
            const headers = ['date', 'farmerName', 'farmerId', 'amount', 'purpose', 'status'];
            const data = loans.filter(l => l.status === 'Paid' && getFarmerStatus(l.farmerId) === 'active').map(r => ({
                date: r.date,
                farmerName: getFarmerName(r.farmerId),
                farmerId: r.farmerId,
                amount: (r.amount || 0).toFixed(2),
                purpose: r.purpose || 'N/A',
                status: r.status || 'Paid'
            }));
            exportCSV(data, headers, 'Paid_Loans');
        });

        document.getElementById('exportAllLoansBtn').addEventListener('click', function() {
            const headers = ['date', 'farmerName', 'farmerId', 'amount', 'purpose', 'status'];
            const data = loans.filter(l => getFarmerStatus(l.farmerId) === 'active').map(r => ({
                date: r.date,
                farmerName: getFarmerName(r.farmerId),
                farmerId: r.farmerId,
                amount: (r.amount || 0).toFixed(2),
                purpose: r.purpose || 'N/A',
                status: r.status || 'Active'
            }));
            exportCSV(data, headers, 'All_Loans');
        });

        // ============================================================
        //  TAB NAVIGATION
        // ============================================================
        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', function(e) {
                const target = this.getAttribute('data-bs-target');
                if (target === '#farmers') { clearSearch();
                    renderFarmers(); }
                if (target === '#dashboard') renderDashboard();
            });
        });

        // ============================================================
        //  INIT APP
        // ============================================================
        async function initApp() {
            try {
                const token = getAuthToken();
                if (!token) {
                    document.getElementById('entranceOverlay').style.display = 'flex';
                    document.getElementById('mainApp').style.display = 'none';
                    return;
                }

                // Check API status
                await checkApiStatus();

                // Load data
                await loadAllData();

                // Initialize UI
                document.getElementById('bonusYear').value = new Date().getFullYear();
                document.getElementById('pricePerKg').value = getPricePerKg();
                document.getElementById('bonusRate').value = getBonusRate();
                document.getElementById('volumeTier').value = getVolumeTier();
                document.getElementById('volumeBonusExtra').value = getVolumeBonusExtra();

                initSearchableDropdown();
                renderAll();

                console.log('🌿 AgroEcom Ghana · Cocoa Management System ready!');
                console.log(`📊 ${farmers.filter(f => f.status === 'active').length} active farmers`);
            } catch (e) {
                console.error('❌ Init error:', e);
                toast('❌ Failed to initialize: ' + e.message, 'error');
            }
        }

        // ============================================================
        //  DOCUMENT READY
        // ============================================================
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🌿 AgroEcom Ghana loaded');

            // Initialize offline mode
            initializeOfflineMode();
            updateOfflineStatus();

            // Check if already logged in
            const token = getAuthToken();
            if (token) {
                document.getElementById('entranceOverlay').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                initApp();
            } else {
                document.getElementById('entranceOverlay').style.display = 'flex';
                document.getElementById('mainApp').style.display = 'none';
            }
        });

        // Set footer year
        document.getElementById('footerYear').textContent = new Date().getFullYear();
