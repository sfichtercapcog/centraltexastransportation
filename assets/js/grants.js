AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: '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',
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
let allGrants = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || {};
let attributes = [];
let filterAttrs = ['Type of Grant', 'Funding Source'];
let sortAttr = 'Grant Name';
let sortDirection = 'asc';
let loading = false;

async function loadGrants() {
    const container = document.getElementById('grantsContainer');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const params = { TableName: 'grants' };
        const data = await dynamodb.scan(params).promise();
        allGrants = data.Items || [];
        attributes = Object.keys(allGrants[0] || {}).filter(k => k !== 'grantId');
        setupCustomOptions();
        loadMoreGrants();
        startCountdowns();
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('input, select, button').forEach(el => {
                el.setAttribute('tabindex', '0');
            });
            document.getElementById('grantsContainer').setAttribute('role', 'region');
            document.getElementById('grantsContainer').setAttribute('aria-live', 'polite');
        });
    } catch (err) {
        console.error('Error loading grants:', err);
        container.innerHTML = `
            <div class="grant-card">
                <p>Error loading grants. <button onclick="loadGrants()">Retry</button></p>
            </div>`;
    }
}

function setupCustomOptions() {
    const filter1 = document.getElementById('customFilter1');
    const filter2 = document.getElementById('customFilter2');
    const sort = document.getElementById('customSort');
    
    [filter1, filter2, sort].forEach(select => {
        select.innerHTML = '<option value="">Select Attribute</option>' + 
            attributes.map(attr => `<option value="${attr}">${attr}</option>`).join('');
    });

    filter1.value = filterAttrs[0];
    filter2.value = filterAttrs[1];
    sort.value = sortAttr;

    updateControls();
}

function updateControls() {
    const filter1 = document.getElementById('filter1');
    const filter2 = document.getElementById('filter2');
    const sortBy = document.getElementById('sortBy');

    const populateSelect = (select, attr) => {
        const uniqueValues = [...new Set(allGrants.map(g => g[attr] || ''))].sort();
        select.innerHTML = `<option value="">All ${attr}s</option>` + 
            uniqueValues.map(val => `<option value="${val}">${val || 'N/A'}</option>`).join('');
    };
    populateSelect(filter1, filterAttrs[0]);
    populateSelect(filter2, filterAttrs[1]);
    sortBy.innerHTML = `<option value="">Sort By</option>` + 
        attributes.map(attr => `<option value="${attr}">${attr}</option>`).join('');
    sortBy.value = sortAttr;
}

function getFilteredGrants() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filter1Val = document.getElementById('filter1').value;
    const filter2Val = document.getElementById('filter2').value;

    return allGrants.filter(grant => {
        const nameMatch = (grant['Grant Name'] || '').toLowerCase().includes(searchTerm);
        const filter1Match = !filter1Val || (grant[filterAttrs[0]] || '') === filter1Val;
        const filter2Match = !filter2Val || (grant[filterAttrs[1]] || '') === filter2Val;
        return nameMatch && filter1Match && filter2Match;
    });
}

function loadMoreGrants(start = 0, batchSize = 20) {
    if (loading) return;
    loading = true;
    const container = document.getElementById('grantsContainer');
    const filteredGrants = getFilteredGrants().sort((a, b) => {
        const valA = a[sortAttr] || '';
        const valB = b[sortAttr] || '';
        let comparison = 0;
        if (sortAttr === 'Application Deadline') {
            comparison = new Date(valA || '9999-12-31') - new Date(valB || '9999-12-31');
        } else if (typeof valA === 'number') {
            comparison = valA - valB;
        } else {
            comparison = valA.toString().localeCompare(valB.toString());
        }
        return sortDirection === 'asc' ? comparison : -comparison;
    });
    const end = Math.min(start + batchSize, filteredGrants.length);
    filteredGrants.slice(start, end).forEach(grant => {
        const grantCard = createGrantCard(grant);
        container.appendChild(grantCard);
        new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 }).observe(grantCard);
    });
    loading = false;
    if (end < filteredGrants.length) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                observer.disconnect();
                loadMoreGrants(end, batchSize);
            }
        }, { threshold: 0.1 });
        observer.observe(container.lastChild || container);
    }
}

function createGrantCard(grant) {
    const card = document.createElement('div');
    card.className = 'grant-card';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.innerHTML = `
        <h3>${grant['Grant Name'] || 'Untitled'}</h3>
        <p><span class="tag ${grant['Type of Grant']?.toLowerCase()}">${grant['Type of Grant'] || 'N/A'}</span></p>
        <p><strong>Funding:</strong> ${grant['Funding Source'] || 'N/A'}</p>
        <p><strong>Award Range:</strong> $${(grant['Minimum Grant Award'] || 0).toLocaleString()} - $${(grant['Maximum Grant Award'] || 0).toLocaleString()}</p>
        <p class="deadline"><strong>Deadline:</strong> ${grant['Application Deadline'] || 'N/A'}</p>
        <p class="countdown" data-deadline="${grant['Application Deadline']}"></p>
        <i class="fas fa-star favorite ${favorites['default']?.includes(grant.grantId) ? 'active' : ''}" data-id="${grant.grantId}"></i>
        <select class="fav-category" onchange="toggleFavorite('${grant.grantId}', this.value)">
            <option value="default" ${favorites['default']?.includes(grant.grantId) ? 'selected' : ''}>Default</option>
            <option value="priority" ${favorites['priority']?.includes(grant.grantId) ? 'selected' : ''}>Priority</option>
            <option value="research" ${favorites['research']?.includes(grant.grantId) ? 'selected' : ''}>Research</option>
        </select>
    `;
    card.onclick = (e) => {
        if (e.target.classList.contains('favorite') || e.target.classList.contains('fav-category')) {
            const id = e.target.dataset.id || e.target.closest('.grant-card').querySelector('.favorite').dataset.id;
            const category = e.target.value || 'default';
            toggleFavorite(id, category);
        } else {
            showGrantModal(grant);
        }
    };
    return card;
}

function startCountdowns() {
    setInterval(() => {
        document.querySelectorAll('.countdown').forEach(el => {
            const deadline = el.getAttribute('data-deadline');
            if (!deadline || deadline === 'Rolling') {
                el.textContent = 'Rolling Deadline';
                return;
            }
            const timeLeft = new Date(deadline) - new Date();
            if (timeLeft <= 0) {
                el.textContent = 'Deadline Passed';
                el.style.color = '#e74c3c';
            } else {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                el.textContent = `Due in ${days}d ${hours}h`;
            }
        });
    }, 1000);
}

function toggleFavorite(grantId, category = 'default') {
    let favs = JSON.parse(localStorage.getItem('favorites')) || {};
    if (!favs[category]) favs[category] = [];
    const index = favs[category].indexOf(grantId);
    if (index === -1) favs[category].push(grantId);
    else favs[category].splice(index, 1);
    localStorage.setItem('favorites', JSON.stringify(favs));
    displayGrants(); // Update to reload cards with new favorite status
}

function showGrantModal(grant) {
    const modal = document.getElementById('grantModal');
    document.getElementById('modalTitle').textContent = grant['Grant Name'] || 'Untitled Grant';
    const details = document.getElementById('modalDetails');
    details.innerHTML = attributes.map(attr => `
        <p><strong>${attr}:</strong> ${grant[attr] !== undefined ? grant[attr].toLocaleString() : 'N/A'}</p>
    `).join('');
    modal.style.display = 'flex';
}

function copyGrantDetails() {
    const title = document.getElementById('modalTitle').textContent;
    const details = document.getElementById('modalDetails').innerText;
    navigator.clipboard.writeText(`${title}\n${details}`).then(() => alert('Details copied to clipboard!'));
}

function showCustomizeModal() {
    const modal = document.getElementById('customizeModal');
    modal.style.display = 'flex';
    const selectedAttrs = [filterAttrs[0], filterAttrs[1], sortAttr];
    const selects = [document.getElementById('customFilter1'), document.getElementById('customFilter2'), document.getElementById('customSort')];
    
    selects.forEach(select => {
        const options = select.getElementsByTagName('option');
        for (let option of options) {
            option.classList.remove('selected');
            if (selectedAttrs.includes(option.value)) {
                option.classList.add('selected');
            }
        }
    });
}

function saveCustomOptions() {
    const filter1 = document.getElementById('customFilter1').value;
    const filter2 = document.getElementById('customFilter2').value;
    const sort = document.getElementById('customSort').value;

    // Ensure no duplicates
    const newAttrs = [filter1, filter2, sort].filter(Boolean);
    const uniqueAttrs = [...new Set(newAttrs)];
    if (uniqueAttrs.length !== newAttrs.length) {
        alert('Each attribute can only be used once for filters or sorts.');
        return;
    }

    filterAttrs = [filter1, filter2].filter(Boolean) || ['Type of Grant', 'Funding Source'];
    sortAttr = sort || 'Grant Name';
    updateControls();
    loadMoreGrants(); // Use infinite scroll to reload
    document.getElementById('customizeModal').style.display = 'none';
}

function exportToCSV() {
    const headers = attributes;
    const csv = [headers.join(','), ...allGrants.map(g => 
        headers.map(k => `"${(g[k] || '').toString().replace(/"/g, '""')}"`).join(',')
    )].join('\n');
    downloadFile('grants.csv', 'text/csv', csv);
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Grants Nexus Report', 10, 10);
    let y = 20;
    allGrants.forEach((grant, i) => {
        if (y > 270) { doc.addPage(); y = 10; }
        doc.setFontSize(12);
        doc.text(`${i + 1}. ${grant['Grant Name']} (${grant['Funding Source']}) - Due: ${grant['Application Deadline']}`, 10, y);
        y += 10;
    });
    doc.save('grants.pdf');
}

function exportToExcel() {
    const headers = attributes;
    const data = allGrants.map(g => headers.map(k => g[k] || ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grants');
    XLSX.writeFile(wb, 'grants.xlsx');
}

function exportToJSON() {
    const json = JSON.stringify(allGrants, null, 2);
    downloadFile('grants.json', 'application/json', json);
}

function downloadFile(filename, type, content) {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function toggleTheme() {
    const themes = ['light', 'dark', 'high-contrast'];
    let currentTheme = document.body.classList[0] || 'light';
    const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
    document.body.classList.remove(...themes);
    document.body.classList.add(nextTheme);
    document.querySelectorAll('.grant-card, .controls, .modal-content').forEach(el => {
        el.style.background = nextTheme === 'high-contrast' ? '#000' : (nextTheme === 'dark' ? '#333' : 'white');
        el.style.color = nextTheme === 'high-contrast' ? '#fff' : (nextTheme === 'dark' ? '#ddd' : '#333');
    });
    localStorage.setItem('theme', nextTheme);
}

function initMap() {
    const map = L.map('map').setView([30.2672, -97.7431], 10); // Central Texas
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
    allGrants.forEach(grant => {
        if (grant['Eligible Entities']?.includes('Counties')) {
            L.marker([30.2672, -97.7431]).addTo(map) // Placeholder coords
                .bindPopup(`<b>${grant['Grant Name']}</b><br>${grant['Project Purpose']}`);
        }
    });
}

function toggleMap() {
    const map = document.getElementById('map');
    map.style.display = map.style.display === 'none' ? 'block' : 'none';
    if (map.style.display === 'block' && !map._leaflet) initMap();
}

document.querySelectorAll('#filter1, #filter2').forEach(select => {
    select.addEventListener('change', () => {
        const value = select.value;
        const attr = filterAttrs[select.id === 'filter1' ? 0 : 1];
        const preview = document.createElement('div');
        preview.className = 'filter-preview';
        preview.textContent = `${attr}: ${value || 'All'}`;
        preview.style.cssText = `
            position: absolute;
            background: var(--primary);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 100;
            animation: fadeIn 0.3s ease-out;
        `;
        select.parentNode.appendChild(preview);
        setTimeout(() => preview.remove(), 2000);
    });
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const suggestions = allGrants.filter(g => (g['Grant Name'] || '').toLowerCase().includes(searchTerm))
        .map(g => g['Grant Name']).slice(0, 5);
    const datalist = document.getElementById('grantSuggestions') || createSuggestionsList(suggestions);
    datalist.innerHTML = suggestions.map(name => `<option value="${name}">`).join('');
});

function createSuggestionsList(suggestions) {
    const datalist = document.createElement('datalist');
    datalist.id = 'grantSuggestions';
    document.getElementById('searchInput').setAttribute('list', 'grantSuggestions');
    document.body.appendChild(datalist);
    return datalist;
}

document.getElementById('sortBy').addEventListener('change', (e) => {
    sortAttr = e.target.value;
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    document.getElementById('sortBy').dataset.direction = sortDirection;
    loadMoreGrants();
});

window.onload = async () => {
    await loadGrants();
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(savedTheme);
    toggleTheme(); // Apply saved theme
};