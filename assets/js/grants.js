// Configure AWS SDK (Replace 'YOUR_ACCESS_KEY_ID' and 'YOUR_SECRET_ACCESS_KEY' with your actual AWS credentials)
AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: 'hnrbhv/qcla0xlXhePxAvSXLRTugcM1NjoIv3o9S',
    region: 'us-east-1' // Match your DynamoDB region
});

const dynamodb = new AWS.DynamoDB();
let grantsData = [];
let tableAttributes = [];

// Dynamically get table attributes
function getTableAttributes(callback) {
    dynamodb.describeTable({ TableName: 'grants' }, (err, data) => {
        if (err) {
            console.error('Error describing table:', err);
            callback(err, null);
        } else {
            tableAttributes = data.Table.AttributeDefinitions.map(attr => attr.AttributeName).filter(attr => attr !== 'grantId' && attr !== 'Minimum Grant Award' && attr !== 'Maximum Grant Award');
            callback(null, tableAttributes);
        }
    });
}

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

    // Add numerical inputs for Minimum and Maximum Grant Award
    const amountDiv = document.createElement('div');
    amountDiv.className = 'filter-row';
    const amountLabel = document.createElement('label');
    amountLabel.textContent = 'Grant Amount Range: ';
    amountDiv.appendChild(amountLabel);

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.placeholder = 'Minimum Grant Award';
    minInput.id = 'min_amount';
    amountDiv.appendChild(minInput);

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.placeholder = 'Maximum Grant Award';
    maxInput.id = 'max_amount';
    amountDiv.appendChild(maxInput);
    filterForm.appendChild(amountDiv);

    // Dynamically create dropdowns for other attributes
    getTableAttributes((err, attrs) => {
        if (err) return;
        
        attrs.forEach(attr => {
            const div = document.createElement('div');
            div.className = 'filter-row';
            
            const label = document.createElement('label');
            label.textContent = `${attr.replace(/([A-Z])/g, ' $1').trim()}: `;
            div.appendChild(label);

            getUniqueValues(attr, (err, values) => {
                if (err) return;
                const select = document.createElement('select');
                select.id = attr;
                select.innerHTML = `<option value="">Any</option>` + 
                                  values.map(val => `<option value="${val}">${val}</option>`).join('');
                div.appendChild(select);
            });
            filterForm.appendChild(div);
        });
    });
}

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
    const filterInputs = document.querySelectorAll('#filterForm select, #filterForm input[type="number"]');
    const logicType = document.getElementById('logicType').value;
    let filterExpressions = [];
    let expressionAttributeNames = {};
    let expressionAttributeValues = {};

    filterInputs.forEach(input => {
        const attr = input.id;
        if (input.type === 'number' && input.value) {
            if (attr === 'min_amount') {
                filterExpressions.push('#amount >= :min_amount');
                expressionAttributeNames['#amount'] = 'amount';
                expressionAttributeValues[':min_amount'] = { N: input.value };
            } else if (attr === 'max_amount') {
                filterExpressions.push('#amount <= :max_amount');
                expressionAttributeNames['#amount'] = 'amount';
                expressionAttributeValues[':max_amount'] = { N: input.value };
            }
        } else if (input.type === 'select-one' && input.value && input.value !== '') {
            filterExpressions.push(`#${attr} = :${attr}`);
            expressionAttributeNames[`#${attr}`] = attr;
            expressionAttributeValues[`:${attr}`] = { S: input.value };
        }
    });

    if (filterExpressions.length === 0) {
        document.getElementById('grantsContainer').innerHTML = ''; // No grants displayed by default
        return;
    }

    // Ensure amount is filtered between min and max if both are provided
    if (document.getElementById('min_amount').value && document.getElementById('max_amount').value) {
        filterExpressions = filterExpressions.filter(expr => !expr.includes('#amount'));
        filterExpressions.push('#amount BETWEEN :min_amount AND :max_amount');
        expressionAttributeNames['#amount'] = 'amount';
        expressionAttributeValues[':min_amount'] = { N: document.getElementById('min_amount').value };
        expressionAttributeValues[':max_amount'] = { N: document.getElementById('max_amount').value };
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

// Clear search and hide grants
function clearSearch() {
    document.querySelectorAll('#filterForm input, #filterForm select').forEach(input => {
        if (input.type === 'number') input.value = '';
        else if (input.type === 'select-one') input.selectedIndex = 0;
    });
    document.getElementById('logicType').value = 'AND';
    document.getElementById('grantsContainer').innerHTML = ''; // Ensure no grants show after clearing
}

// Initialize on page load
window.onload = () => {
    createFilterInputs();
    document.getElementById('grantsContainer').innerHTML = ''; // No grants displayed by default
};