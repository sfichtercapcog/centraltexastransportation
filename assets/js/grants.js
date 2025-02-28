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

// Sort grants alphabetically by Grant Name if available
function sortGrantsByGrantName(grants) {
    if (grants.length > 0 && 'Grant Name' in grants[0]) {
        return grants.sort((a, b) => (a['Grant Name'].S || '').localeCompare(b['Grant Name'].S || ''));
    }
    return grants; // Return unsorted if no Grant Name attribute
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
            let content = '<h3>' + (grant['Grant Name'] && grant['Grant Name'].S ? grant['Grant Name'].S : 'Untitled Grant') + '</h3>';

            // Dynamically add all attributes as rows, skipping grantId
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

// Search grants dynamically based on Grant Name
function searchGrants() {
    var searchTerm = document.getElementById('grantSearch').value.trim();
    
    // Dynamically determine searchable attributes (prioritize Grant Name)
    getTableAttributes((err, attributes) => {
        if (err) {
            console.error('Error getting table attributes:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
            return;
        }

        let filterExpression = 'contains(#grantName, :searchTerm)';
        let expressionAttributeNames = { '#grantName': 'Grant Name' }; // Use Grant Name for search
        let expressionAttributeValues = { ':searchTerm': { S: searchTerm } };

        // Fallback if Grant Name isn’t an attribute, try other string attributes
        if (!attributes.includes('Grant Name')) {
            filterExpression = 'contains(#anyAttr, :searchTerm)';
            const stringAttrs = attributes.filter(attr => attr !== 'grantId' && dynamodb.describeTable({ TableName: 'grants' }).Table.AttributeDefinitions.some(def => def.AttributeName === attr && def.AttributeType === 'S'));
            expressionAttributeNames = { '#anyAttr': stringAttrs[0] || 'grantId' }; // Fallback to first String attribute or grantId
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
                displayGrants(sortGrantsByGrantName(grantsData));
            }
        });
    });
}

// Load all grants on page load, sorted alphabetically by Grant Name
window.onload = function() {
    document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading grants...</p></div>';

    dynamodb.scan({ TableName: 'grants' }, function(err, data) {
        if (err) {
            console.error('Error querying DynamoDB:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants. Check console for details.</p></div>';
        } else {
            console.log('Initial scan results:', data); // Debug: Log initial data
            grantsData = data.Items || [];
            displayGrants(sortGrantsByGrantName(grantsData));
        }
    });
};