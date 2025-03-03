AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: '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',
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
let allGrants = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let attributes = [];
let filterAttrs = ['Grant Name', 'Type of Grant', 'Funding Source'];
let sortAttr = 'Grant Name';

async function loadGrants() {
    const container = document.getElementById('grantsContainer');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const params = { TableName: 'grants' };
        const data = await dynamodb.scan(params).promise();
        allGrants = data.Items || [];
        attributes = Object.keys(allGrants[0] || {}).filter(k => k !== 'grantId');
        setupCustomOptions();
        displayGrants();
        startCountdowns();
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
    const filter3 = document.getElementById('customFilter3');
    const sort = document.getElementById('customSort');
    
    [filter1, filter2, filter3, sort].forEach(select => {
        select.innerHTML = '<option value="">Select Attribute</option>' + 
            attributes.map(attr => `<option value="${attr}">${attr}</option>`).join('');
    });

    filter1.value = filterAttrs[0];
    filter2.value = filterAttrs[1];
    filter3.value = filterAttrs[2];
    sort.value = sortAttr;

    updateControls();
}

function updateControls() {
    const filter1 = document.getElementById('filter1');
    const filter2 = document.getElementById('filter2');
    const filter3 = document.getElementById('filter3');
    const sortBy = document.getElementById('sortBy');

    filter1.placeholder = `Search by ${filterAttrs[0]}`;
    filter1.value = '';

    const populateSelect = (select, attr) => {
        const uniqueValues = [...new Set(allGrants.map(g => g[attr] || ''))].sort();
        select.innerHTML = `<option value="">All ${attr}s</option>` + 
            uniqueValues.map(val => `<option value="${val}">${val || 'N/A'}</option>`).join('');
    };
    populateSelect(filter2, filterAttrs[1]);
    populateSelect(filter3, filterAttrs[2]);
    sortBy.innerHTML = attributes.map(attr => `<option value="${attr}">${attr}</option>`).join('');
    sortBy.value = sortAttr;
}

function displayGrants() {
    const container = document.getElementById('grantsContainer');
    const filter1Val = document.getElementById('filter1').value.toLowerCase();
    const filter2Val = document.getElementById('filter2').value;
    const filter3Val = document.getElementById('filter3').value;

    let filteredGrants = allGrants.filter(grant => {
        const attr1Match = (grant[filterAttrs[0]] || '').toString().toLowerCase().includes(filter1Val);
        const attr2Match = !filter2Val || (grant[filterAttrs[1]] || '') === filter2Val;
        const attr3Match = !filter3Val || (grant[filterAttrs[2]] || '') === filter3Val;
        return attr1Match && attr2Match && attr3Match;
    });

    filteredGrants.sort((a, b) => {
        const valA = a[sortAttr] || '';
        const valB = b[sortAttr] || '';
        if (sortAttr === 'Application Deadline') {
            return new Date(valA || '9999-12-31') - new Date(valB || '9999-12-31');
        }
        if (typeof valA === 'number') return valA - valB;
        return valA.toString().localeCompare(valB.toString());
    });

    container.innerHTML = '';
    if (filteredGrants.length === 0) {
        container.innerHTML = '<div class="grant-card"><p>No matching grants found.</p></div>';
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        filteredGrants.forEach(grant => {
            const grantCard = document.createElement('div');
            grantCard.className = 'grant-card';
            grantCard.style.opacity = '0';
            grantCard.style.transform = 'translateY(20px)';
            grantCard.innerHTML = `
                <h3>${grant['Grant Name'] || 'Untitled'}</h3>
                <p><span class="tag ${grant['Type of Grant']?.toLowerCase()}">${grant['Type of Grant'] || 'N/A'}</span></p>
                <p><strong>Funding:</strong> ${grant['Funding Source'] || 'N/A'}</p>
                <p><strong>Award Range:</strong> $${(grant['Minimum Grant Award'] || 0).toLocaleString()} - $${(grant['Maximum Grant Award'] || 0).toLocaleString()}</p>
                <p class="deadline"><strong>Deadline:</strong> ${grant['Application Deadline'] || 'N/A'}</p>
                <p class="countdown" data-deadline="${grant['Application Deadline']}"></p>
                <i class="fas fa-star favorite ${favorites.includes(grant.grantId) ? 'active' : ''}" data-id="${grant.grantId}"></i>
            `;
            grantCard.onclick = (e) => {
                if (e.target.classList.contains('favorite')) toggleFavorite(grant.grantId);
                else showGrantModal(grant);
            };
            container.appendChild(grantCard);
            observer.observe(grantCard);
        });
    }
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

function toggleFavorite(grantId) {
    const index = favorites.indexOf(grantId);
    if (index === -1) favorites.push(grantId);
    else favorites.splice(index, 1);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    displayGrants();
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
}

function saveCustomOptions() {
    filterAttrs = [
        document.getElementById('customFilter1').value,
        document.getElementById('customFilter2').value,
        document.getElementById('customFilter3').value
    ].filter(Boolean);
    sortAttr = document.getElementById('customSort').value || 'Grant Name';
    updateControls();
    displayGrants();
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

function downloadFile(filename, type, content) {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.querySelectorAll('.grant-card, .controls, .modal-content').forEach(el => {
        el.style.background = isDark ? '#333' : 'white';
        el.style.color = isDark ? '#ddd' : '#333';
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const grantModal = document.getElementById('grantModal');
        const customizeModal = document.getElementById('customizeModal');
        if (grantModal.style.display === 'flex') grantModal.style.display = 'none';
        if (customizeModal.style.display === 'flex') customizeModal.style.display = 'none';
    }
});

document.getElementById('filter1').addEventListener('input', displayGrants);
document.getElementById('filter2').addEventListener('change', displayGrants);
document.getElementById('filter3').addEventListener('change', displayGrants);
document.getElementById('sortBy').addEventListener('change', (e) => {
    sortAttr = e.target.value;
    displayGrants();
});

window.onload = async () => {
    await loadGrants();
};