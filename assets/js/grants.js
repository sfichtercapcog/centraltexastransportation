AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: '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',
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
let allGrants = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

async function loadGrants() {
    const container = document.getElementById('grantsContainer');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const params = { TableName: 'grants' };
        const data = await dynamodb.scan(params).promise();
        allGrants = data.Items || [];
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

function displayGrants() {
    const container = document.getElementById('grantsContainer');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const fundingFilter = document.getElementById('fundingFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    let filteredGrants = allGrants.filter(grant => {
        const matchesSearch = (grant['Grant Name'] || '').toLowerCase().includes(searchTerm);
        const matchesType = !typeFilter || grant['Type of Grant'] === typeFilter;
        const matchesFunding = !fundingFilter || grant['Funding Source'] === fundingFilter;
        return matchesSearch && matchesType && matchesFunding;
    });

    filteredGrants.sort((a, b) => {
        if (sortBy === 'name') return (a['Grant Name'] || '').localeCompare(b['Grant Name'] || '');
        if (sortBy === 'deadline') {
            const dateA = new Date(a['Application Deadline'] || '9999-12-31');
            const dateB = new Date(b['Application Deadline'] || '9999-12-31');
            return dateA - dateB;
        }
        if (sortBy === 'funding') return (a['Funding Source'] || '').localeCompare(b['Funding Source'] || '');
        return 0;
    });

    container.innerHTML = '';
    if (filteredGrants.length === 0) {
        container.innerHTML = '<div class="grant-card"><p>No matching grants found.</p></div>';
    } else {
        const observer = new IntersectionObserver((entries, observer) => {
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
                <p><span class="tag ${grant['Type of Grant'].toLowerCase()}">${grant['Type of Grant'] || 'N/A'}</span></p>
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
        <p><em>Eligibility Checker Coming Soon!</em></p>
    `;
    modal.style.display = 'flex';
}

function copyGrantDetails() {
    const title = document.getElementById('modalTitle').textContent;
    const details = document.getElementById('modalDetails').innerText;
    navigator.clipboard.writeText(`${title}\n${details}`).then(() => alert('Details copied to clipboard!'));
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

// Add Esc key listener to close modal
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const modal = document.getElementById('grantModal');
        if (modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    }
});

document.getElementById('searchInput').addEventListener('input', displayGrants);
document.getElementById('typeFilter').addEventListener('change', displayGrants);
document.getElementById('fundingFilter').addEventListener('change', displayGrants);
document.getElementById('sortBy').addEventListener('change', displayGrants);

window.onload = async () => {
    await loadGrants();
};