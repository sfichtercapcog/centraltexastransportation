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

    // Add single numerical input for Grant Award
    const awardDiv = document.createElement('div');
    awardDiv.className = 'filter-row';
    const awardLabel = document.createElement('label');
    awardLabel.textContent = 'Grant Award: ';
    awardDiv.appendChild(awardLabel);

    const awardInput = document.createElement('input');
    awardInput.type = 'number';
    awardInput.placeholder = 'Enter Grant Award Amount';
    awardInput.id = 'grant_award';
    awardDiv.appendChild(awardInput);
    filterForm.appendChild(awardDiv);

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

// Search grants with filters (AND logic only)
function searchGrants() {
    const filterInputs = document.querySelectorAll('#filterForm select, #filterForm input[type="number"]');
    let filterExpressions = [];
    let expressionAttributeNames = {};
    let expressionAttributeValues = {};

    filterInputs.forEach(input => {
        const attr = input.id;
        if (input.type === 'number' && input.value) {
            const awardValue = parseInt(input.value);
            filterExpressions.push('#amount BETWEEN :min_award AND :max_award');
            expressionAttributeNames['#amount'] = 'amount';
            expressionAttributeValues[':min_award'] = { N: grant['Minimum Grant Award']?.N || '0' }; // Use actual min from DB
            expressionAttributeValues[':max_award'] = { N: grant['Maximum Grant Award']?.N || '999999999' }; // Use actual max from DB
        } else if (input.type === 'select-one' && input.value && input.value !== '') {
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
        FilterExpression: filterExpressions.join(' AND '), // Use AND logic only
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

// Load all grants initially
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

// Clear search and reload all grants
function clearSearch() {
    document.querySelectorAll('#filterForm input, #filterForm select').forEach(input => {
        if (input.type === 'number') input.value = '';
        else if (input.type === 'select-one') input.selectedIndex = 0;
    });
    loadAllGrants();
}

// Initialize on page load
window.onload = () => {
    createFilterInputs();
    loadAllGrants(); // Display all grants by default
};