// Configure AWS SDK (replace with your actual credentials)
AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: 'hnrbhv/qcla0xlXhePxAvSXLRTugcM1NjoIv3o9S',
    region: 'us-east-1' // Match your DynamoDB region
});

const dynamodb = new AWS.DynamoDB();
let grantsData = [];

// Get unique values for an attribute
function getUniqueValues(attribute, callback) {
    const params = {
        TableName: 'grants',
        ProjectionExpression: attribute
    };
    dynamodb.scan(params, (err, data) => {
        if (err) {
            console.error(`Error scanning for ${attribute}:`, err);
            callback(err, null);
        } else {
            const values = [...new Set(data.Items.map(item => item[attribute]?.S).filter(val => val))];
            callback(null, values);
        }
    });
}

// Create filter inputs dynamically
function createFilterInputs() {
    const filterForm = document.getElementById('filterForm');
    filterForm.innerHTML = '';

    // Example attributes (replace with actual DynamoDB describeTable call if needed)
    const attributes = ['Grant Name', 'County', 'Status', 'amount']; // Adjust based on your table

    attributes.forEach(attr => {
        if (attr !== 'grantId') { // Skip partition key
            const label = document.createElement('label');
            label.textContent = `${attr.replace(/([A-Z])/g, ' $1').trim()}: `;
            filterForm.appendChild(label);

            if (attr === 'amount') {
                const minInput = document.createElement('input');
                minInput.type = 'number';
                minInput.placeholder = 'Min Amount';
                minInput.id = `min_${attr}`;
                filterForm.appendChild(minInput);

                const maxInput = document.createElement('input');
                maxInput.type = 'number';
                maxInput.placeholder = 'Max Amount';
                maxInput.id = `max_${attr}`;
                filterForm.appendChild(maxInput);
            } else {
                getUniqueValues(attr, (err, values) => {
                    if (err) return;
                    const select = document.createElement('select');
                    select.id = attr;
                    select.innerHTML = `<option value="">Select ${attr}</option>` + 
                                      values.map(val => `<option value="${val}">${val}</option>`).join('');
                    filterForm.appendChild(select);
                });
            }
            filterForm.appendChild(document.createElement('br'));
        }
    });
}

// Sort grants by Grant Name
function sortGrants(grants) {
    return grants.sort((a, b) => (a['Grant Name']?.S || '').localeCompare(b['Grant Name']?.S || ''));
}

// Display grants
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
        for (const key in grant) {
            if (key !== 'grantId') {
                const value = grant[key].S || (grant[key].N ? Number(grant[key].N).toLocaleString() : '');
                content += `<p>${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}</p>`;
            }
        }
        grantBox.innerHTML = content;
        container.appendChild(grantBox);
    });
}

// Search grants with filters
function searchGrants() {
    const filterInputs = document.querySelectorAll('#filterForm input, #filterForm select');
    const logicType = document.getElementById('logicType').value;
    let filterExpressions = [];
    let expressionAttributeNames = {};
    let expressionAttributeValues = {};

    filterInputs.forEach(input => {
        const attr = input.id.replace('min_', '').replace('max_', '');
        if (input.type === 'number' && input.value) {
            const operator = input.id.startsWith('min_') ? '>=' : '<=';
            const placeholder = input.id.startsWith('min_') ? 'min' : 'max';
            filterExpressions.push(`#${attr} ${operator} :${placeholder}_${attr}`);
            expressionAttributeNames[`#${attr}`] = attr;
            expressionAttributeValues[`:${placeholder}_${attr}`] = { N: input.value };
        } else if (input.type === 'select-one' && input.value) {
            filterExpressions.push(`#${attr} = :${attr}`);
            expressionAttributeNames[`#${attr}`] = attr;
            expressionAttributeValues[`:${attr}`] = { S: input.value };
        }
    });

    if (filterExpressions.length === 0) {
        loadAllGrants();
        return;
    }

    const params = {
        TableName: 'grants',
        FilterExpression: filterExpressions.join(` ${logicType} `),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
    };

    document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading...</p></div>';
    dynamodb.scan(params, (err, data) => {
        if (err) {
            console.error('Query error:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants.</p></div>';
        } else {
            grantsData = data.Items || [];
            displayGrants(sortGrants(grantsData));
        }
    });
}

// Load all grants
function loadAllGrants() {
    document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Loading...</p></div>';
    dynamodb.scan({ TableName: 'grants' }, (err, data) => {
        if (err) {
            console.error('Load error:', err);
            document.getElementById('grantsContainer').innerHTML = '<div class="grant-block"><p>Error loading grants.</p></div>';
        } else {
            grantsData = data.Items || [];
            displayGrants(sortGrants(grantsData));
        }
    });
}

// Clear search
function clearSearch() {
    document.querySelectorAll('#filterForm input, #filterForm select').forEach(input => {
        if (input.type === 'number') input.value = '';
        else if (input.type === 'select-one') input.selectedIndex = 0;
    });
    document.getElementById('logicType').value = 'AND';
    loadAllGrants();
}

// Initialize on page load
window.onload = () => {
    createFilterInputs();
    loadAllGrants();
};