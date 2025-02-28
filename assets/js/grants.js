// Configure AWS SDK (Replace 'YOUR_ACCESS_KEY_ID' and 'YOUR_SECRET_ACCESS_KEY' with your actual AWS credentials)
AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: 'hnrbhv/qcla0xlXhePxAvSXLRTugcM1NjoIv3o9S',
    region: 'us-east-1' // Match your DynamoDB region
});

const dynamodb = new AWS.DynamoDB();

// Hardcoded attributes for display (all fields you provided)
const ATTRIBUTES = [
    'Grant Name',
    'Type of Grant',
    'Funding Source',
    'Project Purpose',
    'Eligible Entities',
    'Preferred Communities',
    'Minimum Grant Award',
    'Maximum Grant Award',
    'Match Requirements',
    'In-Kind Allowed',
    'Shovel-Ready Required',
    'Pre-Engineering Required',
    'Application Deadline',
    'Expected Project Length',
    'Estimated Application Hours'
];

// Sort grants by Grant Name
function sortGrants(grants) {
    return grants.sort((a, b) => (a['Grant Name']?.S || '').localeCompare(b['Grant Name']?.S || ''));
}

// Display grants in boxes
function displayGrants(grants) {
    const container = document.getElementById('grantsContainer');
    container.innerHTML = '';

    if (grants.length === 0) {
        container.innerHTML = '<div class="grant-block"><p>No grants found.</p></div>';
        return;
    }

    grants.forEach(grant => {
        const grantBox = document.createElement('div');
        grantBox.className = 'grant-block';
        let content = `<h3>${grant['Grant Name']?.S || 'Untitled Grant'}</h3>`;
        ATTRIBUTES.forEach(attr => {
            const value = grant[attr]?.S || (grant[attr]?.N ? Number(grant[attr].N).toLocaleString() : 'N/A');
            content += `<p>${attr}: ${value}</p>`;
        });
        grantBox.innerHTML = content;
        container.appendChild(grantBox);
    });
}

// Load and display all grants on page load
window.onload = function() {
    const params = {
        TableName: 'grants'
    };

    document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading grants...</p></div>';

    dynamodb.scan(params, function(err, data) {
        if (err) {
            console.error('Error querying DynamoDB:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
        } else {
            grantsData = data.Items || [];
            displayGrants(sortGrants(grantsData));
        }
    });
};