// Configure AWS SDK (Replace 'YOUR_ACCESS_KEY_ID' and 'YOUR_SECRET_ACCESS_KEY' with your actual AWS credentials)
AWS.config.update({
    accessKeyId: 'AKIAVA5YK7KISYJY3ZOL',
    secretAccessKey: 'hnrbhv/qcla0xlXhePxAvSXLRTugcM1NjoIv3o9S',
    region: 'us-east-1' // Match your DynamoDB region
});

var dynamodb = new AWS.DynamoDB();
var currentIndex = 0;
var grantsData = [];

// Carousel navigation
function nextSlide() {
    currentIndex = (currentIndex + 1) % grantsData.length;
    updateCarousel();
}

function prevSlide() {
    currentIndex = (currentIndex - 1 + grantsData.length) % grantsData.length;
    updateCarousel();
}

// Update carousel display
function updateCarousel() {
    const carousel = document.getElementById('grantCarousel');
    carousel.innerHTML = ''; // Clear current slides
    const grant = grantsData[currentIndex];
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.innerHTML = `
        <h3>${grant.name.S}</h3>
        <p>Amount: $${parseInt(grant.amount.N || (grant.amount.S ? grant.amount.S : '0')).toLocaleString()}</p>
        <p>Deadline: ${grant.deadline.S}</p>
        <button onclick="showModal(${currentIndex})">View Details</button>
    `;
    carousel.appendChild(slide);

    // Add navigation buttons
    const nav = document.createElement('div');
    nav.className = 'carousel-nav';
    nav.innerHTML = `
        <button onclick="prevSlide()" class="nav-button">&lt; Previous</button>
        <button onclick="nextSlide()" class="nav-button">Next &gt;</button>
    `;
    carousel.appendChild(nav);
}

// Search grants
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

    document.getElementById('grantCarousel').innerHTML = '<p>Loading grants...</p>';

    dynamodb.scan(params, function(err, data) {
        if (err) {
            console.error('Error querying DynamoDB:', err);
            document.getElementById('grantCarousel').innerHTML = '<p>Error loading grants. Check console for details.</p>';
        } else {
            grantsData = data.Items || [];
            if (grantsData.length === 0) {
                document.getElementById('grantCarousel').innerHTML = '<p>No grants found.</p>';
            } else {
                currentIndex = 0;
                updateCarousel();
            }
        }
    });
}

// Show modal with grant details
function showModal(index) {
    const grant = grantsData[index];
    document.getElementById('modalTitle').textContent = grant.name.S;
    document.getElementById('modalAmount').textContent = `Amount: $${parseInt(grant.amount.N || (grant.amount.S ? grant.amount.S : '0')).toLocaleString()}`;
    document.getElementById('modalDeadline').textContent = `Deadline: ${grant.deadline.S}`;
    document.getElementById('modalEligibility').textContent = `Eligibility: ${grant.eligibility.S}`;
    document.getElementById('modalDescription').textContent = grant.description.S;
    document.getElementById('grantModal').style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('grantModal').style.display = 'none';
}

// Load all grants on page load
window.onload = function() {
    searchGrants(); // Initial load of all grants

    // Add touch support for carousel (mobile-friendly)
    const carousel = document.getElementById('grantCarousel');
    let touchStartX = 0;
    carousel.addEventListener('touchstart', (e) => touchStartX = e.changedTouches[0].screenX);
    carousel.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) nextSlide(); // Swipe left
        if (touchEndX - touchStartX > 50) prevSlide(); // Swipe right
    });
};

// Optional: Add keyboard navigation for accessibility
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'ArrowRight') nextSlide();
});