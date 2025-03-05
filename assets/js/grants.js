// Global variables for managing application state
let allGrants = []; // Array of all grant objects loaded from grants.json
let attributes = []; // List of grant attributes for filtering and sorting
let filterConfig = {
    textSearch: '', // Search term entered by the user
    filters: {
        'Grant Type': [], // Selected grant types
        'Funding Source': [], // Selected funding sources
        'Target Award Amount': null, // Target award amount filter
        'Application Deadline': null, // Deadline date filter
        'Max Application Hours': null // Maximum application hours filter
    },
    sort: [
        { attr: 'Grant Name', direction: 'ascending' }, // Primary sort configuration
        { attr: null, direction: 'ascending' } // Secondary sort configuration
    ]
};
let favorites = []; // Array of grant IDs marked as favorites

// GrantsManager class to encapsulate application logic
class GrantsManager {
    constructor() {
        // Initialize DOM element references
        this.container = document.getElementById('grantsContainer');
        this.filterSummary = document.getElementById('filterSummary');
        // Load saved user preferences from local storage
        this.loadSavedData();
        // Set up event listeners once the DOM is fully loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.showInitialPrompt();
        });
    }

    // Displays the initial prompt modal to the user
    showInitialPrompt() {
        const prompt = document.getElementById('initialPrompt');
        if (prompt) {
            prompt.style.display = 'flex';
            prompt.querySelector('.modal-content').focus();
        }
    }

    // Asynchronously loads grant data from grants.json
    async loadGrants() {
        this.showLoading();
        try {
            const response = await fetch('/assets/json/grants.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allGrants = await response.json();
            if (!Array.isArray(allGrants) || !allGrants.length) throw new Error('No grants found in JSON file or invalid format');
            
            attributes = this.extractAttributes(allGrants[0]);
            this.setupFilterControls();
            this.updateSuggestions();
            this.displayGrants();
            this.startCountdowns();
            this.trackEvent('Grants Loaded', { count: allGrants.length });
        } catch (err) {
            console.error('Error loading grants:', err);
            this.showError(`Failed to load grants: ${err.message}. Please check grants.json and try again.`);
        }
    }

    // Extracts attribute keys from a sample grant object, excluding grantId
    extractAttributes(sampleGrant) {
        return Object.keys(sampleGrant).filter(k => k !== 'grantId');
    }

    // Displays a loading indicator in the grants container
    showLoading() {
        this.container.innerHTML = '<div class="loading">Loading Grants...</div>';
    }

    // Displays an error message with a retry option
    showError(message) {
        this.container.innerHTML = `<div class="grant-card error"><p>${message} <button onclick="grantsManager.loadGrants()">Retry</button></p></div>`;
    }

    // Initializes filter and sort controls with dynamic options
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

    // Populates filter dropdowns with unique values from grant data
    populateFilterOptions(selectId, attr) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const uniqueValues = [...new Set(allGrants.map(g => g[attr] || ''))].sort();
        select.innerHTML = uniqueValues.map(val => `<option value="${val}">${val || 'N/A'}</option>`).join('');
    }

    // Populates sort dropdowns with grant attributes
    populateSortOptions(selectId, selectedValue) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="">None</option>' + attributes.map(attr => 
            `<option value="${attr}" ${attr === selectedValue ? 'selected' : ''}>${attr}</option>`).join('');
    }

    // Updates search suggestions based on grant names
    updateSuggestions() {
        const datalist = document.getElementById('grantSuggestions');
        const suggestions = allGrants.map(g => g['Grant Name']).filter(Boolean);
        datalist.innerHTML = [...new Set(suggestions)].map(s => `<option value="${s}">`).join('');
    }

    // Applies saved filter values to the UI
    applySavedFilters() {
        document.getElementById('searchInput').value = filterConfig.textSearch;
        const typeSelect = document.getElementById('typeFilter');
        const fundingSelect = document.getElementById('fundingFilter');
        filterConfig.filters['Grant Type'].forEach(val => {
            const option = typeSelect.querySelector(`option[value="${val}"]`);
            if (option) option.selected = true;
        });
        filterConfig.filters['Funding Source'].forEach(val => {
            const option = fundingSelect.querySelector(`option[value="${val}"]`);
            if (option) option.selected = true;
        });
        document.getElementById('targetAward').value = filterConfig.filters['Target Award Amount'] || '';
        document.getElementById('deadline').value = filterConfig.filters['Application Deadline'] ? 
            filterConfig.filters['Application Deadline'].toISOString().split('T')[0] : '';
        document.getElementById('maxHours').value = filterConfig.filters['Max Application Hours'] || '';
    }

    // Applies user-defined filters and updates the display
    applyFilters() {
        const targetAward = document.getElementById('targetAward');
        const maxHours = document.getElementById('maxHours');
        if (targetAward.value && !targetAward.checkValidity()) {
            alert('Please enter a valid target award amount (positive number).');
            return;
        }
        if (maxHours.value && !maxHours.checkValidity()) {
            alert('Please enter a valid max application hours (positive number).');
            return;
        }

        filterConfig.textSearch = document.getElementById('searchInput')?.value.toLowerCase() || '';
        filterConfig.filters['Grant Type'] = Array.from(document.getElementById('typeFilter')?.selectedOptions || []).map(opt => opt.value);
        filterConfig.filters['Funding Source'] = Array.from(document.getElementById('fundingFilter')?.selectedOptions || []).map(opt => opt.value);
        filterConfig.filters['Target Award Amount'] = parseFloat(targetAward?.value) || null;
        filterConfig.filters['Application Deadline'] = this.parseDate(document.getElementById('deadline')?.value) || null;
        filterConfig.filters['Max Application Hours'] = parseFloat(maxHours?.value) || null;
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

    // Parses a date string into a Date object
    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    // Displays filtered and sorted grants in the UI
    displayGrants() {
        let filteredGrants = allGrants;
        if (document.getElementById('filterControls').style.display !== 'none') {
            filteredGrants = allGrants.filter(grant => {
                const textMatch = this.fuzzySearch(grant, filterConfig.textSearch);
                const typeMatch = !filterConfig.filters['Grant Type'].length || filterConfig.filters['Grant Type'].includes(grant['Type of Grant'] || '');
                const fundingMatch = !filterConfig.filters['Funding Source'].length || filterConfig.filters['Funding Source'].includes(grant['Funding Source'] || '');
                const awardMatch = !filterConfig.filters['Target Award Amount'] || 
                    (grant['Minimum Grant Award'] <= filterConfig.filters['Target Award Amount'] && 
                     grant['Maximum Grant Award'] >= filterConfig.filters['Target Award Amount']);
                const deadlineMatch = !filterConfig.filters['Application Deadline'] || 
                    (grant['Application Deadline'] === 'Rolling' || 
                     this.parseDate(grant['Application Deadline'])?.getTime() === filterConfig.filters['Application Deadline'].getTime());
                const hoursMatch = !filterConfig.filters['Max Application Hours'] || 
                    (grant['Estimated Application Hours'] || 0) <= filterConfig.filters['Max Application Hours'];
                return textMatch && typeMatch && fundingMatch && awardMatch && deadlineMatch && hoursMatch;
            });
        }

        filteredGrants.sort((a, b) => {
            for (let { attr, direction } of filterConfig.sort.filter(s => s.attr)) {
                const valA = attr === 'Application Deadline' && a[attr] === 'Rolling' ? '9999-12-31' : a[attr] || '';
                const valB = attr === 'Application Deadline' && b[attr] === 'Rolling' ? '9999-12-31' : b[attr] || '';
                let comparison = 0;
                if (attr === 'Application Deadline') {
                    comparison = (this.parseDate(valA)?.getTime() || new Date('9999-12-31').getTime()) - 
                                (this.parseDate(valB)?.getTime() || new Date('9999-12-31').getTime());
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

    // Performs fuzzy text search across grant attributes
    fuzzySearch(grant, term) {
        if (!term) return true;
        return attributes.some(attr => 
            (grant[attr] || '').toString().toLowerCase().includes(term));
    }

    // Creates HTML for a single grant card
    createGrantCard(grant) {
        const isFavorite = favorites.includes(grant.grantId);
        const deadlineClass = this.parseDate(grant['Application Deadline']) && 
            this.parseDate(grant['Application Deadline']) < new Date() ? 'passed' : '';
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

    // Updates the filter summary text based on current filters
    updateFilterSummary(count) {
        const summary = [];
        if (filterConfig.textSearch) summary.push(`Search: "${filterConfig.textSearch}"`);
        if (filterConfig.filters['Grant Type'].length) summary.push(`Types: ${filterConfig.filters['Grant Type'].join(', ')}`);
        if (filterConfig.filters['Funding Source'].length) summary.push(`Sources: ${filterConfig.filters['Funding Source'].join(', ')}`);
        if (filterConfig.filters['Target Award Amount']) summary.push(`Target Award: $${filterConfig.filters['Target Award Amount'].toLocaleString()}`);
        if (filterConfig.filters['Application Deadline']) summary.push(`Deadline: ${filterConfig.filters['Application Deadline'].toLocaleDateString()}`);
        if (filterConfig.filters['Max Application Hours']) summary.push(`Max Hours: Up to ${filterConfig.filters['Max Application Hours']}`);
        this.filterSummary.textContent = `Showing ${count} grants${summary.length ? ' | ' + summary.join(', ') : ''}`;
    }

    // Observes grant cards for lazy loading animations
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

    // Updates countdown timers for grant deadlines
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

    // Displays a modal with detailed grant information
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
            `<p><strong>${attr}:</strong> ${attr.includes('Award') && grant[attr] !== undefined ? `$${grant[attr].toLocaleString()}` : grant[attr] !== undefined ? grant[attr].toString() : 'N/A'}</p>`
        ).join('');
        document.getElementById('favoriteBtn').textContent = favorites.includes(grantId) ? 'Remove from Favorites' : 'Add to Favorites';
        modal.style.display = 'flex';
        modalContent.focus();
        this.trapFocus(modal);
    }

    // Traps keyboard focus within the modal
    trapFocus(modal) {
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    // Sets up event listeners for user interactions
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

    // Resets filters to default values
    resetFilters() {
        filterConfig = {
            textSearch: '',
            filters: {
                'Grant Type': [],
                'Funding Source': [],
                'Target Award Amount': null,
                'Application Deadline': null,
                'Max Application Hours': null
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

    // Saves filter configuration to local storage
    saveConfig() {
        try {
            localStorage.setItem('filterConfig', JSON.stringify(filterConfig));
        } catch (err) {
            console.error('Failed to save filter configuration:', err);
            alert('Could not save filter configuration.');
        }
    }

    // Loads saved data from local storage
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

    // Closes all open modals
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    }

    // Logs events for debugging or analytics
    trackEvent(eventName, properties) {
        console.log(`Event: ${eventName}`, properties);
    }
}

const grantsManager = new GrantsManager();

// Handles user choice from the initial prompt
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

// Closes a specified modal by ID
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Copies grant details to the clipboard
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

// Toggles a grant’s favorite status
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

// Toggles visibility of filter controls
function toggleFilters() {
    const controls = document.getElementById('filterControls');
    controls.classList.toggle('collapsed');
    controls.classList.toggle('expanded');
}