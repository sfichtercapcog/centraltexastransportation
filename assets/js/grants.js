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
        'Grant Type': [],
        'Funding Source': [],
        'Minimum Award Amount': { min: 0, max: Infinity },
        'Maximum Award Amount': { min: 0, max: Infinity },
        'Application Deadline': { min: null, max: null },
        'Application Hours': { min: 0, max: Infinity }
    },
    sort: [
        { attr: 'Grant Name', direction: 'ascending' },
        { attr: null, direction: 'ascending' }
    ]
};
let favorites = [];

class GrantsManager {
    constructor() {
        this.container = document.getElementById('grantsContainer');
        this.filterSummary = document.getElementById('filterSummary');
        this.loadSavedData();
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.showInitialPrompt();
        });
    }

    showInitialPrompt() {
        const prompt = document.getElementById('initialPrompt');
        if (prompt) prompt.style.display = 'flex';
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
            this.updateSuggestions();
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
        const controls = document.getElementById('filterControls');
        if (!controls) return;
        this.populateFilterOptions('typeFilter', 'Type of Grant');
        this.populateFilterOptions('fundingFilter', 'Funding Source');
        this.populateSortOptions('sort1Attr', filterConfig.sort[0].attr);
        this.populateSortOptions('sort2Attr', filterConfig.sort[1].attr);
        document.getElementById('sort1Dir').value = filterConfig.sort[0].direction;
        document.getElementById('sort2Dir').value = filterConfig.sort[1].direction;
        this.applySavedFilters();
    }

    populateFilterOptions(selectId, attr) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const uniqueValues = [...new Set(allGrants.map(g => g[attr] || ''))].sort();
        select.innerHTML = uniqueValues.map(val => `<option value="${val}">${val || 'N/A'}</option>`).join('');
        if (filterConfig.filters[attr === 'Type of Grant' ? 'Grant Type' : attr]) {
            filterConfig.filters[attr === 'Type of Grant' ? 'Grant Type' : attr].forEach(val => {
                const option = select.querySelector(`option[value="${val}"]`);
                if (option) option.selected = true;
            });
        }
    }

    populateSortOptions(selectId, selectedValue) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="">None</option>' + attributes.map(attr => 
            `<option value="${attr}" ${attr === selectedValue ? 'selected' : ''}>${attr}</option>`).join('');
    }

    updateSuggestions() {
        const datalist = document.getElementById('grantSuggestions');
        const suggestions = allGrants.map(g => g['Grant Name']).filter(Boolean);
        datalist.innerHTML = [...new Set(suggestions)].map(s => `<option value="${s}">`).join('');
    }

    applySavedFilters() {
        document.getElementById('searchInput').value = filterConfig.textSearch;
        document.getElementById('minAwardMin').value = filterConfig.filters['Minimum Award Amount'].min || '';
        document.getElementById('minAwardMax').value = filterConfig.filters['Minimum Award Amount'].max === Infinity ? '' : filterConfig.filters['Minimum Award Amount'].max;
        document.getElementById('maxAwardMin').value = filterConfig.filters['Maximum Award Amount'].min || '';
        document.getElementById('maxAwardMax').value = filterConfig.filters['Maximum Award Amount'].max === Infinity ? '' : filterConfig.filters['Maximum Award Amount'].max;
        document.getElementById('deadlineMin').value = filterConfig.filters['Application Deadline'].min ? filterConfig.filters['Application Deadline'].min.toISOString().split('T')[0] : '';
        document.getElementById('deadlineMax').value = filterConfig.filters['Application Deadline'].max ? filterConfig.filters['Application Deadline'].max.toISOString().split('T')[0] : '';
        document.getElementById('hoursMin').value = filterConfig.filters['Application Hours'].min || '';
        document.getElementById('hoursMax').value = filterConfig.filters['Application Hours'].max === Infinity ? '' : filterConfig.filters['Application Hours'].max;
    }

    applyFilters() {
        filterConfig.textSearch = document.getElementById('searchInput')?.value.toLowerCase() || '';
        filterConfig.filters['Grant Type'] = Array.from(document.getElementById('typeFilter')?.selectedOptions || []).map(opt => opt.value);
        filterConfig.filters['Funding Source'] = Array.from(document.getElementById('fundingFilter')?.selectedOptions || []).map(opt => opt.value);
        filterConfig.filters['Minimum Award Amount'] = {
            min: parseFloat(document.getElementById('minAwardMin')?.value) || 0,
            max: parseFloat(document.getElementById('minAwardMax')?.value) || Infinity
        };
        filterConfig.filters['Maximum Award Amount'] = {
            min: parseFloat(document.getElementById('maxAwardMin')?.value) || 0,
            max: parseFloat(document.getElementById('maxAwardMax')?.value) || Infinity
        };
        filterConfig.filters['Application Deadline'] = {
            min: this.parseDate(document.getElementById('deadlineMin')?.value),
            max: this.parseDate(document.getElementById('deadlineMax')?.value)
        };
        filterConfig.filters['Application Hours'] = {
            min: parseFloat(document.getElementById('hoursMin')?.value) || 0,
            max: parseFloat(document.getElementById('hoursMax')?.value) || Infinity
        };
        filterConfig.sort[0] = {
            attr: document.getElementById('sort1Attr')?.value || 'Grant Name',
            direction: document.getElementById('sort1Dir')?.value || 'ascending'
        };
        filterConfig.sort[1] = {
            attr: document.getElementById('sort2Attr')?.value || null,
            direction: document.getElementById('sort2Dir')?.value || 'ascending'
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
        let filteredGrants = allGrants;
        if (document.getElementById('filterControls').style.display !== 'none') {
            filteredGrants = allGrants.filter(grant => {
                const textMatch = this.fuzzySearch(grant, filterConfig.textSearch);
                const typeMatch = !filterConfig.filters['Grant Type'].length || filterConfig.filters['Grant Type'].includes(grant['Type of Grant'] || '');
                const fundingMatch = !filterConfig.filters['Funding Source'].length || filterConfig.filters['Funding Source'].includes(grant['Funding Source'] || '');
                const minAwardMatch = (grant['Minimum Grant Award'] || 0) >= filterConfig.filters['Minimum Award Amount'].min &&
                                      (grant['Minimum Grant Award'] || 0) <= filterConfig.filters['Minimum Award Amount'].max;
                const maxAwardMatch = (grant['Maximum Grant Award'] || 0) >= filterConfig.filters['Maximum Award Amount'].min &&
                                      (grant['Maximum Grant Award'] || 0) <= filterConfig.filters['Maximum Award Amount'].max;
                const deadline = grant['Application Deadline'] === 'Rolling' ? null : this.parseDate(grant['Application Deadline']);
                const deadlineMatch = (!filterConfig.filters['Application Deadline'].min || (deadline && deadline >= filterConfig.filters['Application Deadline'].min)) &&
                                      (!filterConfig.filters['Application Deadline'].max || (deadline && deadline <= filterConfig.filters['Application Deadline'].max));
                const hoursMatch = (grant['Estimated Application Hours'] || 0) >= filterConfig.filters['Application Hours'].min &&
                                   (grant['Estimated Application Hours'] || 0) <= filterConfig.filters['Application Hours'].max;
                return textMatch && typeMatch && fundingMatch && minAwardMatch && maxAwardMatch && deadlineMatch && hoursMatch;
            });
        }

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
                if (comparison !== 0) return direction === 'ascending' ? comparison : -comparison;
            }
            return 0;
        });

        this.container.innerHTML = filteredGrants.length === 0 ?
            '<div class="grant-card"><p>No grants match your criteria.</p></div>' :
            filteredGrants.map(grant => this.createGrantCard(grant)).join('');
        this.updateFilterSummary(filteredGrants.length);
        this.observeCards();
    }

    fuzzySearch(grant, term) {
        if (!term) return true;
        return attributes.some(attr => 
            (grant[attr] || '').toString().toLowerCase().includes(term));
    }

    createGrantCard(grant) {
        const isFavorite = favorites.includes(grant.grantId);
        const deadlineClass = this.parseDate(grant['Application Deadline']) && this.parseDate(grant['Application Deadline']) < new Date() ? 'passed' : '';
        return `
            <div class="grant-card" tabindex="0" data-grant-id="${grant.grantId}">
                <h3>${grant['Grant Name'] || 'Untitled'}</h3>
                <p><span class="tag ${grant['Type of Grant']?.toLowerCase()}">${grant['Type of Grant'] || 'N/A'}</span></p>
                <p><strong>Funding:</strong> ${grant['Funding Source'] || 'N/A'}</p>
                <p><strong>Award:</strong> $${(grant['Minimum Grant Award'] || 0).toLocaleString()} - $${(grant['Maximum Grant Award'] || 0).toLocaleString()}</p>
                <p class="deadline ${deadlineClass}"><strong>Deadline:</strong> ${grant['Application Deadline'] || 'N/A'}</p>
                <p class="countdown" data-deadline="${grant['Application Deadline']}"></p>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${grant.grantId}')" aria-label="${isFavorite ? 'Remove from' : 'Add to'} favorites">
                    <i class="fas fa-star"></i>
                </button>
            </div>`;
    }

    updateFilterSummary(count) {
        const summary = [];
        if (filterConfig.textSearch) summary.push(`Search: "${filterConfig.textSearch}"`);
        if (filterConfig.filters['Grant Type'].length) summary.push(`Types: ${filterConfig.filters['Grant Type'].join(', ')}`);
        if (filterConfig.filters['Funding Source'].length) summary.push(`Sources: ${filterConfig.filters['Funding Source'].join(', ')}`);
        if (filterConfig.filters['Minimum Award Amount'].min || filterConfig.filters['Minimum Award Amount'].max !== Infinity) {
            summary.push(`Min Award: ${filterConfig.filters['Minimum Award Amount'].min} - ${filterConfig.filters['Minimum Award Amount'].max === Infinity ? 'Any' : filterConfig.filters['Minimum Award Amount'].max}`);
        }
        this.filterSummary.textContent = `Showing ${count} grants${summary.length ? ' | ' + summary.join(', ') : ''}`;
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
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.favorite-btn')) this.showGrantModal(card.dataset.grantId);
            });
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
                    `Due in ${Math.floor(timeLeft / (1000 * 60 * 60 * 24))} days ${Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))} hours`;
                el.className = `countdown ${timeLeft <= 0 ? 'passed' : ''}`;
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
        document.getElementById('resetFilters')?.addEventListener('click', () => this.resetFilters());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }

    resetFilters() {
        filterConfig = {
            textSearch: '',
            filters: {
                'Grant Type': [],
                'Funding Source': [],
                'Minimum Award Amount': { min: 0, max: Infinity },
                'Maximum Award Amount': { min: 0, max: Infinity },
                'Application Deadline': { min: null, max: null },
                'Application Hours': { min: 0, max: Infinity }
            },
            sort: [
                { attr: 'Grant Name', direction: 'ascending' },
                { attr: null, direction: 'ascending' }
            ]
        };
        this.setupFilterControls();
        this.applyFilters();
        this.filterSummary.textContent = '';
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

function handleInitialPrompt(choice) {
    const prompt = document.getElementById('initialPrompt');
    const controls = document.getElementById('filterControls');
    if (choice === 'viewAll') {
        closeModal('initialPrompt');
        grantsManager.loadGrants();
    } else if (choice === 'filter') {
        closeModal('initialPrompt');
        controls.style.display = 'block';
        controls.classList.remove('collapsed');
        controls.classList.add('expanded');
        grantsManager.loadGrants().then(() => grantsManager.applyFilters());
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