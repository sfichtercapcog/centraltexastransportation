AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: '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',
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
let allGrants = [];
let currentPage = 1;
const grantsPerPage = 8;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let chartInstance = null;

async function loadGrants() {
    const container = document.getElementById('grantsContainer');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const params = { TableName: 'grants' };
        const data = await dynamodb.scan(params).promise();
        allGrants = (data.Items || []).sort((a, b) => 
            (a['Grant Name'] || '').localeCompare(b['Grant Name'] || '')
        );
        displayGrants();
        renderChart();
    } catch (err) {
        console.error('Error loading grants:', err);
        container.innerHTML = `
            <div class="grant-card">
                <p>Error loading grants. <button onclick="loadGrants()">Retry</button></p>
            </div>`;
    }
}

function displayGrants() {
    const container = document.getElementById('grantsContainer');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const fundingFilter = document.getElementById('fundingFilter').value;
    const minAmount = parseInt(document.getElementById('minAmount').value) || 0;
    const maxAmount = parseInt(document.getElementById('maxAmount').value) || Infinity;

    const filteredGrants = allGrants.filter(grant => {
        const matchesSearch = (grant['Grant Name'] || '').toLowerCase().includes(searchTerm);
        const matchesType = !typeFilter || grant['Type of Grant'] === typeFilter;
        const matchesFunding = !fundingFilter || grant['Funding Source'] === fundingFilter;
        const matchesAmount = (grant['Minimum Grant Award'] || 0) >= minAmount && 
                             (grant['Maximum Grant Award'] || Infinity) <= maxAmount;
        return matchesSearch && matchesType && matchesFunding && matchesAmount;
    });

    const start = (currentPage - 1) * grantsPerPage;
    const end = start + grantsPerPage;
    const paginatedGrants = filteredGrants.slice(start, end);

    container.innerHTML = '';
    if (paginatedGrants.length === 0) {
        container.innerHTML = '<div class="grant-card"><p>No matching grants found.</p></div>';
    } else {
        paginatedGrants.forEach(grant => {
            const grantCard = document.createElement('div');
            grantCard.className = 'grant-card';
            grantCard.innerHTML = `
                <h3>${grant['Grant Name'] || 'Untitled'}</h3>
                <p><strong>Type:</strong> ${grant['Type of Grant'] || 'N/A'}</p>
                <p><strong>Funding:</strong> ${grant['Funding Source'] || 'N/A'}</p>
                <p><strong>Award Range:</strong> $${(grant['Minimum Grant Award'] || 0).toLocaleString()} - $${(grant['Maximum Grant Award'] || 0).toLocaleString()}</p>
                <p class="deadline"><strong>Deadline:</strong> ${grant['Application Deadline'] || 'N/A'}</p>
                <i class="fas fa-star favorite ${favorites.includes(grant.grantId) ? 'active' : ''}" data-id="${grant.grantId}"></i>
            `;
            grantCard.onclick = (e) => {
                if (e.target.classList.contains('favorite')) toggleFavorite(grant.grantId);
                else showGrantModal(grant);
            };
            container.appendChild(grantCard);
        });
    }
    updatePagination(filteredGrants.length);
}

function updatePagination(totalGrants) {
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const totalPages = Math.ceil(totalGrants / grantsPerPage);

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalGrants === 0;

    prevButton.onclick = () => { if (currentPage > 1) { currentPage--; displayGrants(); } };
    nextButton.onclick = () => { if (currentPage < totalPages) { currentPage++; displayGrants(); } };
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
    details.innerHTML = `
        <p><strong>Type:</strong> ${grant['Type of Grant'] || 'N/A'}</p>
        <p><strong>Funding Source:</strong> ${grant['Funding Source'] || 'N/A'}</p>
        <p><strong>Purpose:</strong> ${grant['Project Purpose'] || 'N/A'}</p>
        <p><strong>Eligible Entities:</strong> ${grant['Eligible Entities'] || 'N/A'}</p>
        <p><strong>Preferred Communities:</strong> ${grant['Preferred Communities'] || 'None'}</p>
        <p><strong>Award Range:</strong> $${(grant['Minimum Grant Award'] || 0).toLocaleString()} - $${(grant['Maximum Grant Award'] || 0).toLocaleString()}</p>
        <p><strong>Match Requirements:</strong> ${grant['Match Requirements'] * 100 || 0}%</p>
        <p><strong>In-Kind Allowed:</strong> ${grant['In-Kind Allowed'] || 'No'}</p>
        <p><strong>Shovel-Ready Required:</strong> ${grant['Shovel-Ready Required'] || 'No'}</p>
        <p><strong>Pre-Engineering Required:</strong> ${grant['Pre-Engineering Required'] || 'No'}</p>
        <p><strong>Deadline:</strong> ${grant['Application Deadline'] || 'N/A'}</p>
        <p><strong>Project Length:</strong> ${grant['Expected Project Length'] || 'N/A'}</p>
        <p><strong>Est. Application Hours:</strong> ${grant['Estimated Application Hours'] || 'N/A'}</p>
    `;
    modal.style.display = 'flex';
}

function renderChart() {
    const ctx = document.getElementById('grantChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const fundingSources = [...new Set(allGrants.map(g => g['Funding Source']))];
    const data = fundingSources.map(source => ({
        source,
        count: allGrants.filter(g => g['Funding Source'] === source).length
    }));

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.source),
            datasets: [{
                label: 'Number of Grants',
                data: data.map(d => d.count),
                backgroundColor: 'rgba(26, 188, 156, 0.7)',
                borderColor: 'rgba(26, 188, 156, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function exportToCSV() {
    const headers = Object.keys(allGrants[0] || {}).filter(k => k !== 'grantId');
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
        doc.text(`${i + 1}. ${grant['Grant Name']} ($${grant['Maximum Grant Award'].toLocaleString()})`, 10, y);
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
    document.querySelectorAll('.grant-card, .controls, .stats, .modal-content').forEach(el => {
        el.style.background = isDark ? '#333' : 'white';
        el.style.color = isDark ? '#ddd' : '#333';
    });
}

document.getElementById('searchInput').addEventListener('input', () => { currentPage = 1; displayGrants(); });
document.getElementById('typeFilter').addEventListener('change', () => { currentPage = 1; displayGrants(); });
document.getElementById('fundingFilter').addEventListener('change', () => { currentPage = 1; displayGrants(); });
document.getElementById('minAmount').addEventListener('input', () => { currentPage = 1; displayGrants(); });
document.getElementById('maxAmount').addEventListener('input', () => { currentPage = 1; displayGrants(); });

window.onload = async () => {
    await loadGrants();
};