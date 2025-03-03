AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: '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',
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
let allGrants = [];
let attributes = [];
let filterConfig = {
    textSearch: '',
    filters: {
        'Type of Grant': [],
        'Funding Source': [],
        'Minimum Grant Award': { min: 0, max: Infinity },
        'Maximum Grant Award': { min: 0, max: Infinity },
        'Application Deadline': { min: null, max: null },
        'Estimated Application Hours': { min: 0, max: Infinity }
    },
    sort: [
        { attr: 'Grant Name', direction: 'asc' },
        { attr: null, direction: 'asc' }
    ]
};
let favorites = [];
let filterPresets = {};

class GrantsManager {
    constructor() {
        this.container = document.getElementById('grantsContainer');
        this.loadSavedData();
        document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    }

    async loadGrants() {
        this.showLoading();
        try {
            const params = { TableName: 'grants' };
            const data = await this.scanDynamoDB(params);
            allGrants = data.Items || [];
            if (!allGrants.length) throw new Error('No grants found in database');
            attributes = this.extractAttributes(allGrants[0]);
            this.setupFilterControls();
            this.displayGrants();
            this.startCountdowns();
            this.trackEvent('Grants Loaded', { count: allGrants.length });
        } catch (err) {
            console.error('Error loading grants:', err);
            this.showError(`Failed to load grants: ${err.message}. Please try again.`);
        }
    }

    async scanDynamoDB(params) {
        let items = [];
        let lastEvaluatedKey = null;
        try {
            do {
                const response = await dynamodb.scan({
                    ...params,
                    ExclusiveStartKey: lastEvaluatedKey
                }).promise();
                items = items.concat(response.Items);
                lastEvaluatedKey = response.LastEvaluatedKey;
            } while (lastEvaluatedKey);
        } catch (err) {
            if (err.code === 'ThrottlingException') {
                console.warn('Throttling detected, retrying...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.scanDynamoDB(params);
            }
            throw err;
        }
        return { Items: items };
    }

    extractAttributes(sampleGrant) {
        return Object.keys(sampleGrant).filter(k => k !== 'grantId');
    }

    showLoading() {
        this.container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading Grants...</div>';
    }

    showError(message) {
        this.container.innerHTML = `<div class="grant-card error"><p>${message} <button onclick="grantsManager.loadGrants()">Retry</button></p></div>`;
    }

    setupFilterControls() {
        const controls = document.querySelector('.controls');
        if (!controls) return;
        this.populateFilterOptions('typeFilter', 'Type of Grant');
        this.populateFilterOptions('fundingFilter', 'Funding Source');
        this.populateSortOptions('sort1Attr', filterConfig.sort[0].attr);
        this.populateSortOptions('sort2Attr', filterConfig.sort[1].attr);
        document.getElementById('sort1Dir').value = filterConfig.sort[0].direction;
        document.getElementById('sort2Dir').value = filterConfig.sort[1].direction;
        this.updatePresetSelect();
    }

    populateFilterOptions(selectId, attr) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const uniqueValues = [...new Set(allGrants.map(g => g[attr] || ''))].sort();
        select.innerHTML = uniqueValues.map(val => `<option value="${val}">${val || 'N/A'}</option>`).join('');
    }

    populateSortOptions(selectId, selectedValue) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="">None</option>' + attributes.map(attr => 
            `<option value="${attr}" ${attr === selectedValue ? 'selected' : ''}>${attr}</option>`).join('');
    }

    updatePresetSelect() {
        const presetSelect = document.getElementById('presetSelect');
        if (!presetSelect) return;
        presetSelect.innerHTML = '<option value="">Load Preset</option>' + 
            Object.keys(filterPresets).map(name => `<option value="${name}">${name}</option>`).join('');
    }

    applyFilters() {
        filterConfig.textSearch = document.getElementById('searchInput')?.value.toLowerCase() || '';
        filterConfig.filters['Type of Grant'] = Array.from(document.getElementById('typeFilter')?.selectedOptions || []).map(opt => opt.value);
        filterConfig.filters['Funding Source'] = Array.from(document.getElementById('fundingFilter')?.selectedOptions || []).map(opt => opt.value);
        filterConfig.filters['Minimum Grant Award'] = {
            min: parseFloat(document.getElementById('minAwardMin')?.value) || 0,
            max: parseFloat(document.getElementById('minAwardMax')?.value) || Infinity
        };
        filterConfig.filters['Maximum Grant Award'] = {
            min: parseFloat(document.getElementById('maxAwardMin')?.value) || 0,
            max: parseFloat(document.getElementById('maxAwardMax')?.value) || Infinity
        };
        filterConfig.filters['Application Deadline'] = {
            min: this.parseDate(document.getElementById('deadlineMin')?.value),
            max: this.parseDate(document.getElementById('deadlineMax')?.value)
        };
        filterConfig.filters['Estimated Application Hours'] = {
            min: parseFloat(document.getElementById('hoursMin')?.value) || 0,
            max: parseFloat(document.getElementById('hoursMax')?.value) || Infinity
        };
        filterConfig.sort[0] = {
            attr: document.getElementById('sort1Attr')?.value || 'Grant Name',
            direction: document.getElementById('sort1Dir')?.value || 'asc'
        };
        filterConfig.sort[1] = {
            attr: document.getElementById('sort2Attr')?.value || null,
            direction: document.getElementById('sort2Dir')?.value || 'asc'
        };
        this.saveConfig();
        this.displayGrants();
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    displayGrants() {
        let filteredGrants = allGrants.filter(grant => {
            const textMatch = this.fuzzySearch(grant, filterConfig.textSearch);
            const typeMatch = !filterConfig.filters['Type of Grant'].length || filterConfig.filters['Type of Grant'].includes(grant['Type of Grant'] || '');
            const fundingMatch = !filterConfig.filters['Funding Source'].length || filterConfig.filters['Funding Source'].includes(grant['Funding Source'] || '');
            const minAwardMatch = (grant['Minimum Grant Award'] || 0) >= filterConfig.filters['Minimum Grant Award'].min &&
                                  (grant['Minimum Grant Award'] || 0) <= filterConfig.filters['Minimum Grant Award'].max;
            const maxAwardMatch = (grant['Maximum Grant Award'] || 0) >= filterConfig.filters['Maximum Grant Award'].min &&
                                  (grant['Maximum Grant Award'] || 0) <= filterConfig.filters['Maximum Grant Award'].max;
            const deadline = grant['Application Deadline'] === 'Rolling' ? null : this.parseDate(grant['Application Deadline']);
            const deadlineMatch = (!filterConfig.filters['Application Deadline'].min || (deadline && deadline >= filterConfig.filters['Application Deadline'].min)) &&
                                  (!filterConfig.filters['Application Deadline'].max || (deadline && deadline <= filterConfig.filters['Application Deadline'].max));
            const hoursMatch = (grant['Estimated Application Hours'] || 0) >= filterConfig.filters['Estimated Application Hours'].min &&
                               (grant['Estimated Application Hours'] || 0) <= filterConfig.filters['Estimated Application Hours'].max;
            return textMatch && typeMatch && fundingMatch && minAwardMatch && maxAwardMatch && deadlineMatch && hoursMatch;
        });

        filteredGrants.sort((a, b) => {
            for (let { attr, direction } of filterConfig.sort.filter(s => s.attr)) {
                const valA = attr === 'Application Deadline' && a[attr] === 'Rolling' ? '9999-12-31' : a[attr] || '';
                const valB = attr === 'Application Deadline' && b[attr] === 'Rolling' ? '9999-12-31' : b[attr] || '';
                let comparison = 0;
                if (attr === 'Application Deadline') {
                    comparison = (this.parseDate(valA) || new Date('9999-12-31')) - (this.parseDate(valB) || new Date('9999-12-31'));
                } else if (typeof valA === 'number') {
                    comparison = valA - valB;
                } else {
                    comparison = valA.toString().localeCompare(valB.toString());
                }
                if (comparison !== 0) return direction === 'asc' ? comparison : -comparison;
            }
            return 0;
        });

        this.container.innerHTML = filteredGrants.length === 0 ?
            '<div class="grant-card"><p>No grants match your criteria.</p></div>' :
            filteredGrants.map(grant => this.createGrantCard(grant)).join('');
        this.observeCards();
    }

    fuzzySearch(grant, term) {
        if (!term) return true;
        return attributes.some(attr => 
            (grant[attr] || '').toString().toLowerCase().includes(term));
    }

    createGrantCard(grant) {
        const isFavorite = favorites.includes(grant.grantId);
        return `
            <div class="grant-card" tabindex="0" data-grant-id="${grant.grantId}">
                <h3>${grant['Grant Name'] || 'Untitled'}</h3>
                <p><span class="tag ${grant['Type of Grant']?.toLowerCase()}">${grant['Type of Grant'] || 'N/A'}</span></p>
                <p><strong>Funding:</strong> ${grant['Funding Source'] || 'N/A'}</p>
                <p><strong>Award:</strong> $${(grant['Minimum Grant Award'] || 0).toLocaleString()} - $${(grant['Maximum Grant Award'] || 0).toLocaleString()}</p>
                <p class="deadline"><strong>Deadline:</strong> ${grant['Application Deadline'] || 'N/A'}</p>
                <p class="countdown" data-deadline="${grant['Application Deadline']}"></p>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${grant.grantId}')" aria-label="${isFavorite ? 'Remove from' : 'Add to'} favorites">
                    <i class="fas fa-star"></i>
                </button>
            </div>`;
    }

    observeCards() {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.grant-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.addEventListener('click', () => this.showGrantModal(card.dataset.grantId));
            observer.observe(card);
        });
    }

    startCountdowns() {
        setInterval(() => {
            document.querySelectorAll('.countdown').forEach(el => {
                const deadline = el.getAttribute('data-deadline');
                if (!deadline || deadline === 'Rolling') {
                    el.textContent = 'Rolling Deadline';
                    return;
                }
                const timeLeft = this.parseDate(deadline) - new Date();
                el.textContent = timeLeft <= 0 ?
                    'Deadline Passed' :
                    `Due in ${Math.floor(timeLeft / (1000 * 60 * 60 * 24))}d ${Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h`;
                el.style.color = timeLeft <= 0 ? '#e74c3c' : '#f39c12';
            });
        }, 1000);
    }

    showGrantModal(grantId) {
        const grant = allGrants.find(g => g.grantId === grantId);
        if (!grant) {
            console.error('Grant not found for ID:', grantId);
            return;
        }
        const modal = document.getElementById('grantModal');
        const modalContent = modal.querySelector('.modal-content');
        modalContent.dataset.grantId = grantId;
        document.getElementById('modalTitle').textContent = grant['Grant Name'] || 'Untitled';
        document.getElementById('modalDetails').innerHTML = attributes.map(attr =>
            `<p><strong>${attr}:</strong> ${grant[attr] !== undefined ? grant[attr].toLocaleString() : 'N/A'}</p>`
        ).join('');
        document.getElementById('favoriteBtn').textContent = favorites.includes(grantId) ? 'Remove from Favorites' : 'Add to Favorites';
        modal.style.display = 'flex';
    }

    setupEventListeners() {
        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };
        document.getElementById('searchInput')?.addEventListener('input', debounce(() => this.applyFilters(), 300));
        document.getElementById('applyFilters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('savePresetBtn')?.addEventListener('click', () => this.savePreset());
        document.getElementById('presetSelect')?.addEventListener('change', (e) => this.loadPreset(e.target.value));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }

    savePreset() {
        const name = prompt('Enter preset name:');
        if (name) {
            filterPresets[name] = JSON.parse(JSON.stringify(filterConfig));
            try {
                localStorage.setItem('filterPresets', JSON.stringify(filterPresets));
                this.updatePresetSelect();
            } catch (err) {
                console.error('Failed to save preset:', err);
                alert('Could not save preset. Storage may be full.');
            }
        }
    }

    loadPreset(name) {
        if (name && filterPresets[name]) {
            filterConfig = JSON.parse(JSON.stringify(filterPresets[name]));
            this.setupFilterControls();
            this.applyFilters();
        }
    }

    saveConfig() {
        try {
            localStorage.setItem('filterConfig', JSON.stringify(filterConfig));
        } catch (err) {
            console.error('Failed to save config:', err);
            alert('Could not save filter configuration.');
        }
    }

    loadSavedData() {
        try {
            const savedFavorites = localStorage.getItem('favorites');
            if (savedFavorites) favorites = JSON.parse(savedFavorites);
            const savedPresets = localStorage.getItem('filterPresets');
            if (savedPresets) filterPresets = JSON.parse(savedPresets);
            const savedConfig = localStorage.getItem('filterConfig');
            if (savedConfig) filterConfig = JSON.parse(savedConfig);
        } catch (err) {
            console.error('Failed to load saved data:', err);
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    }

    trackEvent(eventName, properties) {
        console.log(`Event: ${eventName}`, properties);
    }
}

const grantsManager = new GrantsManager();

function toggleTheme() {
    const themes = ['light', 'dark', 'high-contrast'];
    const currentTheme = document.body.classList[0] || 'light';
    const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
    document.body.classList.remove(...themes);
    document.body.classList.add(nextTheme);
    try {
        localStorage.setItem('theme', nextTheme);
    } catch (err) {
        console.error('Failed to save theme:', err);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function copyGrantDetails() {
    const title = document.getElementById('modalTitle').textContent;
    const details = document.getElementById('modalDetails').innerText;
    navigator.clipboard.writeText(`${title}\n${details}`).then(() => {
        alert('Grant details copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy details:', err);
        alert('Failed to copy details to clipboard.');
    });
}

function toggleFavorite(grantId) {
    if (!grantId) {
        const modalContent = document.querySelector('#grantModal .modal-content');
        grantId = modalContent?.dataset.grantId;
    }
    if (!grantId) return;
    const index = favorites.indexOf(grantId);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(grantId);
    }
    try {
        localStorage.setItem('favorites', JSON.stringify(favorites));
        grantsManager.displayGrants();
        const modal = document.getElementById('grantModal');
        if (modal && modal.style.display === 'flex') {
            document.getElementById('favoriteBtn').textContent = favorites.includes(grantId) ? 'Remove from Favorites' : 'Add to Favorites';
        }
    } catch (err) {
        console.error('Failed to update favorites:', err);
        alert('Could not update favorites.');
    }
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const filteredGrants = Array.from(document.querySelectorAll('.grant-card')).slice(0, 50); // Limit to 50 for performance
    doc.setFontSize(16);
    doc.text('Grants Nexus Report', 10, 10);
    filteredGrants.forEach((card, i) => {
        const y = 20 + i * 40;
        if (y > 280) { // Simple pagination
            doc.addPage();
            y = 20;
        }
        const grant = {
            name: card.querySelector('h3').textContent,
            type: card.querySelector('.tag').textContent,
            funding: card.querySelector('p:nth-child(3)').textContent.replace('Funding: ', ''),
            award: card.querySelector('p:nth-child(4)').textContent.replace('Award: ', ''),
            deadline: card.querySelector('.deadline').textContent.replace('Deadline: ', '')
        };
        doc.setFontSize(12);
        doc.text(`${grant.name}`, 10, y);
        doc.setFontSize(10);
        doc.text(`Type: ${grant.type}`, 10, y + 5);
        doc.text(`Funding: ${grant.funding}`, 10, y + 10);
        doc.text(`Award: ${grant.award}`, 10, y + 15);
        doc.text(`Deadline: ${grant.deadline}`, 10, y + 20);
    });
    doc.save('Grants_Nexus_Report.pdf');
}

window.onload = async () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(savedTheme);
    await grantsManager.loadGrants();
};