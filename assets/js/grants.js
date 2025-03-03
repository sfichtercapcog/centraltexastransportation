// Secure AWS configuration using environment variables or AWS Amplify config
AWS.config.update({
    region: 'us-east-1',
    credentials: new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'us-east-1:YOUR_COGNITO_IDENTITY_POOL_ID' // Replace with your Cognito Identity Pool ID
    })
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
let allGrants = [];
let attributes = [];
let filterAttrs = ['Type of Grant', 'Funding Source'];
let sortAttr = 'Grant Name';
let sortDirection = 'asc';
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

class GrantsManager {
    constructor() {
        this.container = document.getElementById('grantsContainer');
        this.setupEventListeners();
    }

    async loadGrants() {
        this.showLoading();
        try {
            const params = { TableName: 'grants' };
            const data = await this.scanDynamoDB(params);
            allGrants = data.Items || [];
            attributes = this.extractAttributes(allGrants[0] || {});
            this.setupCustomOptions();
            this.displayGrants();
            this.startCountdowns();
            this.trackEvent('Grants Loaded', { count: allGrants.length });
        } catch (err) {
            console.error('Error loading grants:', err);
            this.showError('Failed to load grants. Please try again.');
        }
    }

    async scanDynamoDB(params) {
        let items = [];
        let lastEvaluatedKey = null;
        do {
            const response = await dynamodb.scan({
                ...params,
                ExclusiveStartKey: lastEvaluatedKey
            }).promise();
            items = items.concat(response.Items);
            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        return { Items: items };
    }

    extractAttributes(sampleGrant) {
        return Object.keys(sampleGrant).filter(k => k !== 'grantId');
    }

    showLoading() {
        this.container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading Grants...</div>';
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="grant-card error">
                <p>${message} <button onclick="grantsManager.loadGrants()">Retry</button></p>
            </div>`;
    }

    setupCustomOptions() {
        const selects = ['customFilter1', 'customFilter2', 'customSort'].map(id => document.getElementById(id));
        selects.forEach(select => {
            select.innerHTML = '<option value="">Select Attribute</option>' +
                attributes.map(attr => `<option value="${attr}">${attr}</option>`).join('');
        });
        document.getElementById('customFilter1').value = filterAttrs[0];
        document.getElementById('customFilter2').value = filterAttrs[1];
        document.getElementById('customSort').value = sortAttr;
        this.updateControls();
    }

    updateControls() {
        ['filter1', 'filter2'].forEach((id, idx) => {
            const select = document.getElementById(id);
            const uniqueValues = [...new Set(allGrants.map(g => g[filterAttrs[idx]] || ''))].sort();
            select.innerHTML = `<option value="">All ${filterAttrs[idx]}s</option>` +
                uniqueValues.map(val => `<option value="${val}">${val || 'N/A'}</option>`).join('');
        });
        const sortBy = document.getElementById('sortBy');
        sortBy.innerHTML = '<option value="">Sort By</option>' +
            attributes.map(attr => `<option value="${attr}">${attr}</option>`).join('');
        sortBy.value = sortAttr;
    }

    displayGrants() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const filter1Val = document.getElementById('filter1').value;
        const filter2Val = document.getElementById('filter2').value;

        let filteredGrants = allGrants.filter(grant => {
            const nameMatch = (grant['Grant Name'] || '').toLowerCase().includes(searchTerm);
            const filter1Match = !filter1Val || (grant[filterAttrs[0]] || '') === filter1Val;
            const filter2Match = !filter2Val || (grant[filterAttrs[1]] || '') === filter2Val;
            return nameMatch && filter1Match && filter2Match;
        });

        filteredGrants.sort((a, b) => {
            const valA = a[sortAttr] || '';
            const valB = b[sortAttr] || '';
            let comparison = typeof valA === 'number' ?
                valA - valB :
                valA.toString().localeCompare(valB.toString());
            if (sortAttr === 'Application Deadline') {
                comparison = new Date(valA || '9999-12-31') - new Date(valB || '9999-12-31');
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        this.container.innerHTML = filteredGrants.length === 0 ?
            '<div class="grant-card"><p>No grants match your criteria.</p></div>' :
            filteredGrants.map(grant => this.createGrantCard(grant)).join('');

        this.observeCards();
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
                const timeLeft = new Date(deadline) - new Date();
                el.textContent = timeLeft <= 0 ?
                    'Deadline Passed' :
                    `Due in ${Math.floor(timeLeft / (1000 * 60 * 60 * 24))}d ${Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h`;
                el.style.color = timeLeft <= 0 ? '#e74c3c' : '#f39c12';
            });
        }, 1000);
    }

    showGrantModal(grantId) {
        const grant = allGrants.find(g => g.grantId === grantId);
        if (!grant) return;
        document.getElementById('modalTitle').textContent = grant['Grant Name'] || 'Untitled';
        document.getElementById('modalDetails').innerHTML = attributes.map(attr =>
            `<p><strong>${attr}:</strong> ${grant[attr] !== undefined ? grant[attr].toLocaleString() : 'N/A'}</p>`
        ).join('');
        document.getElementById('favoriteBtn').textContent = favorites.includes(grantId) ? 'Remove from Favorites' : 'Add to Favorites';
        document.getElementById('favoriteBtn').onclick = () => toggleFavorite(grantId);
        document.getElementById('grantModal').style.display = 'flex';
    }

    setupEventListeners() {
        document.getElementById('searchInput').addEventListener('input', () => this.handleSearch());
        ['filter1', 'filter2', 'sortBy'].forEach(id =>
            document.getElementById(id).addEventListener('change', () => this.displayGrants())
        );
        document.getElementById('sortBy').addEventListener('change', (e) => {
            sortAttr = e.target.value;
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            e.target.dataset.direction = sortDirection;
            this.displayGrants();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }

    handleSearch() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const suggestions = allGrants.filter(g => (g['Grant Name'] || '').toLowerCase().includes(searchTerm))
            .map(g => g['Grant Name']).slice(0, 5);
        document.getElementById('grantSuggestions').innerHTML = suggestions.map(name => `<option value="${name}">`).join('');
        this.displayGrants();
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    }

    trackEvent(eventName, properties) {
        // Placeholder for analytics tracking (e.g., using AWS Pinpoint or a custom solution)
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
    localStorage.setItem('theme', nextTheme);
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function copyGrantDetails() {
    const title = document.getElementById('modalTitle').textContent;
    const details = document.getElementById('modalDetails').innerText;
    navigator.clipboard.writeText(`${title}\n${details}`).then(() =>
        alert('Grant details copied to clipboard!')
    );
}

function toggleFavorite(grantId) {
    if (!grantId) grantId = document.querySelector('#grantModal .modal-content').dataset.grantId;
    const index = favorites.indexOf(grantId);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(grantId);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    grantsManager.displayGrants();
    if (document.getElementById('grantModal').style.display === 'flex') {
        document.getElementById('favoriteBtn').textContent = favorites.includes(grantId) ? 'Remove from Favorites' : 'Add to Favorites';
    }
}

function showCustomizeModal() {
    document.getElementById('customizeModal').style.display = 'flex';
}

function saveCustomOptions() {
    const filter1 = document.getElementById('customFilter1').value;
    const filter2 = document.getElementById('customFilter2').value;
    const sort = document.getElementById('customSort').value;
    const newAttrs = [filter1, filter2, sort].filter(Boolean);
    if (new Set(newAttrs).size !== newAttrs.length) {
        alert('Attributes must be unique across filters and sort.');
        return;
    }
    filterAttrs = [filter1 || 'Type of Grant', filter2 || 'Funding Source'];
    sortAttr = sort || 'Grant Name';
    grantsManager.updateControls();
    grantsManager.displayGrants();
    closeModal('customizeModal');
}

function resetCustomOptions() {
    filterAttrs = ['Type of Grant', 'Funding Source'];
    sortAttr = 'Grant Name';
    grantsManager.setupCustomOptions();
    grantsManager.displayGrants();
    closeModal('customizeModal');
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const filteredGrants = Array.from(document.querySelectorAll('.grant-card')).map(card => ({
        name: card.querySelector('h3').textContent,
        type: card.querySelector('.tag').textContent,
        funding: card.querySelector('p:nth-child(3)').textContent.replace('Funding: ', ''),
        award: card.querySelector('p:nth-child(4)').textContent.replace('Award: ', ''),
        deadline: card.querySelector('.deadline').textContent.replace('Deadline: ', '')
    }));
    doc.setFontSize(16);
    doc.text('Grants Nexus Report', 10, 10);
    filteredGrants.forEach((grant, i) => {
        const y = 20 + i * 40;
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