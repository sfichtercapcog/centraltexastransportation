// Configure AWS SDK (Replace 'YOUR_ACCESS_KEY_ID' and 'YOUR_SECRET_ACCESS_KEY' with your actual AWS credentials)
AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: 'hnrbhv/qcla0xlXhePxAvSXLRTugcM1NjoIv3o9S',
    region: 'us-east-1' // Match your DynamoDB region
});

var dynamodb = new AWS.DynamoDB();
var grantsData = [];

// Dynamically get table description to discover attributes
function getTableAttributes(callback) {
    dynamodb.describeTable({ TableName: 'grants' }, function(err, data) {
        if (err) {
            console.error('Error describing table:', err);
            callback(err, null);
        } else {
            // Extract attribute definitions (simplified for this use case, assumes partition key is grantId)
            const attributeDefinitions = data.Table.AttributeDefinitions;
            const attributes = attributeDefinitions.map(attr => attr.AttributeName);
            callback(null, attributes);
        }
    });
}

// Sort grants alphabetically by name if available
function sortGrantsByName(grants) {
    if (grants.length > 0 && 'name' in grants[0]) {
        return grants.sort((a, b) => (a.name.S || '').localeCompare(b.name.S || ''));
    }
    return grants; // Return unsorted if no name attribute
}

// Dynamically display grants in boxes based on available attributes
function displayGrants(grants) {
    const grantsContainer = document.getElementById('grantsContainer');
    grantsContainer.innerHTML = ''; // Clear current content

    console.log('Grants data for display:', grants); // Debug: Log grants data

    if (grants.length === 0) {
        grantsContainer.innerHTML = '<div class="grant-block"><p>No grants found.</p></div>';
    } else {
        grants.forEach(function(grant) {
            const grantBox = document.createElement('div');
            grantBox.className = 'grant-block';
            let content = '<h3>' + (grant.name && grant.name.S ? grant.name.S : 'Untitled Grant') + '</h3>';

            // Dynamically add all attributes as rows
            for (let key in grant) {
                if (grant.hasOwnProperty(key) && key !== 'grantId') { // Skip partition key for display
                    let value = '';
                    if (grant[key].S) value = grant[key].S; // String
                    else if (grant[key].N) value = parseInt(grant[key].N).toLocaleString(); // Number with commas
                    else if (grant[key].B) value = grant[key].B.toString('base64'); // Binary, if any
                    else value = JSON.stringify(grant[key]); // Fallback for other types

                    content += `<p>${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}</p>`;
                }
            }

            grantBox.innerHTML = content;
            grantsContainer.appendChild(grantBox);
        });
    }
}

// Search grants dynamically based on discovered attributes
function searchGrants() {
    var searchTerm = document.getElementById('grantSearch').value.trim();
    
    // Dynamically determine searchable attributes (default to name if available)
    getTableAttributes((err, attributes) => {
        if (err) {
            console.error('Error getting table attributes:', err);
            return;
        }

        let filterExpression = 'contains(#searchAttr, :searchTerm)';
        let expressionAttributeNames = { '#searchAttr': 'name' }; // Default to name
        let expressionAttributeValues = { ':searchTerm': { S: searchTerm } };

        // If name isn’t an attribute, try others or use a generic scan
        if (!attributes.includes('name')) {
            filterExpression = 'contains(#anyAttr, :searchTerm)';
            expressionAttributeNames = { '#anyAttr': attributes[0] || 'grantId' }; // Fallback to first attribute or grantId
        }

        var params = {
            TableName: 'grants',
            FilterExpression: filterExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        };

        document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading grants...</p></div>';

        dynamodb.scan(params, function(err, data) {
            if (err) {
                console.error('Error querying DynamoDB:', err);
                document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
            } else {
                console.log('Scan results:', data); // Debug: Log DynamoDB response
                grantsData = data.Items || [];
                displayGrants(sortGrantsByName(grantsData));
            }
        });
    });
}

// Load all grants on page load, sorted alphabetically
window.onload = function() {
    document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading grants...</p></div>';

    dynamodb.scan({ TableName: 'grants' }, function(err, data) {
        if (err) {
            console.error('Error querying DynamoDB:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
        } else {
            console.log('Initial scan results:', data); // Debug: Log initial data
            grantsData = data.Items || [];
            displayGrants(sortGrantsByName(grantsData));
        }
    });
};