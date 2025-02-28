// Configure AWS SDK (Replace 'YOUR_ACCESS_KEY_ID' and 'YOUR_SECRET_ACCESS_KEY' with your actual AWS credentials)
AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: 'hnrbhv/qcla0xlXhePxAvSXLRTugcM1NjoIv3o9S',
    region: 'us-east-1' // Match your DynamoDB region
});

var dynamodb = new AWS.DynamoDB();

function searchGrants() {
    var searchTerm = document.getElementById('grantSearch').value.trim();
    var params = {
        TableName: 'GrantsDB',
        FilterExpression: 'contains(#name, :searchTerm)',
        ExpressionAttributeNames: {
            '#name': 'name'
        },
        ExpressionAttributeValues: {
            ':searchTerm': { S: searchTerm }
        }
    };

    // Show loading message
    var grantsContainer = document.getElementById('grantsContainer');
    grantsContainer.innerHTML = '<div class="grant-block"><p>Loading grants...</p></div>';

    dynamodb.scan(params, function(err, data) {
        if (err) {
            console.error('Error querying DynamoDB:', err);
            grantsContainer.innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
        } else {
            grantsContainer.innerHTML = ''; // Clear loading message
            if (data.Items.length === 0) {
                grantsContainer.innerHTML = '<div class="grant-block"><p>No grants found.</p></div>';
            } else {
                data.Items.forEach(function(item) {
                    var grant = `
                        <div class="grant-block">
                            <h3>${item.name.S}</h3>
                            <p class="amount">Amount: $${item.amount.N}</p>
                            <p class="deadline">Deadline: ${item.deadline.S}</p>
                            <p>Eligibility: ${item.eligibility.S}</p>
                            <p>${item.description.S}</p>
                        </div>
                    `;
                    grantsContainer.innerHTML += grant;
                });
            }
        }
    });
}

// Load all grants on page load
window.onload = function() {
    searchGrants(); // Initial load of all grants
};