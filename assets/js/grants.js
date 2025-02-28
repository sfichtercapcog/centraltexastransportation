// Configure AWS SDK (Replace 'YOUR_ACCESS_KEY_ID' and 'YOUR_SECRET_ACCESS_KEY' with your actual AWS credentials)
AWS.config.update({
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
    region: 'us-east-1' // Match your DynamoDB region
});

var dynamodb = new AWS.DynamoDB();
var grantsData = [];

// Sort grants alphabetically by name
function sortGrantsByName(grants) {
    return grants.sort((a, b) => a.name.S.localeCompare(b.name.S));
}

// Display grants in boxes
function displayGrants(grants) {
    const grantsContainer = document.getElementById('grantsContainer');
    grantsContainer.innerHTML = ''; // Clear current content

    if (grants.length === 0) {
        grantsContainer.innerHTML = '<div class="grant-block"><p>No grants found.</p></div>';
    } else {
        grants.forEach(function(grant) {
            var amount = parseInt(grant.amount.N || (grant.amount.S ? grant.amount.S : '0'));
            var grantBox = `
                <div class="grant-block">
                    <h3>${grant.name.S}</h3>
                    <p>Amount: $${amount.toLocaleString()}</p>
                    <p>Deadline: ${grant.deadline.S}</p>
                    <p>Eligibility: ${grant.eligibility.S}</p>
                    <p>${grant.description.S}</p>
                </div>
            `;
            grantsContainer.innerHTML += grantBox;
        });
    }
}

// Search grants by name
function searchGrants() {
    var searchTerm = document.getElementById('grantSearch').value.trim();
    var params = {
        TableName: 'grants',
        FilterExpression: 'contains(#name, :searchTerm)',
        ExpressionAttributeNames: {
            '#name': 'name'
        },
        ExpressionAttributeValues: {
            ':searchTerm': { S: searchTerm }
        }
    };

    document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading grants...</p></div>';

    dynamodb.scan(params, function(err, data) {
        if (err) {
            console.error('Error querying DynamoDB:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
        } else {
            grantsData = data.Items || [];
            displayGrants(sortGrantsByName(grantsData));
        }
    });
}

// Load all grants on page load, sorted alphabetically
window.onload = function() {
    var params = {
        TableName: 'grants'
    };

    document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading grants...</p></div>';

    dynamodb.scan(params, function(err, data) {
        if (err) {
            console.error('Error querying DynamoDB:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
        } else {
            grantsData = data.Items || [];
            displayGrants(sortGrantsByName(grantsData));
        }
    });
};