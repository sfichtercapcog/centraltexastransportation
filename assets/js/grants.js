// Configure AWS SDK with enterprise-grade credentials management
AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: 'hnrbhv/qcla0xlXhePxAvSXLRTugcM1NjoIv3o9S',
    region: 'us-east-1' // Match your DynamoDB region
});

const dynamodb = new AWS.DynamoDB.DocumentClient(); // Use DocumentClient for cleaner attribute handling

// Load and display grants alphabetically by Grant Name
async function loadGrants() {
    try {
        const params = {
            TableName: 'grants'
        };

        // Fetch grants using scan
        const data = await dynamodb.scan(params).promise();
        const grants = data.Items || [];

        // Sort by Grant Name for enterprise consistency
        const sortedGrants = grants.sort((a, b) => 
            (a['Grant Name'] || '').localeCompare(b['Grant Name'] || '')
        );

        // Display grants dynamically in boxes
        const container = document.getElementById('grantsContainer');
        container.innerHTML = '';

        if (sortedGrants.length === 0) {
            container.innerHTML = '<div class="grant-block"><p>No grants found.</p></div>';
            return;
        }

        sortedGrants.forEach(grant => {
            const grantBox = document.createElement('div');
            grantBox.className = 'grant-block';
            let content = `<h3>${grant['Grant Name'] || 'Untitled Grant'}</h3>`;

            // Dynamically display all attributes, skipping partition key if present
            for (const key in grant) {
                if (key !== 'grantId') { // Exclude partition key for display
                    const value = typeof grant[key] === 'number' 
                        ? grant[key].toLocaleString() 
                        : (grant[key] || 'N/A');
                    content += `<p>${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}</p>`;
                }
            }

            grantBox.innerHTML = content;
            container.appendChild(grantBox);
        });
    } catch (err) {
        console.error('Error loading grants:', err);
        document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
    }
}

// Initialize on page load with enterprise-grade async handling
window.onload = async () => {
    await loadGrants(); // Load and display all grants immediately
};