// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAzlbU1q38L9tktaKXPbE79_OrC67Pg-_g",
    authDomain: "craft-71422.firebaseapp.com",
    projectId: "craft-71422",
    storageBucket: "craft-71422.firebasestorage.app",
    messagingSenderId: "743669193125",
    appId: "1:743669193125:web:89ad8b99e145615224704c",
    measurementId: "G-F91JW03HVS",
    databaseURL: "https://craft-71422-default-rtdb.firebaseio.com"
};

// Initialize Firebase
let app, database, auth;
try {
    app = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    auth = firebase.auth();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    alert('Firebase connection failed. Data will only be saved locally.');
}

// Check authentication status
if (auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            console.log('User logged in:', user.displayName || user.email);
            document.getElementById('user-displayname').textContent = user.displayName || user.email.split('@')[0];
            
            // Use user's UID as userId instead of random ID
            userId = user.uid;
            
            // Update localStorage
            localStorage.setItem('riseOnlineUserId', userId);
            
            // Load data for the current date now that we have userId
            loadDataForDate();
        } else {
            // No user is signed in, redirect to login
            console.log('No user logged in, redirecting to login page');
            window.location.href = 'login.html';
        }
    });
}

// Check Firebase connection status
if (database) {
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
        const statusIcon = document.getElementById('firebase-status-icon');
        const statusText = document.getElementById('firebase-status-text');
        
        if (snapshot.val() === true) {
            statusIcon.className = 'status-icon connected';
            statusText.textContent = 'Firebase Connected';
            console.log('Firebase connected');
        } else {
            statusIcon.className = 'status-icon disconnected';
            statusText.textContent = 'Firebase Disconnected';
            console.log('Firebase disconnected');
        }
    });
} else {
    const statusIcon = document.getElementById('firebase-status-icon');
    const statusText = document.getElementById('firebase-status-text');
    statusIcon.className = 'status-icon disconnected';
    statusText.textContent = 'Firebase Error';
}

// Timer variables
let countdownInterval = null;
let countdownSeconds = 0;
let stopwatchInterval = null;
let stopwatchSeconds = 0;
let stopwatchRunning = false;
let currentDate = new Date().toISOString().split('T')[0];
let userId = null; // Will be set from Firebase Auth

// Get or create user ID (now using Firebase Auth UID)
function getUserId() {
    // This will be overridden by Firebase Auth UID
    let id = localStorage.getItem('riseOnlineUserId');
    if (!id) {
        id = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('riseOnlineUserId', id);
    }
    return id;
}

// Logout function
function logout() {
    if (auth) {
        auth.signOut().then(() => {
            console.log('User signed out');
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Logout error:', error);
            alert('Error logging out: ' + error.message);
        });
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Get date in YYYY-MM-DD format for current timezone
function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize the app
function initializeApp() {
    // Set today's date as default
    const today = getLocalDateString();
    currentDate = today;
    document.getElementById('selectedDate').value = today;
    document.getElementById('report-start-date').value = today;
    document.getElementById('report-end-date').value = today;
    
    // Debug: Show initial date
    console.log('App initialized with date:', today);
    
    // Initialize farm filters
    setTimeout(initializeFarmFilters, 500);
    
    // Don't load data here - it will be loaded after authentication
}

// Set date to today
function setToday() {
    const today = getLocalDateString();
    currentDate = today;
    document.getElementById('selectedDate').value = today;
    console.log('Today button clicked. Set date to:', today);
    loadDataForDate();
}

// Load data for selected date
function loadDataForDate() {
    // Check if user is authenticated
    if (!userId) {
        console.log('User not authenticated yet, cannot load data');
        showNotification('Please wait for authentication to complete...');
        return;
    }
    
    const selectedDate = document.getElementById('selectedDate').value;
    currentDate = selectedDate;
    
    // Debug: Show current date
    console.log('Selected date:', selectedDate);
    console.log('Current date variable:', currentDate);
    
    // Clear all forms first
    clearAllForms();
    
    // Clear farm filters when switching dates
    clearFarmFilters();
    
    if (!database) {
        console.log('Firebase not available, cannot load data');
        showNotification('Firebase not connected. Cannot load data.');
        return;
    }
    
    // Load data from Firebase
    const dateRef = database.ref(`users/${userId}/data/${currentDate}`);
    
    console.log('Loading from Firebase path:', dateRef.toString());
    
    dateRef.once('value')
        .then((snapshot) => {
            const dateData = snapshot.val();
            
            console.log('Firebase data loaded:', dateData);
            
            if (!dateData) {
                showNotification(`No records found for ${currentDate}`);
                // Still load farm records to show empty state
                loadFarmRecords();
                return;
            }
            
            let recordCount = 0;
            
            // Load each type of data
            if (dateData.gathering) {
                Object.values(dateData.gathering).forEach(item => {
                    loadGatheringData(item);
                    recordCount++;
                });
            }
            
            if (dateData.event) {
                Object.values(dateData.event).forEach(item => {
                    loadEventData(item);
                    recordCount++;
                });
            }
            
            if (dateData.upgrade) {
                loadUpgradeData(dateData.upgrade);
                recordCount++;
            }
            
            if (dateData.other) {
                loadOtherData(dateData.other);
                recordCount++;
            }
            
            // Load farm data if exists
            if (dateData.farm) {
                // We don't load farm data into forms like other tabs
                // Instead we just count it for the notification
                recordCount += Object.keys(dateData.farm).length;
            }
            
            // Reload farm records for this date
            loadFarmRecords();
            
            showNotification(`Loaded ${recordCount} record(s) for ${currentDate}`);
        })
        .catch((error) => {
            console.error('Error loading data:', error);
            showNotification('Error loading data from Firebase');
            // Still try to load farm records
            loadFarmRecords();
        });
}

// Clear all forms
function clearAllForms() {
    // Clear all input fields
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.value = '';
    });
    
    // Clear dynamic containers
    document.getElementById('lucky-items-container').innerHTML = '';
    document.getElementById('upgrade-items-container').innerHTML = '';
    document.getElementById('other-items-container').innerHTML = '';
}

// Load gathering data into form
function loadGatheringData(data) {
    const timeInput = document.getElementById(`${data.profession}-time`);
    if (timeInput) {
        timeInput.value = data.time;
    }
    
    const professionDiv = document.getElementById(data.profession);
    if (professionDiv) {
        data.materials.forEach(mat => {
            const materialItems = professionDiv.querySelectorAll('.material-item');
            materialItems.forEach(item => {
                const labelText = item.querySelector('label').textContent;
                const label = labelText.replace(':', '').trim();
                console.log('Comparing label:', label, 'with material name:', mat.name);
                if (label === mat.name.trim()) {
                    const inputs = item.querySelectorAll('input[type="number"]');
                    inputs[0].value = mat.amount;
                    inputs[1].value = mat.price;
                }
            });
        });
    }
}

// Load event data into form
function loadEventData(data) {
    const timeInput = document.getElementById(`${data.eventType}-time`);
    if (timeInput) {
        timeInput.value = data.time;
    }
    
    if (data.eventType === 'lucky') {
        const container = document.getElementById('lucky-items-container');
        container.innerHTML = '';
        data.materials.forEach(mat => {
            addLuckyItem();
            const items = container.querySelectorAll('.dynamic-item');
            const lastItem = items[items.length - 1];
            lastItem.querySelector('input[placeholder="Item Name"]').value = mat.name;
            lastItem.querySelector('input[placeholder="Amount"]').value = mat.amount;
            lastItem.querySelector('input[placeholder="Price per unit"]').value = mat.price;
        });
    } else {
        const eventDiv = document.getElementById(data.eventType);
        if (eventDiv) {
            data.materials.forEach(mat => {
                const materialItems = eventDiv.querySelectorAll('.material-item');
                materialItems.forEach(item => {
                    const labelText = item.querySelector('label').textContent;
                    const label = labelText.replace(':', '').trim();
                    console.log('Comparing event label:', label, 'with material name:', mat.name);
                    if (label === mat.name.trim()) {
                        const inputs = item.querySelectorAll('input[type="number"]');
                        inputs[0].value = mat.amount;
                        inputs[1].value = mat.price;
                    }
                });
            });
        }
    }
}

// Load upgrade data into form
function loadUpgradeData(data) {
    const timeInput = document.getElementById('upgrade-time');
    if (timeInput) {
        timeInput.value = data.time;
    }
    
    const container = document.getElementById('upgrade-items-container');
    container.innerHTML = '';
    data.items.forEach(item => {
        addUpgradeItem();
        const items = container.querySelectorAll('.dynamic-item');
        const lastItem = items[items.length - 1];
        lastItem.querySelector('input[placeholder="Item Name"]').value = item.name;
        lastItem.querySelector('input[placeholder="e.g., +5 to +6"]').value = item.level;
        lastItem.querySelector('select').value = item.success.toString();
        lastItem.querySelector('input[placeholder="Total cost"]').value = item.cost;
        lastItem.querySelector('textarea').value = item.notes;
    });
}

// Load other data into form
function loadOtherData(data) {
    const timeInput = document.getElementById('other-time');
    if (timeInput) {
        timeInput.value = data.time;
    }
    
    const container = document.getElementById('other-items-container');
    container.innerHTML = '';
    data.items.forEach(item => {
        addOtherItem();
        const items = container.querySelectorAll('.dynamic-item');
        const lastItem = items[items.length - 1];
        lastItem.querySelector('input[placeholder="Activity Name"]').value = item.name;
        lastItem.querySelector('textarea').value = item.description;
        lastItem.querySelector('input[type="number"]').value = item.amount;
    });
}

// Show notification
function showNotification(message) {
    // Remove existing notification if any
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Tab Navigation
function openMainTab(tabName) {
    console.log('=== OPENING MAIN TAB:', tabName, '===');
    
    const tabs = document.querySelectorAll('.main-tab-content');
    const buttons = document.querySelectorAll('.main-tabs .tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    
    // Load admin data when admin tab is opened
    if (tabName === 'admin') {
        console.log('Loading admin data');
        loadAdminData();
    }
    
    // Load farm records when farm tab is opened
    if (tabName === 'farm') {
        console.log('Farm tab opened, loading farm records');
        loadFarmRecords();
        // Initialize farm filters to ensure event handlers are attached
        setTimeout(() => {
            console.log('Initializing farm filters after delay');
            initializeFarmFilters();
            // Check if filters are working
            setTimeout(checkFarmFilters, 100);
        }, 100);
    }
    
    console.log('=== MAIN TAB OPENING COMPLETE ===');
}

function openProfessionTab(professionName) {
    const tabs = document.querySelectorAll('.profession-content');
    const buttons = document.querySelectorAll('#gathering .sub-tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(professionName).classList.add('active');
}

function openEventTab(eventName) {
    const tabs = document.querySelectorAll('.event-content');
    const buttons = document.querySelectorAll('#events .sub-tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(eventName).classList.add('active');
}

function openUsefulInfoTab(infoName) {
    const tabs = document.querySelectorAll('.usefulinfo-content');
    const buttons = document.querySelectorAll('#usefulinfo .sub-tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(infoName).classList.add('active');
}

// Countdown Timer Functions
function startCountdown() {
    const timeInput = document.getElementById('countdownInput').value;
    if (!timeInput) {
        alert('Please set a countdown time');
        return;
    }
    
    const [hours, minutes] = timeInput.split(':');
    countdownSeconds = (parseInt(hours) * 3600) + (parseInt(minutes) * 60);
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    if (countdownSeconds <= 0) {
        clearInterval(countdownInterval);
        document.getElementById('countdownTimer').textContent = '00:00:00';
        alert('Countdown finished!');
        return;
    }
    
    countdownSeconds--;
    const hours = Math.floor(countdownSeconds / 3600);
    const minutes = Math.floor((countdownSeconds % 3600) / 60);
    const seconds = countdownSeconds % 60;
    
    document.getElementById('countdownTimer').textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function resetCountdown() {
    clearInterval(countdownInterval);
    countdownSeconds = 0;
    document.getElementById('countdownTimer').textContent = '00:00:00';
    document.getElementById('countdownInput').value = '';
}

// Stopwatch Functions
function startStopwatch() {
    if (!stopwatchRunning) {
        stopwatchRunning = true;
        stopwatchInterval = setInterval(updateStopwatch, 1000);
    }
}

function pauseStopwatch() {
    stopwatchRunning = false;
    clearInterval(stopwatchInterval);
}

function resetStopwatch() {
    stopwatchRunning = false;
    clearInterval(stopwatchInterval);
    stopwatchSeconds = 0;
    document.getElementById('stopwatchTimer').textContent = '00:00:00';
}

function updateStopwatch() {
    stopwatchSeconds++;
    const hours = Math.floor(stopwatchSeconds / 3600);
    const minutes = Math.floor((stopwatchSeconds % 3600) / 60);
    const seconds = stopwatchSeconds % 60;
    
    document.getElementById('stopwatchTimer').textContent = 
        `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// Save Gathering Data
function saveGathering(profession) {
    const timeInput = document.getElementById(`${profession}-time`);
    const time = parseInt(timeInput.value) || 0;
    
    if (time === 0) {
        alert('Please enter gathering time');
        return;
    }
    
    const data = {
        date: currentDate,
        type: 'gathering',
        profession: profession,
        time: time,
        materials: []
    };
    
    // Get all material inputs for this profession
    const professionDiv = document.getElementById(profession);
    const materialItems = professionDiv.querySelectorAll('.material-item');
    
    materialItems.forEach(item => {
        const inputs = item.querySelectorAll('input[type="number"]');
        const labelText = item.querySelector('label').textContent;
        const label = labelText.replace(':', '').trim();
        console.log('Saving gathering material with label:', label);
        const amount = parseInt(inputs[0].value) || 0;
        const price = parseFloat(inputs[1].value) || 0;
        
        if (amount > 0) {
            data.materials.push({
                name: label,
                amount: amount,
                price: price,
                total: amount * price
            });
        }
    });
    
    if (data.materials.length === 0) {
        alert('Please enter at least one material');
        return;
    }
    
    // Save to localStorage (remove old data for this date/profession first)
    removeExistingData(currentDate, 'gathering', profession);
    saveToStorage(data);
    
    // Save to Firebase
    saveToFirebase(data, profession);
    
    showNotification('Gathering data saved successfully!');
}

// Save Event Data
function saveEvent(eventType) {
    const timeInput = document.getElementById(`${eventType}-time`);
    const time = parseInt(timeInput.value) || 0;
    
    if (time === 0) {
        alert('Please enter event duration');
        return;
    }
    
    const data = {
        date: currentDate,
        type: 'event',
        eventType: eventType,
        time: time,
        materials: []
    };
    
    if (eventType === 'lucky') {
        // Handle lucky draw special case
        const container = document.getElementById('lucky-items-container');
        const items = container.querySelectorAll('.dynamic-item');
        
        items.forEach(item => {
            const name = item.querySelector('input[placeholder="Item Name"]').value;
            const amount = parseInt(item.querySelector('input[placeholder="Amount"]').value) || 0;
            const price = parseFloat(item.querySelector('input[placeholder="Price per unit"]').value) || 0;
            
            if (name && amount > 0) {
                data.materials.push({
                    name: name,
                    amount: amount,
                    price: price,
                    total: amount * price
                });
            }
        });
    } else {
        // Handle regular events
        const eventDiv = document.getElementById(eventType);
        const materialItems = eventDiv.querySelectorAll('.material-item');
        
        materialItems.forEach(item => {
            const inputs = item.querySelectorAll('input[type="number"]');
            const labelText = item.querySelector('label').textContent;
            const label = labelText.replace(':', '').trim();
            console.log('Saving event material with label:', label);
            const amount = parseInt(inputs[0].value) || 0;
            const price = parseFloat(inputs[1].value) || 0;
            
            if (amount > 0) {
                data.materials.push({
                    name: label,
                    amount: amount,
                    price: price,
                    total: amount * price
                });
            }
        });
    }
    
    if (data.materials.length === 0) {
        alert('Please enter at least one material or reward');
        return;
    }
    
    // Save to localStorage (remove old data for this date/event first)
    removeExistingData(currentDate, 'event', eventType);
    saveToStorage(data);
    
    // Save to Firebase
    saveToFirebase(data, eventType);
    
    showNotification('Event data saved successfully!');
}

// Add Lucky Item
function addLuckyItem() {
    const container = document.getElementById('lucky-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'dynamic-item';
    itemDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        <label>Item Name:</label>
        <input type="text" placeholder="Item Name">
        <label>Amount:</label>
        <input type="number" min="0" placeholder="Amount">
        <label>Price per unit:</label>
        <input type="number" min="0" step="0.01" placeholder="Price per unit">
    `;
    container.appendChild(itemDiv);
}

// Add Upgrade Item
function addUpgradeItem() {
    const container = document.getElementById('upgrade-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'dynamic-item';
    itemDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        <label>Item Name:</label>
        <input type="text" placeholder="Item Name">
        <label>Upgrade Level:</label>
        <input type="text" placeholder="e.g., +5 to +6">
        <label>Success:</label>
        <select>
            <option value="true">Yes</option>
            <option value="false">No</option>
        </select>
        <label>Cost:</label>
        <input type="number" min="0" step="0.01" placeholder="Total cost">
        <label>Notes:</label>
        <textarea placeholder="Additional notes"></textarea>
    `;
    container.appendChild(itemDiv);
}


// Update material summary for a profession
function updateMaterialSummary(profession) {
    const summaryElement = document.getElementById(`${profession}-summary`);
    if (!summaryElement) return;
    
    const professionDiv = document.getElementById(profession);
    if (!professionDiv) return;
    
    const materialItems = professionDiv.querySelectorAll('.material-item');
    let summaryHTML = '';
    let totalValue = 0;
    
    materialItems.forEach(item => {
        const inputs = item.querySelectorAll('input[type="number"]');
        const labelText = item.querySelector('label').textContent;
        const label = labelText.replace(':', '').trim();
        const amount = parseInt(inputs[0].value) || 0;
        const price = parseFloat(inputs[1].value) || 0;
        const value = amount * price;
        
        if (amount > 0) {
            totalValue += value;
            summaryHTML += `
                <div class="summary-item">
                    <span class="summary-item-name">${label}:</span>
                    <span class="summary-item-quantity">${amount}</span>
                    <span class="summary-item-value">${value.toFixed(2)}💰</span>
                </div>
            `;
        }
    });
    
    if (summaryHTML) {
        summaryHTML += `
            <div class="summary-item" style="border-top: 2px solid #667eea; margin-top: 10px; padding-top: 10px;">
                <span class="summary-item-name">Total Value:</span>
                <span class="summary-item-value">${totalValue.toFixed(2)}💰</span>
            </div>
        `;
    } else {
        summaryHTML = '<div class="summary-item">No materials entered</div>';
    }
    
    summaryElement.innerHTML = summaryHTML;
}

// Initialize summary updates for all gathering professions
function initializeSummaryUpdates() {
    const professions = ['lumbering', 'mining', 'quarrying', 'archaeology', 'fishing', 'harvesting', 'skinning', 'herbalism'];
    
    professions.forEach(profession => {
        const professionDiv = document.getElementById(profession);
        if (professionDiv) {
            const materialItems = professionDiv.querySelectorAll('.material-item');
            materialItems.forEach(item => {
                const inputs = item.querySelectorAll('input[type="number"]');
                inputs.forEach(input => {
                    input.addEventListener('input', () => {
                        updateMaterialSummary(profession);
                    });
                });
            });
        }
    });
}

// Call initializeSummaryUpdates when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Existing initialization code...
    initializeApp();
    initializeSummaryUpdates();
});

// Add Lucky Item
function addLuckyItem() {
    const container = document.getElementById('lucky-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'dynamic-item';
    itemDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        <label>Item Name:</label>
        <input type="text" placeholder="Item Name">
        <label>Amount:</label>
        <input type="number" min="0" placeholder="Amount">
        <label>Price per unit:</label>
        <input type="number" min="0" step="0.01" placeholder="Price per unit">
    `;
    container.appendChild(itemDiv);
}

// Update material summary for a profession
function updateMaterialSummary(profession) {
    const container = document.getElementById(`summary-${profession}`);
    container.innerHTML = ''; // Clear existing summary

    const items = document.querySelectorAll(`#${profession}-items-container .dynamic-item`);
    items.forEach(item => {
        const itemName = item.querySelector('input[type="text"]').value;
        const amount = item.querySelector('input[type="number"]').value;
        const pricePerUnit = item.querySelector('input[type="number"][step="0.01"]').value;

        if (itemName && amount && pricePerUnit) {
            const totalCost = amount * pricePerUnit;
            container.innerHTML += `<div>${itemName}: ${amount} x ${pricePerUnit} = ${totalCost}</div>`;
        }
    });
}

// Add Upgrade Item
function addUpgradeItem() {
    const container = document.getElementById('upgrade-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'dynamic-item';
    itemDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        <label>Item Name:</label>
        <input type="text" placeholder="Item Name">
        <label>Upgrade Level:</label>
        <input type="text" placeholder="e.g., +5 to +6">
        <label>Success:</label>
        <select>
            <option value="true">Yes</option>
            <option value="false">No</option>
        </select>
        <label>Cost:</label>
        <input type="number" min="0" step="0.01" placeholder="Total cost">
        <label>Notes:</label>
        <textarea placeholder="Additional notes"></textarea>
    `;
    container.appendChild(itemDiv);
}

// Save Upgrade Data
function saveUpgrade() {
    const timeInput = document.getElementById('upgrade-time');
    const time = parseInt(timeInput.value) || 0;
    
    const container = document.getElementById('upgrade-items-container');
    const items = container.querySelectorAll('.dynamic-item');
    
    if (items.length === 0) {
        alert('Please add at least one upgrade item');
        return;
    }
    
    const data = {
        date: currentDate,
        type: 'upgrade',
        time: time,
        items: []
    };
    
    items.forEach(item => {
        const name = item.querySelector('input[placeholder="Item Name"]').value;
        const level = item.querySelector('input[placeholder="e.g., +5 to +6"]').value;
        const success = item.querySelector('select').value === 'true';
        const cost = parseFloat(item.querySelector('input[placeholder="Total cost"]').value) || 0;
        const notes = item.querySelector('textarea').value;
        
        if (name) {
            data.items.push({
                name: name,
                level: level,
                success: success,
                cost: cost,
                notes: notes
            });
        }
    });
    
    if (data.items.length === 0) {
        alert('Please fill in at least one upgrade item');
        return;
    }
    
    // Save to localStorage (remove old data for this date first)
    removeExistingData(currentDate, 'upgrade');
    saveToStorage(data);
    
    // Save to Firebase
    saveToFirebase(data);
    
    showNotification('Upgrade data saved successfully!');
}

// Add Other Item
function addOtherItem() {
    const container = document.getElementById('other-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'dynamic-item';
    itemDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        <label>Activity Name:</label>
        <input type="text" placeholder="Activity Name">
        <label>Description:</label>
        <textarea placeholder="Description"></textarea>
        <label>Earnings/Cost:</label>
        <input type="number" step="0.01" placeholder="Amount (positive for earnings, negative for cost)">
    `;
    container.appendChild(itemDiv);
}

// Save Other Data
function saveOther() {
    const timeInput = document.getElementById('other-time');
    const time = parseInt(timeInput.value) || 0;
    
    const container = document.getElementById('other-items-container');
    const items = container.querySelectorAll('.dynamic-item');
    
    if (items.length === 0) {
        alert('Please add at least one item');
        return;
    }
    
    const data = {
        date: currentDate,
        type: 'other',
        time: time,
        items: []
    };
    
    items.forEach(item => {
        const name = item.querySelector('input[placeholder="Activity Name"]').value;
        const description = item.querySelector('textarea').value;
        const amount = parseFloat(item.querySelector('input[type="number"]').value) || 0;
        
        if (name) {
            data.items.push({
                name: name,
                description: description,
                amount: amount
            });
        }
    });
    
    if (data.items.length === 0) {
        alert('Please fill in at least one item');
        return;
    }
    
    // Save to localStorage (remove old data for this date first)
    removeExistingData(currentDate, 'other');
    saveToStorage(data);
    
    // Save to Firebase
    saveToFirebase(data);
    
    showNotification('Other data saved successfully!');
}

// Remove existing data for date/type/subtype
function removeExistingData(date, type, subType = null) {
    let allData = JSON.parse(localStorage.getItem('riseOnlineData')) || [];
    
    allData = allData.filter(item => {
        if (item.date !== date || item.type !== type) {
            return true;
        }
        
        // For gathering and events, check subtype
        if (type === 'gathering' && subType && item.profession === subType) {
            return false;
        }
        if (type === 'event' && subType && item.eventType === subType) {
            return false;
        }
        if ((type === 'upgrade' || type === 'other') && !subType) {
            return false;
        }
        
        return true;
    });
    
    localStorage.setItem('riseOnlineData', JSON.stringify(allData));
}

// Storage Functions
function saveToStorage(data) {
    let allData = JSON.parse(localStorage.getItem('riseOnlineData')) || [];
    allData.push(data);
    localStorage.setItem('riseOnlineData', JSON.stringify(allData));
}

// Firebase Storage Functions
function saveToFirebase(data, subType = null) {
    if (!database) {
        console.log('Firebase not available, skipping cloud save');
        return;
    }
    
    const path = `users/${userId}/data/${data.date}/${data.type}`;
    let ref;
    
    if (subType) {
        // For gathering and events, use subtype (profession/eventType)
        ref = database.ref(`${path}/${subType}`);
    } else {
        // For upgrade and other, just use type
        ref = database.ref(path);
    }
    
    console.log('Saving to Firebase path:', ref.toString());
    console.log('Data:', data);
    
    ref.set(data)
        .then(() => {
            console.log('Data saved to Firebase successfully');
            showNotification('Data saved to Firebase!');
        })
        .catch((error) => {
            console.error('Error saving to Firebase:', error);
            showNotification('Warning: Data saved locally but Firebase sync failed');
        });
}

// Load Data for Date Range
function loadDataForDateRange(startDate, endDate, callback) {
    if (!database) {
        console.error('Firebase not connected. Cannot load data.');
        // Try to load from localStorage as fallback
        const allData = JSON.parse(localStorage.getItem('riseOnlineData')) || [];
        const filteredData = allData.filter(item => {
            return item.date >= startDate && item.date <= endDate;
        });
        
        // Filter farm data to only include main player's earnings
        const mainCharacter = getMainCharacter();
        const finalFilteredData = filteredData.map(item => {
            // For team farms, filter to only include main player's share
            if (item.type === 'team' && item.members && mainCharacter) {
                // Find the main player's share
                const mainPlayerShare = item.members.find(member => 
                    member.nickname && member.nickname.toLowerCase() === mainCharacter.toLowerCase());
                
                if (mainPlayerShare) {
                    // Create a new item with only the main player's data
                    return {
                        ...item,
                        totalValue: mainPlayerShare.amount || 0,
                        members: [mainPlayerShare]
                    };
                }
                // If main player is not in this team farm, exclude it
                return null;
            }
            // For solo farms or when no main character is set, include as is
            return item;
        }).filter(item => item !== null); // Remove null items
        
        callback(finalFilteredData);
        return;
    }
    
    // Load data from Firebase
    const userDataRef = database.ref(`users/${userId}/data`);
    
    console.log('Loading data from:', userDataRef.toString());
    
    userDataRef.once('value')
        .then((snapshot) => {
            const allData = snapshot.val();
            const filteredData = [];
            
            console.log('All Firebase data:', allData);
            
            if (allData) {
                // Get main character for filtering farm data
                const mainCharacter = getMainCharacter();
                
                // Convert Firebase data structure to array
                Object.keys(allData).forEach(date => {
                    if (date >= startDate && date <= endDate) {
                        const dateData = allData[date];
                        
                        // Process gathering data
                        if (dateData.gathering) {
                            Object.values(dateData.gathering).forEach(item => {
                                filteredData.push(item);
                            });
                        }
                        
                        // Process event data
                        if (dateData.event) {
                            Object.values(dateData.event).forEach(item => {
                                filteredData.push(item);
                            });
                        }
                        
                        // Process upgrade data
                        if (dateData.upgrade) {
                            filteredData.push(dateData.upgrade);
                        }
                        
                        // Process other data
                        if (dateData.other) {
                            filteredData.push(dateData.other);
                        }
                        
                        // Process farm data - only include main player's earnings
                        if (dateData.farm) {
                            Object.values(dateData.farm).forEach(item => {
                                // For team farms, filter to only include main player's share
                                if (item.type === 'team' && item.members && mainCharacter) {
                                    // Find the main player's share
                                    const mainPlayerShare = item.members.find(member => 
                                        member.nickname && member.nickname.toLowerCase() === mainCharacter.toLowerCase());
                                    
                                    if (mainPlayerShare) {
                                        // Create a new item with only the main player's data
                                        const filteredItem = {
                                            ...item,
                                            totalValue: mainPlayerShare.amount || 0,
                                            members: [mainPlayerShare]
                                        };
                                        filteredData.push(filteredItem);
                                    }
                                } else {
                                    // For solo farms or when no main character is set, include as is
                                    filteredData.push(item);
                                }
                            });
                        }
                    }
                });
            }
            
            console.log('Filtered data for date range:', filteredData);
            callback(filteredData);
        })
        .catch((error) => {
            console.error('Error loading data:', error);
            // Try to load from localStorage as fallback
            const allData = JSON.parse(localStorage.getItem('riseOnlineData')) || [];
            const filteredData = allData.filter(item => {
                return item.date >= startDate && item.date <= endDate;
            });
                    
            // Filter farm data to only include main player's earnings
            const mainCharacter = getMainCharacter();
            const finalFilteredData = filteredData.map(item => {
                // For team farms, filter to only include main player's share
                if (item.type === 'team' && item.members && mainCharacter) {
                    // Find the main player's share
                    const mainPlayerShare = item.members.find(member => 
                        member.nickname && member.nickname.toLowerCase() === mainCharacter.toLowerCase());
                            
                    if (mainPlayerShare) {
                        // Create a new item with only the main player's data
                        return {
                            ...item,
                            totalValue: mainPlayerShare.amount || 0,
                            members: [mainPlayerShare]
                        };
                    }
                    // If main player is not in this team farm, exclude it
                    return null;
                }
                // For solo farms or when no main character is set, include as is
                return item;
            }).filter(item => item !== null); // Remove null items
                    
            callback(finalFilteredData);
        });
}

// Report Generation
function generateReport(reportType) {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    
    if (!startDate || !endDate) {
        alert('Please select start and end dates');
        return;
    }
    
    if (!database) {
        alert('Firebase not connected. Cannot generate reports.');
        return;
    }
    
    let actualStartDate, actualEndDate;
    
    switch(reportType) {
        case 'daily':
            // Use selected date range for daily report instead of today's date
            actualStartDate = startDate;
            actualEndDate = endDate;
            break;
        case 'weekly':
            const today = new Date();
            const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
            const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 6));
            actualStartDate = firstDay.toISOString().split('T')[0];
            actualEndDate = lastDay.toISOString().split('T')[0];
            break;
        case 'monthly':
            const now = new Date();
            actualStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            actualEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            break;
        case 'custom':
            actualStartDate = startDate;
            actualEndDate = endDate;
            break;
    }
    
    // Show loading message
    document.getElementById('report-output').innerHTML = '<p>Loading data from Firebase...</p>';
    
    // Load data from Firebase
    const userDataRef = database.ref(`users/${userId}/data`);
    
    console.log('Loading report data from:', userDataRef.toString());
    
    userDataRef.once('value')
        .then((snapshot) => {
            const allData = snapshot.val();
            const filteredData = [];
            
            console.log('All Firebase data:', allData);
            
            if (allData) {
                // Get the main character from localStorage
                const mainCharacter = getMainCharacter();
                
                // Convert Firebase data structure to array
                Object.keys(allData).forEach(date => {
                    if (date >= actualStartDate && date <= actualEndDate) {
                        const dateData = allData[date];
                        
                        // Process gathering data
                        if (dateData.gathering) {
                            Object.values(dateData.gathering).forEach(item => {
                                filteredData.push(item);
                            });
                        }
                        
                        // Process event data
                        if (dateData.event) {
                            Object.values(dateData.event).forEach(item => {
                                filteredData.push(item);
                            });
                        }
                        
                        // Process upgrade data
                        if (dateData.upgrade) {
                            filteredData.push(dateData.upgrade);
                        }
                        
                        // Process other data
                        if (dateData.other) {
                            filteredData.push(dateData.other);
                        }
                        
                        // Process farm data - only include main player's earnings
                        if (dateData.farm) {
                            Object.values(dateData.farm).forEach(item => {
                                // For team farms, filter to only include main player's share
                                if (item.type === 'team' && item.members && mainCharacter) {
                                    // Find the main player's share
                                    const mainPlayerShare = item.members.find(member => 
                                        member.nickname && member.nickname.toLowerCase() === mainCharacter.toLowerCase());
                                    
                                    if (mainPlayerShare) {
                                        // Create a new item with only the main player's data
                                        const filteredItem = {
                                            ...item,
                                            totalValue: mainPlayerShare.amount || 0,
                                            members: [mainPlayerShare]
                                        };
                                        filteredData.push(filteredItem);
                                    }
                                } else {
                                    // For solo farms or when no main character is set, include as is
                                    filteredData.push(item);
                                }
                            });
                        }
                    }
                });
            }
            
            console.log('Filtered data:', filteredData);
            displayReport(filteredData, actualStartDate, actualEndDate, reportType);
        })
        .catch((error) => {
            console.error('Error loading report data:', error);
            document.getElementById('report-output').innerHTML = '<p>Error loading data from Firebase. Please try again.</p>';
        });
}

function displayReport(data, startDate, endDate, reportType) {
    const output = document.getElementById('report-output');
    
    // Store data globally for export
    currentReportData = {
        data: data,
        startDate: startDate,
        endDate: endDate,
        reportType: reportType
    };
    
    if (data.length === 0) {
        output.innerHTML = '<p>No data found for the selected period.</p>';
        return;
    }
    
    let html = `<h3>${capitalize(reportType)} Report (${startDate} to ${endDate})</h3>`;
    
    // Gathering Summary
    const gatheringData = data.filter(d => d.type === 'gathering');
    if (gatheringData.length > 0) {
        html += '<div class="report-section">';
        html += '<h4>Gathering Activities</h4>';
        html += '<table class="report-table">';
        html += '<tr><th>Date</th><th>Profession</th><th>Time (min)</th><th>Material</th><th>Amount</th><th>Price</th><th>Total</th></tr>';
        
        let gatheringTotal = 0;
        let gatheringTime = 0;
        
        gatheringData.forEach(item => {
            gatheringTime += item.time;
            item.materials.forEach(mat => {
                html += `<tr>
                    <td>${item.date}</td>
                    <td>${capitalize(item.profession)}</td>
                    <td>${item.time}</td>
                    <td>${mat.name}</td>
                    <td>${mat.amount}</td>
                    <td>${formatNumber(mat.price)}</td>
                    <td>${formatNumber(mat.total)}</td>
                </tr>`;
                gatheringTotal += mat.total;
            });
        });
        
        html += '</table>';
        html += `<p><strong>Total Gathering Time: ${gatheringTime} minutes</strong></p>`;
        html += `<p><strong>Total Gathering Earnings: ${formatNumber(gatheringTotal)}</strong></p>`;
        html += '</div>';
    }
    
    // Event Summary
    const eventData = data.filter(d => d.type === 'event');
    if (eventData.length > 0) {
        html += '<div class="report-section">';
        html += '<h4>Event Activities</h4>';
        html += '<table class="report-table">';
        html += '<tr><th>Date</th><th>Event</th><th>Time (min)</th><th>Reward</th><th>Amount</th><th>Price</th><th>Total</th></tr>';
        
        let eventTotal = 0;
        let eventTime = 0;
        
        eventData.forEach(item => {
            eventTime += item.time;
            item.materials.forEach(mat => {
                html += `<tr>
                    <td>${item.date}</td>
                    <td>${capitalize(item.eventType)}</td>
                    <td>${item.time}</td>
                    <td>${mat.name}</td>
                    <td>${mat.amount}</td>
                    <td>${formatNumber(mat.price)}</td>
                    <td>${formatNumber(mat.total)}</td>
                </tr>`;
                eventTotal += mat.total;
            });
        });
        
        html += '</table>';
        html += `<p><strong>Total Event Time: ${eventTime} minutes</strong></p>`;
        html += `<p><strong>Total Event Earnings: ${formatNumber(eventTotal)}</strong></p>`;
        html += '</div>';
    }
    
    // Upgrade Summary
    const upgradeData = data.filter(d => d.type === 'upgrade');
    if (upgradeData.length > 0) {
        html += '<div class="report-section">';
        html += '<h4>Upgrade Activities</h4>';
        html += '<table class="report-table">';
        html += '<tr><th>Date</th><th>Item</th><th>Level</th><th>Success</th><th>Cost</th><th>Notes</th></tr>';
        
        let upgradeTotal = 0;
        let upgradeTime = 0;
        let successCount = 0;
        let failCount = 0;
        
        upgradeData.forEach(item => {
            upgradeTime += item.time;
            item.items.forEach(upg => {
                html += `<tr>
                    <td>${item.date}</td>
                    <td>${upg.name}</td>
                    <td>${upg.level}</td>
                    <td>${upg.success ? '✓' : '✗'}</td>
                    <td>${formatNumber(upg.cost)}</td>
                    <td>${upg.notes}</td>
                </tr>`;
                upgradeTotal += upg.cost;
                if (upg.success) successCount++;
                else failCount++;
            });
        });
        
        html += '</table>';
        html += `<p><strong>Total Upgrade Time: ${upgradeTime} minutes</strong></p>`;
        html += `<p><strong>Total Upgrade Cost: ${formatNumber(upgradeTotal)}</strong></p>`;
        html += `<p><strong>Success Rate: ${successCount}/${successCount + failCount} (${((successCount / (successCount + failCount)) * 100).toFixed(1)}%)</strong></p>`;
        html += '</div>';
    }
    
    // Other Summary
    const otherData = data.filter(d => d.type === 'other');
    if (otherData.length > 0) {
        html += '<div class="report-section">';
        html += '<h4>Other Activities</h4>';
        html += '<table class="report-table">';
        html += '<tr><th>Date</th><th>Activity</th><th>Description</th><th>Amount</th></tr>';
        
        let otherTotal = 0;
        let otherTime = 0;
        
        otherData.forEach(item => {
            otherTime += item.time;
            item.items.forEach(other => {
                html += `<tr>
                    <td>${item.date}</td>
                    <td>${other.name}</td>
                    <td>${other.description}</td>
                    <td>${formatNumber(other.amount)}</td>
                </tr>`;
                otherTotal += other.amount;
            });
        });
        
        html += '</table>';
        html += `<p><strong>Total Other Time: ${otherTime} minutes</strong></p>`;
        html += `<p><strong>Total Other Amount: ${formatNumber(otherTotal)}</strong></p>`;
        html += '</div>';
    }
    
    // Farm Summary
    const farmData = data.filter(d => d.type === 'solo' || d.type === 'team');
    if (farmData.length > 0) {
        html += '<div class="report-section">';
        html += '<h4>Farm Activities</h4>';
        html += '<table class="report-table">';
        html += '<tr><th>Date</th><th>Type</th><th>Location</th><th>Time (min)</th><th>Total Value</th></tr>';
        
        let farmTotal = 0;
        let farmTime = 0;
        
        farmData.forEach(item => {
            farmTime += parseInt(item.time) || 0;
            farmTotal += item.totalValue || 0;
            html += `<tr>
                <td>${item.date}</td>
                <td>${item.type === 'solo' ? 'Solo' : 'Team'}</td>
                <td>${item.location}</td>
                <td>${item.time}</td>
                <td>${formatNumber(item.totalValue)}</td>
            </tr>`;
        });
        
        html += '</table>';
        html += `<p><strong>Total Farm Time: ${farmTime} minutes</strong></p>`;
        html += `<p><strong>Total Farm Value: ${formatNumber(farmTotal)}</strong></p>`;
        html += '</div>';
    }
    
    // Grand Total
    const gatheringTotal = gatheringData.reduce((sum, item) => 
        sum + item.materials.reduce((s, m) => s + m.total, 0), 0);
    const eventTotal = eventData.reduce((sum, item) => 
        sum + item.materials.reduce((s, m) => s + m.total, 0), 0);
    const upgradeTotal = upgradeData.reduce((sum, item) => 
        sum + item.items.reduce((s, u) => s + u.cost, 0), 0);
    const otherTotal = otherData.reduce((sum, item) => 
        sum + item.items.reduce((s, o) => s + o.amount, 0), 0);
    const farmTotal = farmData.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    
    const grandTotal = gatheringTotal + eventTotal - upgradeTotal + otherTotal + farmTotal;
    
    const totalTime = [...gatheringData, ...eventData, ...upgradeData, ...otherData, ...farmData]
        .reduce((sum, item) => sum + (parseInt(item.time) || 0), 0);
    
    html += '<div class="total-earnings">';
    html += '<h3>Summary</h3>';
    html += `<p>Total Time Spent: ${totalTime} minutes (${(totalTime / 60).toFixed(2)} hours)</p>`;
    html += `<p>Gathering Earnings: ${formatNumber(gatheringTotal)}</p>`;
    html += `<p>Event Earnings: ${formatNumber(eventTotal)}</p>`;
    html += `<p>Upgrade Costs: -${formatNumber(upgradeTotal)}</p>`;
    html += `<p>Other: ${formatNumber(otherTotal)}</p>`;
    html += `<p>Farm Value: ${formatNumber(farmTotal)}</p>`;
    html += `<div class="amount">${formatNumber(grandTotal)}</div>`;
    html += '<p>Net Earnings</p>';
    html += '</div>';
    
    output.innerHTML = html;
}

// Export to Excel
function exportToExcel() {
    if (!currentReportData || !currentReportData.data || currentReportData.data.length === 0) {
        alert('Please generate a report first!');
        return;
    }

    const { data, startDate, endDate, reportType } = currentReportData;
    const wb = XLSX.utils.book_new();

    // Gathering Data
    const gatheringData = data.filter(d => d.type === 'gathering');
    if (gatheringData.length > 0) {
        const gatheringRows = [];
        gatheringRows.push(['Date', 'Profession', 'Time (min)', 'Material', 'Amount', 'Price', 'Total']);
        
        gatheringData.forEach(item => {
            item.materials.forEach(mat => {
                gatheringRows.push([
                    item.date,
                    capitalize(item.profession),
                    item.time,
                    mat.name,
                    mat.amount,
                    mat.price,
                    mat.total
                ]);
            });
        });

        const gatheringTotal = gatheringData.reduce((sum, item) => 
            sum + item.materials.reduce((s, m) => s + m.total, 0), 0);
        const gatheringTime = gatheringData.reduce((sum, item) => sum + item.time, 0);
        
        gatheringRows.push([]);
        gatheringRows.push(['Total Time', gatheringTime + ' minutes']);
        gatheringRows.push(['Total Earnings', gatheringTotal]);

        const ws1 = XLSX.utils.aoa_to_sheet(gatheringRows);
        XLSX.utils.book_append_sheet(wb, ws1, 'Gathering');
    }

    // Event Data
    const eventData = data.filter(d => d.type === 'event');
    if (eventData.length > 0) {
        const eventRows = [];
        eventRows.push(['Date', 'Event', 'Time (min)', 'Reward', 'Amount', 'Price', 'Total']);
        
        eventData.forEach(item => {
            item.materials.forEach(mat => {
                eventRows.push([
                    item.date,
                    capitalize(item.eventType),
                    item.time,
                    mat.name,
                    mat.amount,
                    mat.price,
                    mat.total
                ]);
            });
        });

        const eventTotal = eventData.reduce((sum, item) => 
            sum + item.materials.reduce((s, m) => s + m.total, 0), 0);
        const eventTime = eventData.reduce((sum, item) => sum + item.time, 0);
        
        eventRows.push([]);
        eventRows.push(['Total Time', eventTime + ' minutes']);
        eventRows.push(['Total Earnings', eventTotal]);

        const ws2 = XLSX.utils.aoa_to_sheet(eventRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'Events');
    }

    // Upgrade Data
    const upgradeData = data.filter(d => d.type === 'upgrade');
    if (upgradeData.length > 0) {
        const upgradeRows = [];
        upgradeRows.push(['Date', 'Item', 'Level', 'Success', 'Cost', 'Notes']);
        
        upgradeData.forEach(item => {
            item.items.forEach(upg => {
                upgradeRows.push([
                    item.date,
                    upg.name,
                    upg.level,
                    upg.success ? 'Yes' : 'No',
                    upg.cost,
                    upg.notes
                ]);
            });
        });

        const upgradeTotal = upgradeData.reduce((sum, item) => 
            sum + item.items.reduce((s, u) => s + u.cost, 0), 0);
        
        upgradeRows.push([]);
        upgradeRows.push(['Total Cost', upgradeTotal]);

        const ws3 = XLSX.utils.aoa_to_sheet(upgradeRows);
        XLSX.utils.book_append_sheet(wb, ws3, 'Upgrades');
    }

    // Other Data
    const otherData = data.filter(d => d.type === 'other');
    if (otherData.length > 0) {
        const otherRows = [];
        otherRows.push(['Date', 'Activity', 'Description', 'Amount']);
        
        otherData.forEach(item => {
            item.items.forEach(other => {
                otherRows.push([
                    item.date,
                    other.name,
                    other.description,
                    other.amount
                ]);
            });
        });

        const otherTotal = otherData.reduce((sum, item) => 
            sum + item.items.reduce((s, o) => s + o.amount, 0), 0);
        
        otherRows.push([]);
        otherRows.push(['Total', otherTotal]);

        const ws4 = XLSX.utils.aoa_to_sheet(otherRows);
        XLSX.utils.book_append_sheet(wb, ws4, 'Other');
    }

    // Farm Data
    const farmData = data.filter(d => d.type === 'solo' || d.type === 'team');
    if (farmData.length > 0) {
        const farmRows = [];
        farmRows.push(['Date', 'Type', 'Location', 'Time (min)', 'Total Value']);
        
        farmData.forEach(item => {
            farmRows.push([
                item.date,
                item.type === 'solo' ? 'Solo' : 'Team',
                item.location,
                item.time,
                item.totalValue
            ]);
        });

        const farmTotal = farmData.reduce((sum, item) => sum + (item.totalValue || 0), 0);
        
        farmRows.push([]);
        farmRows.push(['Total Value', farmTotal]);

        const ws5 = XLSX.utils.aoa_to_sheet(farmRows);
        XLSX.utils.book_append_sheet(wb, ws5, 'Farm');
    }

    // Summary Sheet
    const gatheringTotal = gatheringData.reduce((sum, item) => 
        sum + item.materials.reduce((s, m) => s + m.total, 0), 0);
    const eventTotal = eventData.reduce((sum, item) => 
        sum + item.materials.reduce((s, m) => s + m.total, 0), 0);
    const upgradeTotal = upgradeData.reduce((sum, item) => 
        sum + item.items.reduce((s, u) => s + u.cost, 0), 0);
    const otherTotal = otherData.reduce((sum, item) => 
        sum + item.items.reduce((s, o) => s + o.amount, 0), 0);
    const farmTotal = farmData.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const grandTotal = gatheringTotal + eventTotal - upgradeTotal + otherTotal + farmTotal;
    const totalTime = [...gatheringData, ...eventData, ...upgradeData, ...otherData, ...farmData]
        .reduce((sum, item) => sum + (parseInt(item.time) || 0), 0);

    const summaryRows = [
        ['Rise Online - ' + capitalize(reportType) + ' Report'],
        ['Period', startDate + ' to ' + endDate],
        [],
        ['Category', 'Amount'],
        ['Gathering Earnings', gatheringTotal],
        ['Event Earnings', eventTotal],
        ['Upgrade Costs', -upgradeTotal],
        ['Other', otherTotal],
        ['Farm Value', farmTotal],
        [],
        ['Net Earnings', grandTotal],
        ['Total Time (minutes)', totalTime],
        ['Total Time (hours)', (totalTime / 60).toFixed(2)]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Download
    const fileName = `RiseOnline_Report_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showNotification('Excel file downloaded successfully!');
}

// Export to PDF
function exportToPDF() {
    if (!currentReportData || !currentReportData.data || currentReportData.data.length === 0) {
        alert('Please generate a report first!');
        return;
    }

    const { startDate, endDate } = currentReportData;
    const element = document.getElementById('report-output');
    
    const opt = {
        margin: 10,
        filename: `RiseOnline_Report_${startDate}_to_${endDate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        showNotification('PDF file downloaded successfully!');
    });
}

// Generate Detailed Report
function generatePlayerReport(playerName) {
    console.log('generatePlayerReport called with:', playerName);
    
    // If playerName is 'main', get the main character from localStorage
    if (playerName === 'main') {
        const mainCharacter = getMainCharacter();
        if (!mainCharacter) {
            alert('Please set your main character in the Admin panel first!');
            return;
        }
        playerName = mainCharacter;
        console.log('Using main character:', playerName);
    }
    
    let startDate = document.getElementById('report-start-date').value;
    let endDate = document.getElementById('report-end-date').value;
    
    console.log('Selected dates:', startDate, 'to', endDate);
    
    // If no dates are selected, use a default range (last 30 days)
    if (!startDate || !endDate) {
        const today = new Date();
        endDate = getLocalDateString(today);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startDate = getLocalDateString(thirtyDaysAgo);
        
        // Set the dates in the UI so user can see what range is being used
        document.getElementById('report-start-date').value = startDate;
        document.getElementById('report-end-date').value = endDate;
        
        console.log('Using default dates:', startDate, 'to', endDate);
    }
    
    // Load data for the selected date range
    console.log('Loading data for date range...');
    loadDataForDateRange(startDate, endDate, (data) => {
        console.log('Data loaded, generating report for:', playerName);
        console.log('Data:', data);
        const reportHTML = generatePlayerReportHTML(data, playerName, startDate, endDate);
        const container = document.getElementById('player-report-container');
        const modal = document.getElementById('player-report-modal');
        
        if (container) {
            container.innerHTML = reportHTML;
            console.log('Report HTML set in container');
        } else {
            console.error('Player report container not found');
        }
        
        if (modal) {
            modal.style.display = 'block';
            console.log('Player report modal displayed');
        } else {
            console.error('Player report modal not found');
        }
    });
}

function generateItemReport(itemName) {
    let startDate = document.getElementById('report-start-date').value;
    let endDate = document.getElementById('report-end-date').value;
    
    // If no dates are selected, use a default range (last 30 days)
    if (!startDate || !endDate) {
        const today = new Date();
        endDate = getLocalDateString(today);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startDate = getLocalDateString(thirtyDaysAgo);
        
        // Set the dates in the UI so user can see what range is being used
        document.getElementById('report-start-date').value = startDate;
        document.getElementById('report-end-date').value = endDate;
    }
    
    // Load data for the selected date range
    loadDataForDateRange(startDate, endDate, (data) => {
        const reportHTML = generateItemReportHTML(data, itemName, startDate, endDate);
        document.getElementById('item-report-container').innerHTML = reportHTML;
        document.getElementById('item-report-modal').style.display = 'block';
    });
}

function generateDetailedReport() {
    if (!currentReportData || !currentReportData.data || currentReportData.data.length === 0) {
        // If no report data exists, generate it automatically with default date range
        let startDate = document.getElementById('report-start-date').value;
        let endDate = document.getElementById('report-end-date').value;
        
        // If no dates are selected, use a default range (last 30 days)
        if (!startDate || !endDate) {
            const today = new Date();
            endDate = getLocalDateString(today);
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);
            startDate = getLocalDateString(thirtyDaysAgo);
            
            // Set the dates in the UI so user can see what range is being used
            document.getElementById('report-start-date').value = startDate;
            document.getElementById('report-end-date').value = endDate;
        }
        
        // Load data for the selected date range and generate report
        loadDataForDateRange(startDate, endDate, (data) => {
            currentReportData = { data, startDate, endDate };
            const detailedReportHTML = generateDetailedReportHTML(data, startDate, endDate);
            document.getElementById('detailed-report-container').innerHTML = detailedReportHTML;
            document.getElementById('detailed-report-modal').style.display = 'block';
        });
        return;
    }
    
    const { data, startDate, endDate } = currentReportData;
    const detailedReportHTML = generateDetailedReportHTML(data, startDate, endDate);
    
    document.getElementById('detailed-report-container').innerHTML = detailedReportHTML;
    document.getElementById('detailed-report-modal').style.display = 'block';
}

// Close Detailed Report Modal
function closeDetailedReportModal() {
    document.getElementById('detailed-report-modal').style.display = 'none';
}

function closePlayerReportModal() {
    console.log('Closing player report modal');
    const modal = document.getElementById('player-report-modal');
    if (modal) {
        modal.style.display = 'none';
        console.log('Player report modal closed');
    } else {
        console.error('Player report modal not found');
    }
}

function closeItemReportModal() {
    document.getElementById('item-report-modal').style.display = 'none';
}

// Generate Item Report HTML
function generateItemReportHTML(data, itemName, startDate, endDate) {
    // Calculate item statistics
    const stats = calculateItemStatistics(data, itemName);
    
    let html = `
        <h2>Item Report: ${itemName}</h2>
        <h3>Period: ${startDate} to ${endDate}</h3>
        
        <!-- Summary Cards -->
        <div class="detailed-report-grid">
            <div class="detailed-report-card">
                <h4>Total Appearances</h4>
                <div class="value">${stats.appearancesCount}</div>
                <div class="label">Times Found</div>
            </div>
            <div class="detailed-report-card">
                <h4>Total Quantity</h4>
                <div class="value">${stats.totalQuantity}</div>
                <div class="label">Items Collected</div>
            </div>
            <div class="detailed-report-card">
                <h4>Total Value</h4>
                <div class="value">${formatNumber(stats.totalValue)}</div>
                <div class="label">Net Worth</div>
            </div>
            <div class="detailed-report-card">
                <h4>Average Value</h4>
                <div class="value">${formatNumber(stats.averageValue)}</div>
                <div class="label">Per Appearance</div>
            </div>
        </div>
        
        <div class="detailed-report-grid">
            <div class="detailed-report-card">
                <h4>Most Frequent Date</h4>
                <div class="value">${stats.mostFrequentDate.date}</div>
                <div class="label">${stats.mostFrequentDate.count} times</div>
            </div>
            <div class="detailed-report-card">
                <h4>Least Frequent Date</h4>
                <div class="value">${stats.leastFrequentDate.date}</div>
                <div class="label">${stats.leastFrequentDate.count} times</div>
            </div>
            <div class="detailed-report-card">
                <h4>Daily Average</h4>
                <div class="value">${stats.dailyAverage.toFixed(2)}</div>
                <div class="label">Items Per Day</div>
            </div>
            <div class="detailed-report-card">
                <h4>Unique Dates</h4>
                <div class="value">${Object.keys(stats.appearancesByDate).length}</div>
                <div class="label">Days Found</div>
            </div>
        </div>
        
        <!-- Appearances by Date -->
        <div class="detailed-report-section">
            <h3>Appearances by Date</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Appearances</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.appearancesByDate).map(([date, count]) => `
                        <tr>
                            <td>${date}</td>
                            <td>${count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Generate Player Report HTML
function generatePlayerReportHTML(data, playerName, startDate, endDate) {
    // Calculate player statistics
    const stats = calculatePlayerStatistics(data, playerName);
    
    // Find date with most and least activities
    let mostActiveDate = { date: 'N/A', count: 0 };
    let leastActiveDate = { date: 'N/A', count: Infinity };
    
    Object.entries(stats.activitiesByDate).forEach(([date, count]) => {
        if (count > mostActiveDate.count) {
            mostActiveDate = { date, count };
        }
        if (count < leastActiveDate.count) {
            leastActiveDate = { date, count };
        }
    });
    
    // If no least active date found, set to same as most active
    if (leastActiveDate.count === Infinity) {
        leastActiveDate = { ...mostActiveDate };
    }
    
    // Calculate item earnings and gathering details
    const itemEarnings = calculatePlayerItemEarnings(data, playerName);
    const gatheringStats = calculatePlayerGatheringStats(data, playerName);
    const farmStats = calculatePlayerFarmStats(data, playerName);
    
    let html = `
        <h2>Player Report: ${playerName}</h2>
        <h3>Period: ${startDate} to ${endDate}</h3>
        
        <!-- Summary Cards -->
        <div class="detailed-report-grid">
            <div class="detailed-report-card">
                <h4>Total Activities</h4>
                <div class="value">${stats.totalActivities}</div>
                <div class="label">Participated</div>
            </div>
            <div class="detailed-report-card">
                <h4>Total Earnings</h4>
                <div class="value">${formatNumber(stats.totalEarnings)}</div>
                <div class="label">Net Profit</div>
            </div>
            <div class="detailed-report-card">
                <h4>Total Time</h4>
                <div class="value">${stats.totalTime}</div>
                <div class="label">Minutes</div>
            </div>
            <div class="detailed-report-card">
                <h4>Average Earnings</h4>
                <div class="value">${formatNumber(stats.averageEarnings)}</div>
                <div class="label">Per Activity</div>
            </div>
        </div>
        
        <div class="detailed-report-grid">
            <div class="detailed-report-card">
                <h4>Average Time</h4>
                <div class="value">${Math.round(stats.averageTime)} min</div>
                <div class="label">Per Activity</div>
            </div>
            <div class="detailed-report-card">
                <h4>Average Contribution</h4>
                <div class="value">${stats.averageContribution.toFixed(2)}%</div>
                <div class="label">Team Activities</div>
            </div>
            <div class="detailed-report-card">
                <h4>Participation Rate</h4>
                <div class="value">${stats.participationRate.toFixed(2)}%</div>
                <div class="label">Of All Activities</div>
            </div>
            <div class="detailed-report-card">
                <h4>Most Active Date</h4>
                <div class="value">${mostActiveDate.date}</div>
                <div class="label">${mostActiveDate.count} activities</div>
            </div>
        </div>
        
        <!-- Activities by Type -->
        <div class="detailed-report-section">
            <h3>Activity Type Distribution</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Activity Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.activitiesByType).map(([type, count]) => {
                        const percentage = stats.totalActivities > 0 ? 
                            ((count / stats.totalActivities) * 100).toFixed(2) : 0;
                        return `
                        <tr>
                            <td>${capitalize(type)}</td>
                            <td>${count}</td>
                            <td>${percentage}%</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Earnings by Item -->
        <div class="detailed-report-section">
            <h3>Item Earnings</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Total Value</th>
                        <th>Average Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(itemEarnings).map(([itemName, itemData]) => `
                        <tr>
                            <td>${itemName}</td>
                            <td>${itemData.totalQuantity}</td>
                            <td>${formatNumber(itemData.totalValue)}</td>
                            <td>${formatNumber(itemData.averageValue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Gathering Statistics -->
        <div class="detailed-report-section">
            <h3>Gathering Statistics</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Profession</th>
                        <th>Activities</th>
                        <th>Total Time</th>
                        <th>Total Earnings</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(gatheringStats).map(([profession, profData]) => `
                        <tr>
                            <td>${profession}</td>
                            <td>${profData.activities}</td>
                            <td>${profData.totalTime} min</td>
                            <td>${formatNumber(profData.totalEarnings)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Farm Statistics -->
        <div class="detailed-report-section">
            <h3>Farm Statistics</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Farm Type</th>
                        <th>Activities</th>
                        <th>Total Time</th>
                        <th>Total Earnings</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(farmStats).map(([farmType, farmData]) => `
                        <tr>
                            <td>${capitalize(farmType)} Farm</td>
                            <td>${farmData.activities}</td>
                            <td>${farmData.totalTime} min</td>
                            <td>${formatNumber(farmData.totalEarnings)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Calculate Player Item Earnings
function calculatePlayerItemEarnings(data, playerName) {
    const itemEarnings = {};
    
    // Get the main character from localStorage
    const mainCharacter = getMainCharacter();
    const targetPlayer = playerName === 'main' && mainCharacter ? mainCharacter : playerName;
    
    // Process each data item
    data.forEach(item => {
        if (item.type === 'gathering' && item.materials && Array.isArray(item.materials)) {
            // For gathering activities, we can't verify player participation without user identification
            // But we can include them in the report as potential earnings
            item.materials.forEach(material => {
                const itemName = material.name || 'Unknown';
                const quantity = material.amount || 0;
                const value = material.total || 0;
                
                if (!itemEarnings[itemName]) {
                    itemEarnings[itemName] = {
                        totalQuantity: 0,
                        totalValue: 0,
                        averageValue: 0
                    };
                }
                
                itemEarnings[itemName].totalQuantity += quantity;
                itemEarnings[itemName].totalValue += value;
                
                if (itemEarnings[itemName].totalQuantity > 0) {
                    itemEarnings[itemName].averageValue = 
                        itemEarnings[itemName].totalValue / itemEarnings[itemName].totalQuantity;
                }
            });
        } else if (item.type === 'team' && item.members && Array.isArray(item.members)) {
            // For team farms, check if player is in the members list
            const playerInTeam = item.members.find(member => 
                member.nickname && member.nickname.toLowerCase() === targetPlayer.toLowerCase());
            
            if (playerInTeam && item.materials && Array.isArray(item.materials)) {
                // Calculate player's share of the earnings
                const playerShare = playerInTeam.amount || 0;
                const totalValue = item.totalValue || 0;
                
                if (totalValue > 0) {
                    const shareRatio = playerShare / totalValue;
                    
                    item.materials.forEach(material => {
                        const itemName = material.name || 'Unknown';
                        const quantity = material.amount || 0;
                        const value = material.total || 0;
                        const playerQuantity = Math.round(quantity * shareRatio);
                        const playerValue = value * shareRatio;
                        
                        if (!itemEarnings[itemName]) {
                            itemEarnings[itemName] = {
                                totalQuantity: 0,
                                totalValue: 0,
                                averageValue: 0
                            };
                        }
                        
                        itemEarnings[itemName].totalQuantity += playerQuantity;
                        itemEarnings[itemName].totalValue += playerValue;
                        
                        if (itemEarnings[itemName].totalQuantity > 0) {
                            itemEarnings[itemName].averageValue = 
                                itemEarnings[itemName].totalValue / itemEarnings[itemName].totalQuantity;
                        }
                    });
                }
            }
        }
    });
    
    return itemEarnings;
}

// Calculate Player Gathering Statistics
function calculatePlayerGatheringStats(data, playerName) {
    const gatheringStats = {};
    
    // Get the main character from localStorage
    const mainCharacter = getMainCharacter();
    const targetPlayer = playerName === 'main' && mainCharacter ? mainCharacter : playerName;
    
    // Process each data item
    data.forEach(item => {
        if (item.type === 'gathering') {
            // For gathering activities, we can't verify player participation without user identification
            // But we can include them in the report as potential activities
            const profession = item.profession || 'Unknown';
            const time = parseInt(item.time) || 0;
            let earnings = 0;
            
            if (item.materials && Array.isArray(item.materials)) {
                item.materials.forEach(material => {
                    earnings += material.total || 0;
                });
            }
            
            if (!gatheringStats[profession]) {
                gatheringStats[profession] = {
                    activities: 0,
                    totalTime: 0,
                    totalEarnings: 0
                };
            }
            
            gatheringStats[profession].activities++;
            gatheringStats[profession].totalTime += time;
            gatheringStats[profession].totalEarnings += earnings;
        } else if (item.type === 'team' && item.members && Array.isArray(item.members)) {
            // For team farms, check if player is in the members list
            const playerInTeam = item.members.find(member => 
                member.nickname && member.nickname.toLowerCase() === targetPlayer.toLowerCase());
            
            if (playerInTeam) {
                const time = parseInt(item.time) || 0;
                const playerShare = playerInTeam.amount || 0;
                
                // We'll categorize team activities as "Team Farming"
                const profession = 'Team Farming';
                
                if (!gatheringStats[profession]) {
                    gatheringStats[profession] = {
                        activities: 0,
                        totalTime: 0,
                        totalEarnings: 0
                    };
                }
                
                gatheringStats[profession].activities++;
                gatheringStats[profession].totalTime += time;
                gatheringStats[profession].totalEarnings += playerShare;
            }
        }
    });
    
    return gatheringStats;
}

// Calculate Player Farm Statistics
function calculatePlayerFarmStats(data, playerName) {
    const farmStats = {};
    
    // Get the main character from localStorage
    const mainCharacter = getMainCharacter();
    const targetPlayer = playerName === 'main' && mainCharacter ? mainCharacter : playerName;
    
    // Process each data item
    data.forEach(item => {
        if (item.type === 'solo' || item.type === 'team') {
            let playerParticipated = false;
            let playerEarnings = 0;
            let playerTime = 0;
            
            if (item.type === 'solo') {
                // For solo farms, we can't verify player participation without user identification
                // But we can include them in the report as potential activities
                playerParticipated = true;
                playerTime = parseInt(item.time) || 0;
                playerEarnings = item.totalValue || 0;
            } else if (item.type === 'team' && item.members && Array.isArray(item.members)) {
                // For team farms, check if player is in the members list
                const playerInTeam = item.members.find(member => 
                    member.nickname && member.nickname.toLowerCase() === targetPlayer.toLowerCase());
                
                if (playerInTeam) {
                    playerParticipated = true;
                    playerTime = parseInt(item.time) || 0;
                    playerEarnings = playerInTeam.amount || 0;
                }
            }
            
            if (playerParticipated) {
                const farmType = item.type;
                
                if (!farmStats[farmType]) {
                    farmStats[farmType] = {
                        activities: 0,
                        totalTime: 0,
                        totalEarnings: 0
                    };
                }
                
                farmStats[farmType].activities++;
                farmStats[farmType].totalTime += playerTime;
                farmStats[farmType].totalEarnings += playerEarnings;
            }
        }
    });
    
    return farmStats;
}

// Generate Detailed Report HTML
function generateDetailedReportHTML(data, startDate, endDate) {
    // Calculate detailed statistics
    const stats = calculateDetailedStatistics(data);
    
    let html = `
        <h2>Detailed Report (${startDate} to ${endDate})</h2>
        
        <!-- Summary Cards -->
        <div class="detailed-report-grid">
            <div class="detailed-report-card">
                <h4>Total Earnings</h4>
                <div class="value">${formatNumber(stats.totalEarnings)}</div>
                <div class="label">Net Profit</div>
            </div>
            <div class="detailed-report-card">
                <h4>Total Time</h4>
                <div class="value">${stats.totalTime}</div>
                <div class="label">Minutes</div>
            </div>
            <div class="detailed-report-card">
                <h4>Most Profitable Item</h4>
                <div class="value">${stats.mostProfitableItem.name || 'N/A'}</div>
                <div class="label">${formatNumber(stats.mostProfitableItem.value || 0)}</div>
            </div>
            <div class="detailed-report-card">
                <h4>Most Profitable Profession</h4>
                <div class="value">${stats.mostProfitableProfession.name || 'N/A'}</div>
                <div class="label">${formatNumber(stats.mostProfitableProfession.value || 0)}</div>
            </div>
        </div>
        
        <!-- Charts Section -->
        <div class="detailed-report-section">
            <h3>📊 Earnings Overview</h3>
            <div class="detailed-report-grid">
                <div class="chart-container">
                    <canvas id="topItemsChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="topPlayersChart"></canvas>
                </div>
            </div>
            <div class="chart-container">
                <canvas id="professionEarningsChart"></canvas>
            </div>
        </div>
        
        <!-- Detailed Statistics Sections -->
        <div class="detailed-report-section">
            <h3>🏆 Top 3 Most Profitable Items</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Item Name</th>
                        <th>Total Quantity</th>
                        <th>Total Value</th>
                        <th>Average Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.topItems).map(([itemName, itemData], index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${itemName}</td>
                            <td>${itemData.totalQuantity}</td>
                            <td>${formatNumber(itemData.totalValue)}</td>
                            <td>${formatNumber(itemData.averageValue)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="detailed-report-section">
            <h3>🥇 Top 3 Highest Earning Players</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Total Share</th>
                        <th>Number of Activities</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.topPlayers).map(([playerName, playerData], index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${playerName}</td>
                            <td>${formatNumber(playerData.totalShare)}</td>
                            <td>${playerData.activityCount}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="detailed-report-section">
            <h3>⏱️ Time Analysis</h3>
            <div class="detailed-report-grid">
                <div class="detailed-report-card">
                    <h4>Shortest Activity</h4>
                    <div class="value">${stats.shortestActivity.time} min</div>
                    <div class="label">${stats.shortestActivity.type} - ${stats.shortestActivity.date}</div>
                </div>
                <div class="detailed-report-card">
                    <h4>Longest Activity</h4>
                    <div class="value">${stats.longestActivity.time} min</div>
                    <div class="label">${stats.longestActivity.type} - ${stats.longestActivity.date}</div>
                </div>
                <div class="detailed-report-card">
                    <h4>Average Time</h4>
                    <div class="value">${Math.round(stats.averageTime)} min</div>
                    <div class="label">Per Activity</div>
                </div>
                <div class="detailed-report-card">
                    <h4>Daily Average</h4>
                    <div class="value">${formatNumber(stats.dailyAverage)}</div>
                    <div class="label">Per Day</div>
                </div>
            </div>
        </div>
        
        <div class="detailed-report-section">
            <h3>💼 Profession Performance</h3>
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Profession</th>
                        <th>Total Earnings</th>
                        <th>Activity Count</th>
                        <th>Average Earnings</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.professionEarnings).map(([profession, profData]) => `
                        <tr>
                            <td>${capitalize(profession)}</td>
                            <td>${formatNumber(profData.totalEarnings)}</td>
                            <td>${profData.activityCount}</td>
                            <td>${formatNumber(profData.averageEarnings)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <script>
            // Render charts after the HTML is loaded
            setTimeout(() => {
                // Get stats data
                const topItems = ${JSON.stringify(stats.topItems)};
                const topPlayers = ${JSON.stringify(stats.topPlayers)};
                const professionEarnings = ${JSON.stringify(stats.professionEarnings)};
                
                // Top Items Chart
                const topItemsCtx = document.getElementById('topItemsChart').getContext('2d');
                const topItemsChart = new Chart(topItemsCtx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(topItems),
                        datasets: [{
                            label: 'Total Value',
                            data: Object.values(topItems).map(item => item.totalValue),
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.8)',
                                'rgba(54, 162, 235, 0.8)',
                                'rgba(255, 205, 86, 0.8)'
                            ],
                            borderColor: [
                                'rgba(255, 99, 132, 1)',
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 205, 86, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: 'Top 3 Most Profitable Items'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        if (value === null || value === undefined) return '0,00';
                                        
                                        // Convert to fixed 2 decimals
                                        const fixed = Number(value).toFixed(2);
                                        const [integer, decimal] = fixed.split('.');
                                        
                                        // Add thousand separators with dots
                                        const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                                        
                                        // Return with comma as decimal separator
                                        return formattedInteger + ',' + decimal;
                                    }
                                }
                            }
                        }
                    }
                });
                
                // Top Players Chart
                const topPlayersCtx = document.getElementById('topPlayersChart').getContext('2d');
                const topPlayersChart = new Chart(topPlayersCtx, {
                    type: 'pie',
                    data: {
                        labels: Object.keys(topPlayers),
                        datasets: [{
                            label: 'Total Share',
                            data: Object.values(topPlayers).map(player => player.totalShare),
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.8)',
                                'rgba(54, 162, 235, 0.8)',
                                'rgba(255, 205, 86, 0.8)'
                            ],
                            borderColor: [
                                'rgba(255, 99, 132, 1)',
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 205, 86, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Top 3 Highest Earning Players'
                            }
                        }
                    }
                });
                
                // Profession Earnings Chart
                const professionCtx = document.getElementById('professionEarningsChart').getContext('2d');
                const professionChart = new Chart(professionCtx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(professionEarnings).map(name => capitalize(name)),
                        datasets: [{
                            label: 'Total Earnings',
                            data: Object.values(professionEarnings).map(prof => prof.totalEarnings),
                            backgroundColor: 'rgba(75, 192, 192, 0.8)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: 'Profession Earnings Comparison'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        if (value === null || value === undefined) return '0,00';
                                        
                                        // Convert to fixed 2 decimals
                                        const fixed = Number(value).toFixed(2);
                                        const [integer, decimal] = fixed.split('.');
                                        
                                        // Add thousand separators with dots
                                        const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                                        
                                        // Return with comma as decimal separator
                                        return formattedInteger + ',' + decimal;
                                    }
                                }
                            }
                        }
                    }
                });
                
                // Capitalize function for charts
                function capitalize(str) {
                    return str.charAt(0).toUpperCase() + str.slice(1);
                }
            }, 100);
        </script>
    `;
    
    return html;
}

// Calculate Item Specific Statistics
function calculateItemStatistics(data, itemName) {
    // Initialize statistics objects
    const stats = {
        itemName: itemName,
        totalQuantity: 0,
        totalValue: 0,
        averageValue: 0,
        appearancesByDate: {},
        appearancesCount: 0,
        mostFrequentDate: { date: 'N/A', count: 0 },
        leastFrequentDate: { date: 'N/A', count: Infinity },
        dailyAverage: 0
    };
    
    // Process each data item
    data.forEach(item => {
        // Process different types of activities for the specific item
        if (item.type === 'gathering' && item.materials && Array.isArray(item.materials)) {
            // For gathering, check materials
            item.materials.forEach(material => {
                if (material.name && material.name.toLowerCase() === itemName.toLowerCase()) {
                    stats.appearancesCount++;
                    stats.totalQuantity += material.amount || 0;
                    stats.totalValue += material.total || 0;
                    
                    // Track appearances by date
                    if (item.date) {
                        if (!stats.appearancesByDate[item.date]) {
                            stats.appearancesByDate[item.date] = 0;
                        }
                        stats.appearancesByDate[item.date]++;
                    }
                }
            });
        } 
        else if (item.type === 'event' && item.materials && Array.isArray(item.materials)) {
            // For events, check materials
            item.materials.forEach(material => {
                if (material.name && material.name.toLowerCase() === itemName.toLowerCase()) {
                    stats.appearancesCount++;
                    stats.totalQuantity += material.amount || 0;
                    stats.totalValue += material.total || 0;
                    
                    // Track appearances by date
                    if (item.date) {
                        if (!stats.appearancesByDate[item.date]) {
                            stats.appearancesByDate[item.date] = 0;
                        }
                        stats.appearancesByDate[item.date]++;
                    }
                }
            });
        } 
        else if ((item.type === 'solo' || item.type === 'team') && item.items && Array.isArray(item.items)) {
            // For farms, check items
            item.items.forEach(farmItem => {
                if (farmItem.name && farmItem.name.toLowerCase() === itemName.toLowerCase()) {
                    stats.appearancesCount++;
                    stats.totalQuantity += farmItem.totalQuantity || 0;
                    stats.totalValue += (farmItem.totalSoldValue || 0) + (farmItem.totalRemainingValue || 0);
                    
                    // Track appearances by date
                    if (item.date) {
                        if (!stats.appearancesByDate[item.date]) {
                            stats.appearancesByDate[item.date] = 0;
                        }
                        stats.appearancesByDate[item.date]++;
                    }
                }
            });
        }
    });
    
    // Calculate averages
    if (stats.appearancesCount > 0) {
        stats.averageValue = stats.totalValue / stats.appearancesCount;
    }
    
    // Find most and least frequent dates
    Object.entries(stats.appearancesByDate).forEach(([date, count]) => {
        if (count > stats.mostFrequentDate.count) {
            stats.mostFrequentDate = { date, count };
        }
        if (count < stats.leastFrequentDate.count) {
            stats.leastFrequentDate = { date, count };
        }
    });
    
    // If no least frequent date found, set to same as most frequent
    if (stats.leastFrequentDate.count === Infinity) {
        stats.leastFrequentDate = { ...stats.mostFrequentDate };
    }
    
    // Calculate daily average
    const dateCount = Object.keys(stats.appearancesByDate).length;
    if (dateCount > 0) {
        stats.dailyAverage = stats.totalQuantity / dateCount;
    }
    
    return stats;
}

// Calculate Player Specific Statistics
function calculatePlayerStatistics(data, playerName) {
    // Initialize statistics objects
    const stats = {
        playerName: playerName,
        totalActivities: 0,
        totalEarnings: 0,
        totalTime: 0,
        totalContribution: 0,
        averageEarnings: 0,
        averageTime: 0,
        participationRate: 0,
        activitiesByDate: {},
        activitiesByType: {},
        totalActivitiesInSystem: 0
    };
    
    // Count total activities in the system where player participation can be verified
    // Currently, only team farms have player identification, so we count those
    stats.totalActivitiesInSystem = data.filter(item => item.type === 'team').length;
    
    // Get the main character from localStorage
    const mainCharacter = getMainCharacter();
    
    // Process each data item
    data.forEach(item => {
        let playerParticipated = false;
        let playerEarnings = 0;
        let playerTime = 0;
        
        // Process different types of activities for the specific player
        if (item.type === 'gathering') {
            // For gathering activities, we can't verify player participation without user identification
            // So we'll not count these activities in player-specific reports
        } 
        else if (item.type === 'event') {
            // For event activities, we can't verify player participation without user identification
            // So we'll not count these activities in player-specific reports
        } 
        else if (item.type === 'upgrade') {
            // For upgrade activities, we can't verify player participation without user identification
            // So we'll not count these activities in player-specific reports
        } 
        else if (item.type === 'other') {
            // For other activities, we can't verify player participation without user identification
            // So we'll not count these activities in player-specific reports
        } 
        else if (item.type === 'solo') {
            // For solo farms, we can't verify player participation without user identification
            // So we'll not count these activities in player-specific reports
        }
        else if (item.type === 'team') {
            // For team farms, check if player is in the members list
            if (item.members && Array.isArray(item.members)) {
                // If we're generating a report for a specific player, check if that player is in the team
                // If we're generating a report for the main character, check if the main character is in the team
                const targetPlayer = playerName === 'main' && mainCharacter ? mainCharacter : playerName;
                
                const playerInTeam = item.members.find(member => 
                    member.nickname && member.nickname.toLowerCase() === targetPlayer.toLowerCase());
                
                if (playerInTeam) {
                    playerParticipated = true;
                    playerTime = item.time || 0;
                    
                    // Calculate player's share
                    const playerShare = playerInTeam.amount || 0;
                    playerEarnings = playerShare;
                    
                    // Calculate contribution percentage
                    const totalValue = item.totalValue || 0;
                    if (totalValue > 0) {
                        stats.totalContribution += (playerShare / totalValue) * 100;
                    }
                }
            }
        }
        
        // Only count activities where the player actually participated
        if (playerParticipated) {
            stats.totalActivities++;
            stats.totalEarnings += playerEarnings;
            stats.totalTime += playerTime;
            
            // Track activities by date
            if (item.date) {
                if (!stats.activitiesByDate[item.date]) {
                    stats.activitiesByDate[item.date] = 0;
                }
                stats.activitiesByDate[item.date]++;
            }
            
            // Track activities by type
            const type = item.type || 'Unknown';
            if (!stats.activitiesByType[type]) {
                stats.activitiesByType[type] = 0;
            }
            stats.activitiesByType[type]++;
        }
    });
    
    // Calculate averages
    if (stats.totalActivities > 0) {
        stats.averageEarnings = stats.totalEarnings / stats.totalActivities;
        stats.averageTime = stats.totalTime / stats.totalActivities;
        stats.averageContribution = stats.totalContribution / stats.totalActivities;
    }
    
    // Calculate participation rate
    if (stats.totalActivitiesInSystem > 0) {
        stats.participationRate = (stats.totalActivities / stats.totalActivitiesInSystem) * 100;
    }
    
    return stats;
}

// Calculate Detailed Statistics
function calculateDetailedStatistics(data) {
    // Initialize statistics objects
    const stats = {
        totalEarnings: 0,
        totalTime: 0,
        topItems: {},
        topPlayers: {},
        shortestActivity: { time: Infinity, type: 'N/A', date: 'N/A' },
        longestActivity: { time: 0, type: 'N/A', date: 'N/A' },
        averageTime: 0,
        dailyAverage: 0,
        professionEarnings: {}
    };
    
    // Process each data item
    data.forEach(item => {
        // Process different types of activities
        if (item.type === 'gathering' && item.materials && Array.isArray(item.materials)) {
            // For gathering, check materials
            item.materials.forEach(material => {
                const itemName = material.name || 'Unknown';
                const quantity = material.amount || 0;
                const value = material.total || 0;
                
                if (!stats.topItems[itemName]) {
                    stats.topItems[itemName] = {
                        totalQuantity: 0,
                        totalValue: 0,
                        averageValue: 0
                    };
                }
                
                stats.topItems[itemName].totalQuantity += quantity;
                stats.topItems[itemName].totalValue += value;
                
                if (stats.topItems[itemName].totalQuantity > 0) {
                    stats.topItems[itemName].averageValue = 
                        stats.topItems[itemName].totalValue / stats.topItems[itemName].totalQuantity;
                }
            });
        } 
        else if (item.type === 'event' && item.materials && Array.isArray(item.materials)) {
            // For events, check materials
            item.materials.forEach(material => {
                const itemName = material.name || 'Unknown';
                const quantity = material.amount || 0;
                const value = material.total || 0;
                
                if (!stats.topItems[itemName]) {
                    stats.topItems[itemName] = {
                        totalQuantity: 0,
                        totalValue: 0,
                        averageValue: 0
                    };
                }
                
                stats.topItems[itemName].totalQuantity += quantity;
                stats.topItems[itemName].totalValue += value;
                
                if (stats.topItems[itemName].totalQuantity > 0) {
                    stats.topItems[itemName].averageValue = 
                        stats.topItems[itemName].totalValue / stats.topItems[itemName].totalQuantity;
                }
            });
        } 
        else if ((item.type === 'solo' || item.type === 'team') && item.items && Array.isArray(item.items)) {
            // For farms, check items
            item.items.forEach(farmItem => {
                const itemName = farmItem.name || 'Unknown';
                const quantity = farmItem.totalQuantity || 0;
                const value = (farmItem.totalSoldValue || 0) + (farmItem.totalRemainingValue || 0);
                
                if (!stats.topItems[itemName]) {
                    stats.topItems[itemName] = {
                        totalQuantity: 0,
                        totalValue: 0,
                        averageValue: 0
                    };
                }
                
                stats.topItems[itemName].totalQuantity += quantity;
                stats.topItems[itemName].totalValue += value;
                
                if (stats.topItems[itemName].totalQuantity > 0) {
                    stats.topItems[itemName].averageValue = 
                        stats.topItems[itemName].totalValue / stats.topItems[itemName].totalQuantity;
                }
            });
        }
        
        // Update total earnings and time
        stats.totalEarnings += item.totalValue || 0;
        stats.totalTime += item.time || 0;
        
        // Update shortest and longest activities
        if (item.time < stats.shortestActivity.time) {
            stats.shortestActivity = { time: item.time, type: item.type, date: item.date };
        }
        if (item.time > stats.longestActivity.time) {
            stats.longestActivity = { time: item.time, type: item.type, date: item.date };
        }
        
        // Update top players
        if (item.members && Array.isArray(item.members)) {
            item.members.forEach(member => {
                const nickname = member.nickname || 'Unknown';
                const amount = member.amount || 0;
                
                if (!stats.topPlayers[nickname]) {
                    stats.topPlayers[nickname] = {
                        totalEarnings: 0,
                        totalActivities: 0,
                        averageEarnings: 0
                    };
                }
                
                stats.topPlayers[nickname].totalEarnings += amount;
                stats.topPlayers[nickname].totalActivities++;
                
                if (stats.topPlayers[nickname].totalActivities > 0) {
                    stats.topPlayers[nickname].averageEarnings = 
                        stats.topPlayers[nickname].totalEarnings / stats.topPlayers[nickname].totalActivities;
                }
            });
        }
        
        // Calculate total earnings and time
        const earnings = item.totalValue || 0;
        const time = item.time || 0;
        
        stats.totalEarnings += earnings;
        stats.totalTime += time;
        
        // Track shortest and longest activities
        if (time < stats.shortestActivity.time) {
            stats.shortestActivity = { time, type: item.type, date: item.date };
        }
        if (time > stats.longestActivity.time) {
            stats.longestActivity = { time, type: item.type, date: item.date };
        }
        
        // Track activities by profession
        const profession = item.profession || 'Unknown';
        if (!stats.professionEarnings[profession]) {
            stats.professionEarnings[profession] = {
                totalEarnings: 0,
                activityCount: 0,
                averageEarnings: 0
            };
        }
        
        stats.professionEarnings[profession].totalEarnings += earnings;
        stats.professionEarnings[profession].activityCount++;
    });
    
    // Calculate averages
    const activityCount = data.length;
    if (activityCount > 0) {
        stats.averageTime = stats.totalTime / activityCount;
    }
    
    // Calculate daily average
    const dateCount = new Set(data.map(item => item.date)).size;
    if (dateCount > 0) {
        stats.dailyAverage = stats.totalTime / dateCount;
    }
    
    // Sort top items and top players
    stats.topItems = Object.fromEntries(
        Object.entries(stats.topItems).sort(([, a], [, b]) => b.totalValue - a.totalValue).slice(0, 3)
    );
    stats.topPlayers = Object.fromEntries(
        Object.entries(stats.professionEarnings).sort(([, a], [, b]) => b.totalEarnings - a.totalEarnings).slice(0, 3)
    );
    
    // Find most profitable item and profession
    stats.mostProfitableItem = Object.entries(stats.topItems).reduce((max, [name, data]) => 
        data.totalValue > max.value ? { name, value: data.totalValue } : max, { name: 'N/A', value: 0 });
    stats.mostProfitableProfession = Object.entries(stats.professionEarnings).reduce((max, [name, data]) => 
        data.totalEarnings > max.value ? { name, value: data.totalEarnings } : max, { name: 'N/A', value: 0 });
    
    return stats;
}

// Format Number with Commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Capitalize String
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Calculate Detailed Statistics
function calculateDetailedStatistics(data) {
    const stats = {
        totalActivities: 0,
        totalContribution: 0,
        averageContribution: 0,
        participationRate: 0,
        activityTypes: {}
    };

    data.forEach(activity => {
        stats.totalActivities++;
        stats.totalContribution += activity.contribution;

        if (!stats.activityTypes[activity.type]) {
            stats.activityTypes[activity.type] = 0;
        }
        stats.activityTypes[activity.type]++;
    });

    if (stats.totalActivities > 0) {
        stats.averageContribution = stats.totalContribution / stats.totalActivities;
    }
    
    // Calculate participation rate
    if (stats.totalActivitiesInSystem > 0) {
        stats.participationRate = (stats.totalActivities / stats.totalActivitiesInSystem) * 100;
    }
    
    return stats;
}

// Calculate Detailed Statistics
function calculateDetailedStatistics(data) {
    // Initialize statistics objects
    const stats = {
        totalEarnings: 0,
        totalTime: 0,
        itemEarnings: {},
        playerShares: {},
        professionEarnings: {},
        shortestActivity: { time: Infinity, type: '', date: '' },
        longestActivity: { time: 0, type: '', date: '' },
        averageTime: 0,
        dailyAverage: 0,
        mostProfitableItem: { name: '', value: 0 },
        mostProfitableProfession: { name: '', value: 0 }
    };
    
    let activityCount = 0;
    let totalValueByDate = {};
    
    // Process each data item
    data.forEach(item => {
        const time = parseInt(item.time) || 0;
        stats.totalTime += time;
        activityCount++;
        
        // Update shortest and longest activities
        if (time < stats.shortestActivity.time && time > 0) {
            stats.shortestActivity = { 
                time: time, 
                type: item.type || 'Unknown', 
                date: item.date || 'Unknown' 
            };
        }
        if (time > stats.longestActivity.time) {
            stats.longestActivity = { 
                time: time, 
                type: item.type || 'Unknown', 
                date: item.date || 'Unknown' 
            };
        }
        
        // Process different types of activities
        if (item.type === 'gathering') {
            // Process gathering data
            const profession = item.profession || 'Unknown';
            if (!stats.professionEarnings[profession]) {
                stats.professionEarnings[profession] = { 
                    totalEarnings: 0, 
                    activityCount: 0, 
                    averageEarnings: 0 
                };
            }
            stats.professionEarnings[profession].activityCount++;
            
            // Process materials
            if (item.materials && Array.isArray(item.materials)) {
                item.materials.forEach(material => {
                    const value = material.total || 0;
                    stats.totalEarnings += value;
                    stats.professionEarnings[profession].totalEarnings += value;
                    
                    // Track item earnings
                    const itemName = material.name || 'Unknown';
                    if (!stats.itemEarnings[itemName]) {
                        stats.itemEarnings[itemName] = { 
                            totalQuantity: 0, 
                            totalValue: 0, 
                            averageValue: 0 
                        };
                    }
                    stats.itemEarnings[itemName].totalQuantity += material.amount || 0;
                    stats.itemEarnings[itemName].totalValue += value;
                    
                    // Check for most profitable item
                    if (value > stats.mostProfitableItem.value) {
                        stats.mostProfitableItem = { 
                            name: itemName, 
                            value: value 
                        };
                    }
                });
            }
        } 
        else if (item.type === 'event') {
            // Process event data
            if (item.materials && Array.isArray(item.materials)) {
                item.materials.forEach(material => {
                    const value = material.total || 0;
                    stats.totalEarnings += value;
                    
                    // Track item earnings
                    const itemName = material.name || 'Unknown';
                    if (!stats.itemEarnings[itemName]) {
                        stats.itemEarnings[itemName] = { 
                            totalQuantity: 0, 
                            totalValue: 0, 
                            averageValue: 0 
                        };
                    }
                    stats.itemEarnings[itemName].totalQuantity += material.amount || 0;
                    stats.itemEarnings[itemName].totalValue += value;
                    
                    // Check for most profitable item
                    if (value > stats.mostProfitableItem.value) {
                        stats.mostProfitableItem = { 
                            name: itemName, 
                            value: value 
                        };
                    }
                });
            }
        } 
        else if (item.type === 'upgrade') {
            // Process upgrade data (costs are negative earnings)
            if (item.items && Array.isArray(item.items)) {
                item.items.forEach(upgrade => {
                    const cost = upgrade.cost || 0;
                    stats.totalEarnings -= cost; // Subtract costs
                });
            }
        } 
        else if (item.type === 'other') {
            // Process other data
            if (item.items && Array.isArray(item.items)) {
                item.items.forEach(other => {
                    const amount = other.amount || 0;
                    stats.totalEarnings += amount;
                });
            }
        } 
        else if (item.type === 'solo' || item.type === 'team') {
            // Process farm data
            const value = item.totalValue || 0;
            stats.totalEarnings += value;
            
            // Track item earnings for farm items
            if (item.items && Array.isArray(item.items)) {
                item.items.forEach(farmItem => {
                    const itemName = farmItem.name || 'Unknown';
                    const itemValue = (farmItem.totalSoldValue || 0) + (farmItem.totalRemainingValue || 0);
                    if (!stats.itemEarnings[itemName]) {
                        stats.itemEarnings[itemName] = { 
                            totalQuantity: 0, 
                            totalValue: 0, 
                            averageValue: 0 
                        };
                    }
                    stats.itemEarnings[itemName].totalQuantity += farmItem.totalQuantity || 0;
                    stats.itemEarnings[itemName].totalValue += itemValue;
                    
                    // Check for most profitable item
                    if (itemValue > stats.mostProfitableItem.value) {
                        stats.mostProfitableItem = { 
                            name: itemName, 
                            value: itemValue 
                        };
                    }
                });
            }
            
            // Track player shares for team farms
            if (item.type === 'team' && item.members && Array.isArray(item.members)) {
                item.members.forEach(member => {
                    const playerName = member.nickname || 'Unknown';
                    const shareValue = member.amount || 0;
                    if (!stats.playerShares[playerName]) {
                        stats.playerShares[playerName] = { 
                            totalShare: 0, 
                            activityCount: 0 
                        };
                    }
                    stats.playerShares[playerName].totalShare += shareValue;
                    stats.playerShares[playerName].activityCount++;
                });
            }
        }
        
        // Track earnings by date for daily average
        if (item.date) {
            if (!totalValueByDate[item.date]) {
                totalValueByDate[item.date] = 0;
            }
            // Add value based on type
            if (item.type === 'gathering' && item.materials) {
                totalValueByDate[item.date] += item.materials.reduce((sum, mat) => sum + (mat.total || 0), 0);
            } else if (item.type === 'event' && item.materials) {
                totalValueByDate[item.date] += item.materials.reduce((sum, mat) => sum + (mat.total || 0), 0);
            } else if (item.type === 'upgrade' && item.items) {
                totalValueByDate[item.date] -= item.items.reduce((sum, upg) => sum + (upg.cost || 0), 0);
            } else if (item.type === 'other' && item.items) {
                totalValueByDate[item.date] += item.items.reduce((sum, other) => sum + (other.amount || 0), 0);
            } else if ((item.type === 'solo' || item.type === 'team') && item.totalValue) {
                totalValueByDate[item.date] += item.totalValue;
            }
        }
    });
    
    // Calculate averages
    if (activityCount > 0) {
        stats.averageTime = stats.totalTime / activityCount;
    }
    
    // Calculate daily average
    const dateCount = Object.keys(totalValueByDate).length;
    if (dateCount > 0) {
        const totalValue = Object.values(totalValueByDate).reduce((sum, value) => sum + value, 0);
        stats.dailyAverage = totalValue / dateCount;
    }
    
    // Calculate average values for items
    Object.keys(stats.itemEarnings).forEach(itemName => {
        const itemData = stats.itemEarnings[itemName];
        if (itemData.totalQuantity > 0) {
            itemData.averageValue = itemData.totalValue / itemData.totalQuantity;
        }
    });
    
    // Calculate average earnings for professions
    Object.keys(stats.professionEarnings).forEach(profession => {
        const profData = stats.professionEarnings[profession];
        if (profData.activityCount > 0) {
            profData.averageEarnings = profData.totalEarnings / profData.activityCount;
        }
        
        // Check for most profitable profession
        if (profData.totalEarnings > stats.mostProfitableProfession.value) {
            stats.mostProfitableProfession = { 
                name: profession, 
                value: profData.totalEarnings 
            };
        }
    });
    
    // Handle edge cases
    if (stats.shortestActivity.time === Infinity) {
        stats.shortestActivity = { time: 0, type: 'None', date: 'None' };
    }
    
    // Get top 3 items by value
    const sortedItems = Object.entries(stats.itemEarnings)
        .sort(([,a], [,b]) => b.totalValue - a.totalValue)
        .slice(0, 3);
    stats.topItems = Object.fromEntries(sortedItems);
    
    // Get top 3 players by share
    const sortedPlayers = Object.entries(stats.playerShares)
        .sort(([,a], [,b]) => b.totalShare - a.totalShare)
        .slice(0, 3);
    stats.topPlayers = Object.fromEntries(sortedPlayers);
    
    return stats;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Format number with thousand separators (Turkish format: 1.000.000,00)
function formatNumber(num) {
    if (num === null || num === undefined) return '0,00';
    
    // Convert to fixed 2 decimals
    const fixed = Number(num).toFixed(2);
    const [integer, decimal] = fixed.split('.');
    
    // Add thousand separators with dots
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Return with comma as decimal separator
    return `${formattedInteger},${decimal}`;
}

// ========== ADMIN FUNCTIONS ==========

// Helper function to get main character with user-specific key
function getMainCharacter() {
    const userSpecificKey = userId ? `mainCharacter_${userId}` : 'mainCharacter';
    return localStorage.getItem(userSpecificKey);
}

// Save Main Character
function saveMainCharacter() {
    const select = document.getElementById('main-character-select');
    const selectedPlayer = select.value;
    
    if (!selectedPlayer) {
        alert('Please select a player!');
        return;
    }
    
    // Save to localStorage with user-specific key
    const userSpecificKey = userId ? `mainCharacter_${userId}` : 'mainCharacter';
    localStorage.setItem(userSpecificKey, selectedPlayer);
    
    // Update UI
    document.getElementById('current-main-character-name').textContent = selectedPlayer;
    document.getElementById('current-main-character').style.display = 'block';
    
    showNotification(`Main character set to: ${selectedPlayer}`);
}

// Load Main Character
function loadMainCharacter() {
    const mainCharacter = getMainCharacter();
    
    if (mainCharacter) {
        document.getElementById('current-main-character-name').textContent = mainCharacter;
        document.getElementById('current-main-character').style.display = 'block';
        
        // Set the select value if the player still exists
        const select = document.getElementById('main-character-select');
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === mainCharacter) {
                select.selectedIndex = i;
                break;
            }
        }
    }
}

// Add Player
function addPlayer() {
    const playerName = document.getElementById('new-player-name').value.trim();
    
    if (!playerName) {
        alert('Please enter a player name!');
        return;
    }
    
    if (!database || !userId) {
        // Check localStorage for existing player (case insensitive)
        const players = JSON.parse(localStorage.getItem('riseOnlinePlayers')) || [];
        const playerExists = players.some(player => player.name.toLowerCase() === playerName.toLowerCase());
        
        if (playerExists) {
            alert('Player with this name already exists!');
            return;
        }
        
        // Save to localStorage if Firebase is not available
        const playerId = Date.now().toString();
        const playerData = {
            id: playerId,
            name: playerName,
            createdAt: new Date().toISOString()
        };
        players.push(playerData);
        localStorage.setItem('riseOnlinePlayers', JSON.stringify(players));
        
        document.getElementById('new-player-name').value = '';
        loadPlayers();
        showNotification(`Player ${playerName} added successfully!`);
        return;
    }
    
    // Check Firebase for existing player (case insensitive)
    const playersRef = database.ref(`users/${userId}/players`);
    playersRef.once('value')
        .then((snapshot) => {
            let playerExists = false;
            snapshot.forEach((childSnapshot) => {
                const player = childSnapshot.val();
                if (player.name.toLowerCase() === playerName.toLowerCase()) {
                    playerExists = true;
                    return true; // Break the loop
                }
            });
            
            if (playerExists) {
                alert('Player with this name already exists!');
                return;
            }
            
            // Add new player
            const playerId = Date.now().toString();
            const playerData = {
                id: playerId,
                name: playerName,
                createdAt: new Date().toISOString()
            };
            
            const playerRef = database.ref(`users/${userId}/players/${playerId}`);
            playerRef.set(playerData)
                .then(() => {
                    console.log('Player added:', playerName);
                    document.getElementById('new-player-name').value = '';
                    loadPlayers();
                    showNotification(`Player ${playerName} added successfully!`);
                })
                .catch((error) => {
                    console.error('Error adding player:', error);
                    alert('Error adding player: ' + error.message);
                });
        })
        .catch((error) => {
            console.error('Error checking existing players:', error);
            alert('Error checking existing players: ' + error.message);
        });
}

// Add Item
function addItem() {
    const itemName = document.getElementById('new-item-name').value.trim();
    
    if (!itemName) {
        alert('Please enter an item name!');
        return;
    }
    
    if (!database || !userId) {
        // Save to localStorage if Firebase is not available
        const items = JSON.parse(localStorage.getItem('riseOnlineItems')) || [];
        const itemId = Date.now().toString();
        const itemData = {
            id: itemId,
            name: itemName,
            createdAt: new Date().toISOString()
        };
        items.push(itemData);
        localStorage.setItem('riseOnlineItems', JSON.stringify(items));
        
        document.getElementById('new-item-name').value = '';
        loadItems();
        showNotification(`Item ${itemName} added successfully!`);
        return;
    }
    
    const itemId = Date.now().toString();
    const itemData = {
        id: itemId,
        name: itemName,
        createdAt: new Date().toISOString()
    };
    
    const itemRef = database.ref(`users/${userId}/items/${itemId}`);
    itemRef.set(itemData)
        .then(() => {
            console.log('Item added:', itemName);
            document.getElementById('new-item-name').value = '';
            loadItems();
            showNotification(`Item ${itemName} added successfully!`);
        })
        .catch((error) => {
            console.error('Error adding item:', error);
            alert('Error adding item: ' + error.message);
        });
}

// Load Players
function loadPlayers() {
    if (!database || !userId) {
        console.log('Firebase not available for loading players, trying localStorage');
        // Try to load from localStorage as fallback
        const players = JSON.parse(localStorage.getItem('riseOnlinePlayers')) || [];
        displayPlayers(players);
        return;
    }
    
    const playersRef = database.ref(`users/${userId}/players`);
    playersRef.once('value')
        .then((snapshot) => {
            const players = [];
            snapshot.forEach((childSnapshot) => {
                players.push(childSnapshot.val());
            });
            
            displayPlayers(players);
        })
        .catch((error) => {
            console.error('Error loading players:', error);
            // Try localStorage fallback on error
            const players = JSON.parse(localStorage.getItem('riseOnlinePlayers')) || [];
            displayPlayers(players);
        });
}

// Load Items
function loadItems() {
    if (!database || !userId) {
        console.log('Firebase not available for loading items, trying localStorage');
        // Try to load from localStorage as fallback
        const items = JSON.parse(localStorage.getItem('riseOnlineItems')) || [];
        displayItems(items);
        return;
    }
    
    const itemsRef = database.ref(`users/${userId}/items`);
    itemsRef.once('value')
        .then((snapshot) => {
            const items = [];
            snapshot.forEach((childSnapshot) => {
                items.push(childSnapshot.val());
            });
            
            displayItems(items);
        })
        .catch((error) => {
            console.error('Error loading items:', error);
            // Try localStorage fallback on error
            const items = JSON.parse(localStorage.getItem('riseOnlineItems')) || [];
            displayItems(items);
        });
}

// Display Players
function displayPlayers(players) {
    const container = document.getElementById('players-list');
    
    if (players.length === 0) {
        container.innerHTML = '<p>No players added yet.</p>';
        return;
    }
    
    // Sort by name
    players.sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = players.map(player => `
        <div class="item-row">
            <span class="item-name">${player.name}</span>
            <button class="remove-item-btn" onclick="removePlayer('${player.id}')">Remove</button>
            <button class="report-btn" onclick="generatePlayerReport('${player.name}')">Report</button>
        </div>
    `).join('');
    
    // Update main character select dropdown
    const select = document.getElementById('main-character-select');
    const currentValue = select.value;
    
    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add players to the select dropdown
    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.name;
        option.textContent = player.name;
        select.appendChild(option);
    });
    
    // Restore selected value if it still exists
    if (currentValue) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === currentValue) {
                select.selectedIndex = i;
                break;
            }
        }
    }
}

// Display Items
function displayItems(items) {
    const container = document.getElementById('items-list');
    
    if (items.length === 0) {
        container.innerHTML = '<p>No items added yet.</p>';
        return;
    }
    
    // Sort by name
    items.sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = items.map(item => `
        <div class="item-row">
            <span class="item-name">${item.name}</span>
            <button class="remove-item-btn" onclick="removeItem('${item.id}')">Remove</button>
            <button class="report-btn" onclick="generateItemReport('${item.name}')">Report</button>
        </div>
    `).join('');
}

// Remove Player
function removePlayer(playerId) {
    if (!confirm('Are you sure you want to remove this player?')) {
        return;
    }
    
    if (!database || !userId) {
        // Remove from localStorage if Firebase is not available
        const players = JSON.parse(localStorage.getItem('riseOnlinePlayers')) || [];
        const updatedPlayers = players.filter(player => player.id !== playerId);
        localStorage.setItem('riseOnlinePlayers', JSON.stringify(updatedPlayers));
        
        loadPlayers();
        showNotification('Player removed successfully!');
        return;
    }
    
    const playerRef = database.ref(`users/${userId}/players/${playerId}`);
    playerRef.remove()
        .then(() => {
            console.log('Player removed:', playerId);
            loadPlayers();
            showNotification('Player removed successfully!');
        })
        .catch((error) => {
            console.error('Error removing player:', error);
            alert('Error removing player: ' + error.message);
        });
}

// Remove Item
function removeItem(itemId) {
    if (!confirm('Are you sure you want to remove this item?')) {
        return;
    }
    
    if (!database || !userId) {
        // Remove from localStorage if Firebase is not available
        const items = JSON.parse(localStorage.getItem('riseOnlineItems')) || [];
        const updatedItems = items.filter(item => item.id !== itemId);
        localStorage.setItem('riseOnlineItems', JSON.stringify(updatedItems));
        
        loadItems();
        showNotification('Item removed successfully!');
        return;
    }
    
    const itemRef = database.ref(`users/${userId}/items/${itemId}`);
    itemRef.remove()
        .then(() => {
            console.log('Item removed:', itemId);
            loadItems();
            showNotification('Item removed successfully!');
        })
        .catch((error) => {
            console.error('Error removing item:', error);
            alert('Error removing item: ' + error.message);
        });
}

// Load Admin Data when Admin tab is opened
function loadAdminData() {
    loadPlayers();
    loadItems();
    loadMainCharacter();
}

// Global variable to store current report data
let currentReportData = null;

// ========== FARM FUNCTIONS ==========

// Open Farm Type Modal
function openFarmType(type) {
    console.log('Opening farm modal for type:', type, 'Current date:', currentDate);
    if (type === 'solo') {
        document.getElementById('solo-farm-modal').style.display = 'block';
        document.getElementById('solo-farm-date').value = currentDate || getLocalDateString();
        console.log('Solo farm date set to:', document.getElementById('solo-farm-date').value);
    } else if (type === 'team') {
        document.getElementById('team-farm-modal').style.display = 'block';
        document.getElementById('team-farm-date').value = currentDate || getLocalDateString();
        console.log('Team farm date set to:', document.getElementById('team-farm-date').value);
    }
}

// Close Farm Modal
function closeFarmModal() {
    document.getElementById('solo-farm-modal').style.display = 'none';
    document.getElementById('team-farm-modal').style.display = 'none';
    
    // Clear forms
    document.getElementById('solo-items-container').innerHTML = '';
    document.getElementById('team-items-container').innerHTML = '';
    document.getElementById('team-members-container').innerHTML = '';
}

// Add Solo Farm Item
function addSoloFarmItem(itemData = null) {
    const container = document.getElementById('solo-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'farm-item';
    itemDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        <button class="duplicate-btn" onclick="duplicateFarmItem(this)" title="Duplicate this item">+</button>
        <div class="form-group">
            <label>Item Name:</label>
            <input type="text" class="item-autocomplete" placeholder="Start typing item name..." value="${itemData?.name || ''}" oninput="showItemSuggestions(this)">
            <div class="suggestions-dropdown" style="display: none;"></div>
        </div>
        <div class="form-group">
            <label>Total Quantity (Total Farmed):</label>
            <input type="number" class="item-quantity" min="1" placeholder="e.g., 10" value="${itemData?.totalQuantity || ''}" required>
        </div>
        <div class="form-group">
            <label>Estimated Value (per item):</label>
            <input type="number" class="item-value" min="0" step="0.01" placeholder="Value per item" value="${itemData?.estimatedValue || ''}">
        </div>
        <div class="form-group">
            <label>Sold Quantity (How many sold?):</label>
            <input type="number" class="sold-quantity" min="0" placeholder="e.g., 3 out of 10" value="${itemData?.soldQuantity || 0}" oninput="validateSoldQuantity(this)">
        </div>
        <div class="form-group sold-price-group" style="display: ${(itemData?.soldQuantity || 0) > 0 ? 'block' : 'none'};">
            <label>Sold Price (per item):</label>
            <input type="number" class="sold-price" min="0" step="0.01" placeholder="Price per sold item" value="${itemData?.soldPrice || ''}">
        </div>
    `;
    
    // Toggle sold price field when sold quantity changes
    const soldQtyInput = itemDiv.querySelector('.sold-quantity');
    soldQtyInput.addEventListener('input', function() {
        const soldPriceGroup = itemDiv.querySelector('.sold-price-group');
        soldPriceGroup.style.display = this.value > 0 ? 'block' : 'none';
    });
    
    container.appendChild(itemDiv);
}

// Show Player Suggestions
function showPlayerSuggestions(input) {
    const dropdown = input.nextElementSibling; // suggestions-dropdown
    const searchTerm = input.value.toLowerCase().trim();
    
    // Clear previous suggestions
    dropdown.innerHTML = '';
    
    if (searchTerm.length < 2) {
        dropdown.style.display = 'none';
        return;
    }
    
    if (!database || !userId) {
        dropdown.style.display = 'none';
        return;
    }
    
    const playersRef = database.ref(`users/${userId}/players`);
    playersRef.once('value')
        .then((snapshot) => {
            const players = [];
            snapshot.forEach((childSnapshot) => {
                players.push(childSnapshot.val());
            });
            
            // Filter players by search term
            const filteredPlayers = players.filter(player => 
                player.name.toLowerCase().includes(searchTerm)
            );
            
            if (filteredPlayers.length === 0) {
                dropdown.style.display = 'none';
                return;
            }
            
            // Show suggestions
            filteredPlayers.forEach(player => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = player.name;
                div.onclick = () => {
                    input.value = player.name;
                    dropdown.style.display = 'none';
                    updateTeamShares();
                };
                dropdown.appendChild(div);
            });
            
            dropdown.style.display = 'block';
        })
        .catch((error) => {
            console.error('Error loading players for suggestions:', error);
            dropdown.style.display = 'none';
        });
}

// Show Item Suggestions
function showItemSuggestions(input) {
    const dropdown = input.nextElementSibling; // suggestions-dropdown
    const searchTerm = input.value.toLowerCase().trim();
    
    // Clear previous suggestions
    dropdown.innerHTML = '';
    
    if (searchTerm.length < 2) {
        dropdown.style.display = 'none';
        return;
    }
    
    if (!database || !userId) {
        dropdown.style.display = 'none';
        return;
    }
    
    const itemsRef = database.ref(`users/${userId}/items`);
    itemsRef.once('value')
        .then((snapshot) => {
            const items = [];
            snapshot.forEach((childSnapshot) => {
                items.push(childSnapshot.val());
            });
            
            // Filter items by search term
            const filteredItems = items.filter(item => 
                item.name.toLowerCase().includes(searchTerm)
            );
            
            if (filteredItems.length === 0) {
                dropdown.style.display = 'none';
                return;
            }
            
            // Show suggestions
            filteredItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = item.name;
                div.onclick = () => {
                    input.value = item.name;
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(div);
            });
            
            dropdown.style.display = 'block';
        })
        .catch((error) => {
            console.error('Error loading items for suggestions:', error);
            dropdown.style.display = 'none';
        });
}

// Hide suggestions when clicking outside
document.addEventListener('click', function(event) {
    const suggestions = document.querySelectorAll('.suggestions-dropdown');
    suggestions.forEach(dropdown => {
        if (!dropdown.contains(event.target) && !event.target.classList.contains('player-autocomplete') && !event.target.classList.contains('item-autocomplete')) {
            dropdown.style.display = 'none';
        }
    });
});

// Load Items into Select Dropdown
function loadItemsIntoSelect(selectElement) {
    if (!database || !userId) {
        console.log('Firebase not available for loading items into select');
        return;
    }
    
    const itemsRef = database.ref(`users/${userId}/items`);
    itemsRef.once('value')
        .then((snapshot) => {
            const items = [];
            snapshot.forEach((childSnapshot) => {
                items.push(childSnapshot.val());
            });
            
            // Sort by name
            items.sort((a, b) => a.name.localeCompare(b.name));
            
            // Add items to select
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.name;
                option.textContent = item.name;
                selectElement.appendChild(option);
            });
        })
        .catch((error) => {
            console.error('Error loading items into select:', error);
        });
}

// Validate sold quantity doesn't exceed total quantity
function validateSoldQuantity(input) {
    const itemDiv = input.closest('.farm-item');
    const totalQty = parseInt(itemDiv.querySelector('.item-quantity').value) || 0;
    const soldQty = parseInt(input.value) || 0;
    
    if (soldQty > totalQty) {
        alert(`Sold quantity (${soldQty}) cannot exceed total quantity (${totalQty})!`);
        input.value = totalQty;
    }
}

// Duplicate farm item
function duplicateFarmItem(button) {
    const itemDiv = button.parentElement;
    // Get item name from autocomplete input
    const input = itemDiv.querySelector('.item-autocomplete');
    const itemName = input.value;
    const itemValue = itemDiv.querySelector('.item-value').value;
    const itemQty = itemDiv.querySelector('.item-quantity')?.value || 1;
    
    if (!itemName) {
        alert('Please fill in item name first!');
        return;
    }
    
    const itemData = {
        name: itemName,
        totalQuantity: parseInt(itemQty) || 1,
        estimatedValue: parseFloat(itemValue) || 0,
        soldQuantity: 0,
        soldPrice: 0
    };
    
    // Determine which container to use
    const container = itemDiv.parentElement;
    if (container.id === 'solo-items-container') {
        addSoloFarmItem(itemData);
    } else if (container.id === 'team-items-container') {
        addTeamFarmItem(itemData);
    }
}

// Add Team Member
function addTeamMember(paidStatus = false) {
    const container = document.getElementById('team-members-container');
    const memberDiv = document.createElement('div');
    memberDiv.className = 'team-member-item';
    memberDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove(); updateTeamShares()">Remove</button>
        <div class="form-group">
            <label>Player Nickname:</label>
            <input type="text" class="player-autocomplete" placeholder="Start typing player name..." oninput="showPlayerSuggestions(this)">
            <div class="suggestions-dropdown" style="display: none;"></div>
        </div>
        <div class="form-group">
            <label>Share Percentage:</label>
            <input type="number" step="0.01" placeholder="Auto calculated" readonly class="share-input">
        </div>
        <div class="form-group">
            <label>Payment Status:</label>
            <button type="button" class="payment-toggle-btn ${paidStatus ? 'paid' : 'unpaid'}" 
                    onclick="togglePaymentStatus(this)">
                ${paidStatus ? '✅ Paid' : '⏳ Unpaid'}
            </button>
            <input type="hidden" class="paid-status" value="${paidStatus}">
        </div>
    `;
    
    // Set the paid status in the dataset
    memberDiv.dataset.paid = paidStatus;
    
    container.appendChild(memberDiv);
    updateTeamShares();
}

// Load Players into Select Dropdown
function loadPlayersIntoSelect(selectElement) {
    if (!database || !userId) {
        console.log('Firebase not available for loading players into select');
        return;
    }
    
    const playersRef = database.ref(`users/${userId}/players`);
    playersRef.once('value')
        .then((snapshot) => {
            const players = [];
            snapshot.forEach((childSnapshot) => {
                players.push(childSnapshot.val());
            });
            
            // Sort by name
            players.sort((a, b) => a.name.localeCompare(b.name));
            
            // Add players to select
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player.name;
                option.textContent = player.name;
                selectElement.appendChild(option);
            });
        })
        .catch((error) => {
            console.error('Error loading players into select:', error);
        });
}

// Toggle payment status for team member
function togglePaymentStatus(button) {
    const memberDiv = button.closest('.team-member-item');
    const isPaid = memberDiv.dataset.paid === 'true';
    const newPaidStatus = !isPaid;
    
    // Update dataset
    memberDiv.dataset.paid = newPaidStatus;
    
    // Update button text and class
    button.textContent = newPaidStatus ? '✅ Paid' : '⏳ Unpaid';
    button.className = newPaidStatus ? 'payment-toggle-btn paid' : 'payment-toggle-btn unpaid';
    
    // Update hidden input
    const hiddenInput = memberDiv.querySelector('.paid-status');
    if (hiddenInput) {
        hiddenInput.value = newPaidStatus;
    }
}

// Update team shares automatically (equal distribution)
function updateTeamShares() {
    const container = document.getElementById('team-members-container');
    const members = container.querySelectorAll('.team-member-item');
    const memberCount = members.length;
    
    if (memberCount === 0) return;
    
    const sharePerMember = 100 / memberCount;
    
    members.forEach(member => {
        const shareInput = member.querySelector('.share-input');
        shareInput.value = sharePerMember.toFixed(2);
    });
}

// Add Team Farm Item
function addTeamFarmItem(itemData = null) {
    const container = document.getElementById('team-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'farm-item';
    itemDiv.innerHTML = `
        <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        <button class="duplicate-btn" onclick="duplicateFarmItem(this)" title="Duplicate this item">+</button>
        <div class="form-group">
            <label>Item Name:</label>
            <input type="text" class="item-autocomplete" placeholder="Start typing item name..." value="${itemData?.name || ''}" oninput="showItemSuggestions(this)">
            <div class="suggestions-dropdown" style="display: none;"></div>
        </div>
        <div class="form-group">
            <label>Total Quantity (Total Farmed):</label>
            <input type="number" class="item-quantity" min="1" placeholder="e.g., 10" value="${itemData?.totalQuantity || ''}" required>
        </div>
        <div class="form-group">
            <label>Estimated Value (per item):</label>
            <input type="number" class="item-value" min="0" step="0.01" placeholder="Value per item" value="${itemData?.estimatedValue || ''}">
        </div>
        <div class="form-group">
            <label>Sold Quantity (How many sold?):</label>
            <input type="number" class="sold-quantity" min="0" placeholder="e.g., 3 out of 10" value="${itemData?.soldQuantity || 0}" oninput="validateSoldQuantity(this)">
        </div>
        <div class="form-group sold-price-group" style="display: ${(itemData?.soldQuantity || 0) > 0 ? 'block' : 'none'};">
            <label>Sold Price (per item):</label>
            <input type="number" class="sold-price" min="0" step="0.01" placeholder="Price per sold item" value="${itemData?.soldPrice || ''}">
        </div>
    `;
    
    // Toggle sold price field when sold quantity changes
    const soldQtyInput = itemDiv.querySelector('.sold-quantity');
    soldQtyInput.addEventListener('input', function() {
        const soldPriceGroup = itemDiv.querySelector('.sold-price-group');
        soldPriceGroup.style.display = this.value > 0 ? 'block' : 'none';
    });
    
    container.appendChild(itemDiv);
}

// Save Solo Farm
function saveSoloFarm() {
    const date = document.getElementById('solo-farm-date').value;
    const time = parseInt(document.getElementById('solo-farm-time').value) || 0;
    const location = document.getElementById('solo-farm-location').value;
    const modal = document.getElementById('solo-farm-modal');
    const editId = modal.dataset.editId;
    
    // Debug: Show save date
    console.log('Saving solo farm with date:', date);
    
    if (!date || !location) {
        alert('Please fill in date and location!');
        return;
    }
    
    const itemsContainer = document.getElementById('solo-items-container');
    const items = [];
    
    itemsContainer.querySelectorAll('.farm-item').forEach(item => {
        // Get item name from autocomplete input
        const input = item.querySelector('.item-autocomplete');
        const itemName = input.value;
        const totalQty = parseInt(item.querySelector('.item-quantity').value) || 0;
        const value = parseFloat(item.querySelector('.item-value').value) || 0;
        const soldQty = parseInt(item.querySelector('.sold-quantity').value) || 0;
        const soldPrice = soldQty > 0 ? (parseFloat(item.querySelector('.sold-price').value) || 0) : 0;
        
        if (itemName && totalQty > 0) {
            const remainingQty = totalQty - soldQty;
            items.push({
                name: itemName,
                totalQuantity: totalQty,
                soldQuantity: soldQty,
                remainingQuantity: remainingQty,
                estimatedValue: value,
                soldPrice: soldPrice,
                totalEstimatedValue: totalQty * value,
                totalSoldValue: soldQty * soldPrice,
                totalRemainingValue: remainingQty * value
            });
        }
    });
    
    if (items.length === 0) {
        alert('Please add at least one item!');
        return;
    }
    
    const totalValue = items.reduce((sum, item) => sum + item.totalSoldValue + item.totalRemainingValue, 0);
    
    const farmData = {
        id: editId || Date.now().toString(),
        date: date,
        type: 'solo',
        time: time,
        location: location,
        items: items,
        totalValue: totalValue
    };
    
    // Save or update to Firebase
    if (editId) {
        updateFarmInFirebase(farmData);
    } else {
        saveFarmToFirebase(farmData);
    }
    
    // Clear edit mode
    delete modal.dataset.editId;
    
    closeFarmModal();
    // Reload farm records for the current date
    loadDataForDate();
    showNotification(editId ? 'Solo farm updated successfully!' : 'Solo farm saved successfully!');
}

// Save Team Farm
function saveTeamFarm() {
    const date = document.getElementById('team-farm-date').value;
    const time = parseInt(document.getElementById('team-farm-time').value) || 0;
    const location = document.getElementById('team-farm-location').value;
    const modal = document.getElementById('team-farm-modal');
    const editId = modal.dataset.editId;
    
    // Debug: Show save date
    console.log('Saving team farm with date:', date);
    
    if (!date || !location) {
        alert('Please fill in date and location!');
        return;
    }
    
    // Get team members
    const membersContainer = document.getElementById('team-members-container');
    const members = [];
    const memberNames = []; // To track duplicate names
    
    membersContainer.querySelectorAll('.team-member-item').forEach(member => {
        // Get nickname from autocomplete input
        const input = member.querySelector('.player-autocomplete');
        const nickname = input.value;
        const share = parseFloat(member.querySelector('.share-input').value) || 0;
        const paid = member.dataset.paid === 'true';
        
        if (nickname && share > 0) {
            // Check for duplicate player in the same team
            if (memberNames.includes(nickname.toLowerCase())) {
                alert(`Player "${nickname}" is already added to this team farm! Each player can only be added once.`);
                throw new Error('Duplicate player in team');
            }
            
            memberNames.push(nickname.toLowerCase());
            members.push({
                nickname: nickname,
                share: share,
                paid: paid
            });
        }
    });
    
    if (members.length === 0) {
        alert('Please add at least one team member!');
        return;
    }
    
    // Get items (each item is separate now)
    const itemsContainer = document.getElementById('team-items-container');
    const items = [];
    
    itemsContainer.querySelectorAll('.farm-item').forEach(item => {
        // Get item name from autocomplete input
        const input = item.querySelector('.item-autocomplete');
        const itemName = input.value;
        const totalQty = parseInt(item.querySelector('.item-quantity').value) || 0;
        const value = parseFloat(item.querySelector('.item-value').value) || 0;
        const soldQty = parseInt(item.querySelector('.sold-quantity').value) || 0;
        const soldPrice = soldQty > 0 ? (parseFloat(item.querySelector('.sold-price').value) || 0) : 0;
        
        if (itemName && totalQty > 0) {
            const remainingQty = totalQty - soldQty;
            items.push({
                name: itemName,
                totalQuantity: totalQty,
                soldQuantity: soldQty,
                remainingQuantity: remainingQty,
                estimatedValue: value,
                soldPrice: soldPrice,
                totalEstimatedValue: totalQty * value,
                totalSoldValue: soldQty * soldPrice,
                totalRemainingValue: remainingQty * value
            });
        }
    });
    
    if (items.length === 0) {
        alert('Please add at least one item!');
        return;
    }
    
    const totalValue = items.reduce((sum, item) => sum + item.totalSoldValue + item.totalRemainingValue, 0);
    
    // Calculate share per member
    members.forEach(member => {
        member.amount = (totalValue * member.share) / 100;
    });
    
    const farmData = {
        id: editId || Date.now().toString(),
        date: date,
        type: 'team',
        time: time,
        location: location,
        members: members,
        items: items,
        totalValue: totalValue
    };
    
    // Save or update to Firebase
    if (editId) {
        updateFarmInFirebase(farmData);
    } else {
        saveFarmToFirebase(farmData);
    }
    
    // Clear edit mode
    delete modal.dataset.editId;
    
    closeFarmModal();
    // Reload farm records for the current date
    loadDataForDate();
    showNotification(editId ? 'Team farm updated successfully!' : 'Team farm saved successfully!');
}

// Save Farm to Firebase
function saveFarmToFirebase(farmData) {
    if (!database || !userId) {
        console.log('Firebase not available, saving to localStorage only');
        saveFarmToLocalStorage(farmData);
        return;
    }
    
    // Save to farms collection (for listing all farms)
    const farmRef = database.ref(`users/${userId}/farms/${farmData.id}`);
    farmRef.set(farmData)
        .then(() => {
            console.log('Farm saved to Firebase');
            saveFarmToLocalStorage(farmData);
        })
        .catch((error) => {
            console.error('Error saving farm:', error);
            saveFarmToLocalStorage(farmData);
        });
    
    // Also save to date-based data structure (like other tabs)
    const dateRef = database.ref(`users/${userId}/data/${farmData.date}/farm/${farmData.id}`);
    dateRef.set(farmData)
        .catch((error) => {
            console.error('Error saving farm to date structure:', error);
        });
}

// Update Farm in Firebase
function updateFarmInFirebase(farmData) {
    if (!database || !userId) {
        console.log('Firebase not available, updating in localStorage only');
        updateFarmInLocalStorage(farmData);
        return;
    }
    
    // Update in farms collection
    const farmRef = database.ref(`users/${userId}/farms/${farmData.id}`);
    farmRef.set(farmData)
        .then(() => {
            console.log('Farm updated in Firebase');
            updateFarmInLocalStorage(farmData);
        })
        .catch((error) => {
            console.error('Error updating farm:', error);
            updateFarmInLocalStorage(farmData);
        });
    
    // Also update in date-based data structure
    const dateRef = database.ref(`users/${userId}/data/${farmData.date}/farm/${farmData.id}`);
    dateRef.set(farmData)
        .catch((error) => {
            console.error('Error updating farm in date structure:', error);
        });
}

// Save Farm to LocalStorage
function saveFarmToLocalStorage(farmData) {
    let farms = JSON.parse(localStorage.getItem('riseOnlineFarms')) || [];
    farms.push(farmData);
    localStorage.setItem('riseOnlineFarms', JSON.stringify(farms));
}

// Update Farm in LocalStorage
function updateFarmInLocalStorage(farmData) {
    let farms = JSON.parse(localStorage.getItem('riseOnlineFarms')) || [];
    const index = farms.findIndex(f => f.id === farmData.id);
    if (index !== -1) {
        farms[index] = farmData;
    } else {
        farms.push(farmData);
    }
    localStorage.setItem('riseOnlineFarms', JSON.stringify(farms));
}

// Load Farm Records
function loadFarmRecords() {
    // Check if user is authenticated
    if (!userId) {
        console.log('User not authenticated yet, cannot load farm records');
        return;
    }
    
    // Check if we're loading for a specific date
    const targetDate = currentDate || new Date().toISOString().split('T')[0];
    
    // Debug: Show target date
    console.log('Loading farm records for date:', targetDate);
    
    const container = document.getElementById('farm-records-container');
    
    if (!database || !userId) {
        console.log('Using localStorage for farm records');
        loadFarmsFromLocalStorageForDate(targetDate);
        return;
    }
    
    // Load ONLY from date-based structure for the specific date
    const dateRef = database.ref(`users/${userId}/data/${targetDate}/farm`);
    console.log('Loading farms from Firebase path:', dateRef.toString());
    
    dateRef.once('value')
        .then((snapshot) => {
            const farms = [];
            snapshot.forEach((childSnapshot) => {
                farms.push(childSnapshot.val());
            });
            
            console.log('Farms loaded for date', targetDate, ':', farms);
            
            // Sort by date descending
            farms.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Store farms globally for filtering
            window.currentFarms = farms;
            window._loadingFreshFarmData = true;
            displayFarmRecords(farms);
        })
        .catch((error) => {
            console.error('Error loading farms for date:', error);
            // Fallback to localStorage
            console.log('Falling back to localStorage');
            loadFarmsFromLocalStorageForDate(targetDate);
        });
}

// Load Farms from LocalStorage
function loadFarmsFromLocalStorage() {
    const farms = JSON.parse(localStorage.getItem('riseOnlineFarms')) || [];
    // Store farms globally for filtering
    window.currentFarms = farms;
    window._loadingFreshFarmData = true;
    displayFarmRecords(farms);
}

// Load farms from localStorage for specific date
function loadFarmsFromLocalStorageForDate(targetDate) {
    const allFarms = JSON.parse(localStorage.getItem('riseOnlineFarms')) || [];
    console.log('All farms in localStorage:', allFarms);
    console.log('Filtering for date:', targetDate);
    
    // Ensure targetDate is in the correct format (YYYY-MM-DD)
    const formattedTargetDate = targetDate instanceof Date ? 
        targetDate.toISOString().split('T')[0] : 
        targetDate;
    
    console.log('Formatted target date:', formattedTargetDate);
    
    // Filter farms by date, ensuring proper comparison
    const farms = allFarms.filter(farm => {
        // Ensure farm.date is in the correct format (YYYY-MM-DD)
        const farmDate = farm.date instanceof Date ? 
            farm.date.toISOString().split('T')[0] : 
            farm.date;
        
        console.log('Comparing farm date:', farmDate, 'with target:', formattedTargetDate);
        return farmDate === formattedTargetDate;
    });
    
    console.log('Filtered farms:', farms);
    
    // Sort by date descending
    farms.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Store farms globally for filtering
    window.currentFarms = farms;
    window._loadingFreshFarmData = true;
    displayFarmRecords(farms);
}

// Fallback to load all farms (not date-specific)
function loadAllFarms() {
    if (!database || !userId) {
        loadFarmsFromLocalStorage();
        return;
    }
    
    const farmsRef = database.ref(`users/${userId}/farms`);
    farmsRef.once('value')
        .then((snapshot) => {
            const farms = [];
            snapshot.forEach((childSnapshot) => {
                farms.push(childSnapshot.val());
            });
            
            // Sort by date descending
            farms.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Store farms globally for filtering
            window.currentFarms = farms;
            window._loadingFreshFarmData = true;
            displayFarmRecords(farms);
        })
        .catch((error) => {
            console.error('Error loading all farms:', error);
            loadFarmsFromLocalStorage();
        });
}

// Display Farm Records
function displayFarmRecords(farms) {
    const container = document.getElementById('farm-records-container');
    
    console.log('Displaying farm records:', farms);
    
    // Only set window.currentFarms if it's not already set or if we're loading fresh data
    // This prevents filtered data from overwriting the original dataset
    if (!window.currentFarms || window._loadingFreshFarmData) {
        window.currentFarms = farms;
        window._loadingFreshFarmData = false;
    }
    
    if (farms.length === 0) {
        container.innerHTML = '<p>No farm records found for this date.</p>';
        return;
    }
    
    // Sort by date descending
    farms.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = farms.map(farm => `
        <div class="farm-record" data-farm-id="${farm.id}">
            <div class="farm-record-header">
                <div>
                    <span class="farm-record-type ${farm.type}">${farm.type === 'solo' ? '👤 Solo Farm' : '👥 Team Farm'}</span>
                    <h4>${farm.location}</h4>
                    <p>${farm.date} • ${farm.time} minutes</p>
                </div>
                <div>
                    <h3>${formatNumber(farm.totalValue)}</h3>
                    <p>Total Value</p>
                    <button class="edit-farm-btn" onclick="editFarm('${farm.id}')">✏️ Edit</button>
                    <button class="delete-farm-btn" onclick="deleteFarm('${farm.id}')">🗑️ Delete</button>
                </div>
            </div>
            
            ${farm.type === 'team' ? `
                <div class="team-members-list">
                    ${farm.members.map(member => `
                        <div class="team-member-badge ${member.paid ? 'paid' : 'unpaid'}">
                            ${member.nickname} (${member.share}%) - ${formatNumber(member.amount)}
                            <span class="payment-status ${member.paid ? 'paid' : 'unpaid'}">
                                ${member.paid ? '✓ Paid' : '⏳ Unpaid'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="farm-items-list">
                <h5>Items:</h5>
                ${farm.items.map(item => `
                    <div class="farm-item-row">
                        <span class="item-name"><strong>${item.name}</strong></span>
                        <div class="item-quantities">
                            <div class="total-quantity">
                                <span class="quantity-label">Total:</span>
                                <span class="quantity-value">${item.totalQuantity}</span>
                            </div>
                            <div class="sold-quantity">
                                <span class="quantity-label">Sold:</span>
                                <span class="quantity-value">${item.soldQuantity}</span>
                            </div>
                            <div class="remaining-quantity">
                                <span class="quantity-label">Remaining:</span>
                                <span class="quantity-value">${item.remainingQuantity}</span>
                            </div>
                        </div>
                        <div class="item-prices">
                            <div class="estimated-value">
                                <span class="price-label">Est. Value:</span>
                                <span class="price-value">${formatNumber(item.estimatedValue)}</span>
                            </div>
                            <div class="sold-price">
                                <span class="price-label">Sold Price:</span>
                                <span class="price-value">${formatNumber(item.soldPrice)}</span>
                            </div>
                            <div class="total-value">
                                <span class="price-label">💰 Total:</span>
                                <span class="price-value">${formatNumber(item.totalSoldValue + item.totalRemainingValue)}</span>
                            </div>
                        </div>
                        <span class="payment-status ${item.soldQuantity > 0 ? 'paid' : 'unpaid'}">
                            ${item.soldQuantity > 0 ? '✓ Partially Sold' : '⏳ Not Sold'}
                        </span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Delete Farm Record
function deleteFarm(farmId) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this farm record? This action cannot be undone.')) {
        return;
    }
    
    // Delete from Firebase if available
    if (database && userId) {
        // Delete from farms collection
        const farmRef = database.ref(`users/${userId}/farms/${farmId}`);
        farmRef.remove()
            .then(() => {
                console.log('Farm record removed from farms collection:', farmId);
                
                // Also delete from date-based data structure
                // We need to find the date for this farm to delete from the correct location
                const farmRecord = window.currentFarms.find(f => f.id === farmId);
                if (farmRecord) {
                    const dateRef = database.ref(`users/${userId}/data/${farmRecord.date}/farm/${farmId}`);
                    dateRef.remove()
                        .then(() => {
                            console.log('Farm record removed from date structure:', farmId);
                        })
                        .catch((error) => {
                            console.error('Error removing farm from date structure:', error);
                        });
                }
                
                // Reload farm records
                loadDataForDate();
                showNotification('Farm record deleted successfully!');
            })
            .catch((error) => {
                console.error('Error removing farm:', error);
                showNotification('Error deleting farm record: ' + error.message);
            });
    }
    
    // Delete from localStorage as fallback
    deleteFarmFromLocalStorage(farmId);
}

// Delete Farm from LocalStorage
function deleteFarmFromLocalStorage(farmId) {
    let farms = JSON.parse(localStorage.getItem('riseOnlineFarms')) || [];
    farms = farms.filter(farm => farm.id !== farmId);
    localStorage.setItem('riseOnlineFarms', JSON.stringify(farms));
    
    // If Firebase is not available, reload the display
    if (!database || !userId) {
        // Reload farm records from localStorage
        loadFarmsFromLocalStorageForDate(currentDate || new Date().toISOString().split('T')[0]);
        showNotification('Farm record deleted successfully!');
    }
}

// Apply farm filters
function applyFarmFilters() {
    console.log('=== APPLYING FARM FILTERS ===');
    
    // Check if filter elements exist
    const typeFilterElement = document.getElementById('farm-type-filter');
    const playerSearchElement = document.getElementById('farm-player-search');
    const locationSearchElement = document.getElementById('farm-location-search');
    
    if (!typeFilterElement) {
        console.error('farm-type-filter element not found');
        return;
    }
    
    if (!playerSearchElement) {
        console.error('farm-player-search element not found');
        return;
    }
    
    if (!locationSearchElement) {
        console.error('farm-location-search element not found');
        return;
    }
    
    // Get current farms (stored when loaded)
    const farms = window.currentFarms || [];
    console.log('Current farms available for filtering:', farms.length);
    
    // Get filter values
    const typeFilter = typeFilterElement.value;
    const playerSearch = playerSearchElement.value.toLowerCase();
    const locationSearch = locationSearchElement.value.toLowerCase();
    
    console.log('Filter values - Type:', typeFilter, 'Player:', playerSearch, 'Location:', locationSearch);
    
    // Apply filters
    let filteredFarms = farms;
    
    // Filter by type
    if (typeFilter !== 'all') {
        console.log('Applying type filter:', typeFilter);
        const beforeCount = filteredFarms.length;
        filteredFarms = filteredFarms.filter(farm => farm.type === typeFilter);
        console.log('Farms after type filter:', beforeCount, '->', filteredFarms.length);
    }
    
    // Filter by player (for team farms)
    if (playerSearch) {
        console.log('Applying player filter:', playerSearch);
        const beforeCount = filteredFarms.length;
        filteredFarms = filteredFarms.filter(farm => {
            if (farm.type === 'solo') {
                return false; // Solo farms don't have players
            }
            return farm.members && farm.members.some(member => 
                member.nickname && member.nickname.toLowerCase().includes(playerSearch)
            );
        });
        console.log('Farms after player filter:', beforeCount, '->', filteredFarms.length);
    }
    
    // Filter by location
    if (locationSearch) {
        console.log('Applying location filter:', locationSearch);
        const beforeCount = filteredFarms.length;
        filteredFarms = filteredFarms.filter(farm => 
            farm.location && farm.location.toLowerCase().includes(locationSearch)
        );
        console.log('Farms after location filter:', beforeCount, '->', filteredFarms.length);
    }
    
    console.log('Final filtered farms count:', filteredFarms.length);
    
    // Store filtered farms for potential use elsewhere
    window.filteredFarms = filteredFarms;
    
    // Display filtered results
    displayFarmRecords(filteredFarms);
    
    console.log('=== FILTERING COMPLETE ===');
}

// Clear all filters
function clearFarmFilters() {
    console.log('Clearing all farm filters');
    
    const typeFilter = document.getElementById('farm-type-filter');
    const playerSearch = document.getElementById('farm-player-search');
    const locationSearch = document.getElementById('farm-location-search');
    
    if (typeFilter) typeFilter.value = 'all';
    if (playerSearch) playerSearch.value = '';
    if (locationSearch) locationSearch.value = '';
    
    applyFarmFilters();
}

// Initialize farm filters event listeners manually
// This ensures that the event handlers are properly attached even if there are issues with HTML attributes
function initializeFarmFilters() {
    console.log('=== INITIALIZING FARM FILTERS ===');
    
    const typeFilter = document.getElementById('farm-type-filter');
    const playerSearch = document.getElementById('farm-player-search');
    const locationSearch = document.getElementById('farm-location-search');
    
    // Check if elements exist
    if (!typeFilter) {
        console.error('farm-type-filter element not found during initialization');
        return;
    }
    
    if (!playerSearch) {
        console.error('farm-player-search element not found during initialization');
        return;
    }
    
    if (!locationSearch) {
        console.error('farm-location-search element not found during initialization');
        return;
    }
    
    // Remove any existing event listeners to prevent duplicates
    typeFilter.removeEventListener('change', applyFarmFilters);
    playerSearch.removeEventListener('input', applyFarmFilters);
    locationSearch.removeEventListener('input', applyFarmFilters);
    
    // Add event listeners
    typeFilter.addEventListener('change', applyFarmFilters);
    playerSearch.addEventListener('input', applyFarmFilters);
    locationSearch.addEventListener('input', applyFarmFilters);
    
    console.log('Attached event listeners to farm filter elements');
    console.log('=== FARM FILTER INITIALIZATION COMPLETE ===');
}

// Add a function to check if farm filters are working
function checkFarmFilters() {
    console.log('=== CHECKING FARM FILTERS ===');
    
    const typeFilter = document.getElementById('farm-type-filter');
    const playerSearch = document.getElementById('farm-player-search');
    const locationSearch = document.getElementById('farm-location-search');
    
    console.log('Type filter element:', typeFilter ? 'Found' : 'Not found');
    console.log('Player search element:', playerSearch ? 'Found' : 'Not found');
    console.log('Location search element:', locationSearch ? 'Found' : 'Not found');
    
    if (typeFilter) {
        console.log('Type filter value:', typeFilter.value);
        console.log('Type filter event listeners:', typeFilter._events ? Object.keys(typeFilter._events) : 'Unknown');
    }
    
    if (playerSearch) {
        console.log('Player search value:', playerSearch.value);
    }
    
    if (locationSearch) {
        console.log('Location search value:', locationSearch.value);
    }
    
    console.log('Current farms in window:', window.currentFarms ? window.currentFarms.length : 0);
    console.log('=== FARM FILTER CHECK COMPLETE ===');
}

// Farm records are loaded as part of loadDataForDate() after authentication
// No need to load them on DOMContentLoaded

// Edit Farm Record
function editFarm(farmId) {
    // Load farm data
    if (!database || !userId) {
        editFarmFromLocalStorage(farmId);
        return;
    }
    
    const farmRef = database.ref(`users/${userId}/farms/${farmId}`);
    farmRef.once('value')
        .then((snapshot) => {
            const farm = snapshot.val();
            if (farm) {
                openEditModal(farm);
            }
        })
        .catch((error) => {
            console.error('Error loading farm:', error);
            editFarmFromLocalStorage(farmId);
        });
}

function editFarmFromLocalStorage(farmId) {
    const farms = JSON.parse(localStorage.getItem('riseOnlineFarms')) || [];
    const farm = farms.find(f => f.id === farmId);
    if (farm) {
        openEditModal(farm);
    }
}

function openEditModal(farm) {
    if (farm.type === 'solo') {
        // Open solo farm modal
        document.getElementById('solo-farm-modal').style.display = 'block';
        document.getElementById('solo-farm-date').value = farm.date;
        document.getElementById('solo-farm-time').value = farm.time;
        document.getElementById('solo-farm-location').value = farm.location;
        
        // Clear and add items
        const container = document.getElementById('solo-items-container');
        container.innerHTML = '';
        farm.items.forEach(item => {
            addSoloFarmItem(item);
        });
        
        // Store farm ID for update
        document.getElementById('solo-farm-modal').dataset.editId = farm.id;
    } else {
        // Open team farm modal
        document.getElementById('team-farm-modal').style.display = 'block';
        document.getElementById('team-farm-date').value = farm.date;
        document.getElementById('team-farm-time').value = farm.time;
        document.getElementById('team-farm-location').value = farm.location;
        
        // Clear and add team members
        const membersContainer = document.getElementById('team-members-container');
        membersContainer.innerHTML = '';
        farm.members.forEach(member => {
            addTeamMember(member.paid);
            const memberDivs = membersContainer.querySelectorAll('.team-member-item');
            const lastMember = memberDivs[memberDivs.length - 1];
            
            // Set the member data
            const input = lastMember.querySelector('.player-autocomplete');
            input.value = member.nickname;
            
            // Update payment status UI
            const paymentButton = lastMember.querySelector('.payment-toggle-btn');
            if (paymentButton) {
                paymentButton.textContent = member.paid ? '✅ Paid' : '⏳ Unpaid';
                paymentButton.className = member.paid ? 'payment-toggle-btn paid' : 'payment-toggle-btn unpaid';
            }
            
            const hiddenInput = lastMember.querySelector('.paid-status');
            if (hiddenInput) {
                hiddenInput.value = member.paid;
            }
        });
        
        // Clear and add items
        const itemsContainer = document.getElementById('team-items-container');
        itemsContainer.innerHTML = '';
        farm.items.forEach(item => {
            addTeamFarmItem(item);
        });
        
        // Store farm ID for update
        document.getElementById('team-farm-modal').dataset.editId = farm.id;
    }
}

// Event Alarm System
let activeAlarms = [];
let alarmTimeouts = [];
let alarmAudio = null;

// Event times data
const eventTimes = {
    'Inferno Temple': ['08:00', '20:30'],
    'Crystal Fortress War': ['02:00', '14:00', '20:00'],
    'Deathmatch': ['03:00', '11:00', '17:00'],
    'Mount Race': ['06:00', '10:00', '15:00', '18:00'],
    'Blood Valley': ['22:00'], // Wednesday, Friday, Sunday
    'Sevenfold': ['18:00', '00:01'] // Friday, Sunday
};

// Update time options when event is selected
function updateAlarmTimes() {
    const eventSelect = document.getElementById('alarm-event');
    const timeSelect = document.getElementById('alarm-time');
    const selectedEvent = eventSelect.value;
    
    // Clear existing options
    timeSelect.innerHTML = '<option value="">Select time</option>';
    
    if (selectedEvent && eventTimes[selectedEvent]) {
        eventTimes[selectedEvent].forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            timeSelect.appendChild(option);
        });
    }
}

// Set event alarm
function setEventAlarm() {
    const eventSelect = document.getElementById('alarm-event');
    const timeSelect = document.getElementById('alarm-time');
    const minutesInput = document.getElementById('alarm-minutes');
    
    const selectedEvent = eventSelect.value;
    const selectedTime = timeSelect.value;
    const alertMinutes = parseInt(minutesInput.value);
    
    if (!selectedEvent || !selectedTime || isNaN(alertMinutes) || alertMinutes <= 0) {
        alert('Please fill all fields correctly!');
        return;
    }
    
    // Calculate alarm time
    const now = new Date();
    const [hours, minutes] = selectedTime.split(':').map(Number);
    
    // Create alarm date for today
    let alarmDate = new Date();
    alarmDate.setHours(hours, minutes, 0, 0);
    
    // If the alarm time has already passed today, set it for tomorrow
    if (alarmDate <= now) {
        alarmDate.setDate(alarmDate.getDate() + 1);
    }
    
    // Calculate alert time (X minutes before event)
    const alertTime = new Date(alarmDate.getTime() - alertMinutes * 60000);
    
    // Create alarm object
    const alarm = {
        id: Date.now(),
        event: selectedEvent,
        eventTime: selectedTime,
        alertMinutes: alertMinutes,
        alertTime: alertTime,
        alarmTime: alarmDate
    };
    
    // Add to active alarms
    activeAlarms.push(alarm);
    
    // Set timeout for alarm
    const timeUntilAlert = alertTime.getTime() - now.getTime();
    if (timeUntilAlert > 0) {
        const timeoutId = setTimeout(() => triggerAlarm(alarm), timeUntilAlert);
        alarmTimeouts.push({id: alarm.id, timeoutId: timeoutId});
    }
    
    // Update UI
    updateActiveAlarmsList();
    
    // Show confirmation
    const statusElement = document.getElementById('alarm-status');
    if (statusElement) {
        statusElement.innerHTML = 
            '<div class="alarm-success">All alarms cleared</div>';
    }
    
    // Clear form
    eventSelect.value = '';
    timeSelect.innerHTML = '<option value="">Select time</option>';
    minutesInput.value = '5';
}

// Trigger alarm
function triggerAlarm(alarm) {
    // Play audio alert
    try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        
        // Stop after 1 second
        setTimeout(() => {
            oscillator.stop();
        }, 1000);
    } catch (e) {
        console.log('Audio alert failed:', e);
        // Fallback: try to play a simple beep
        try {
            if (alarmAudio) {
                alarmAudio.play();
            }
        } catch (e) {
            console.log('Audio playback failed:', e);
        }
    }
    
    // Show visual alert
    alert(`Event Alarm!\n\n${alarm.event} starts now!`);
    
    // Remove alarm from active alarms
    activeAlarms = activeAlarms.filter(a => a.id !== alarm.id);
    alarmTimeouts = alarmTimeouts.filter(t => t.id !== alarm.id);
    
    // Update UI
    updateActiveAlarmsList();
}

// Update active alarms list in UI
function updateActiveAlarmsList() {
    const alarmsList = document.getElementById('alarms-list');
    if (!alarmsList) return;
    
    if (activeAlarms.length === 0) {
        alarmsList.innerHTML = '<p>No active alarms</p>';
        return;
    }
    
    // Sort alarms by alert time
    const sortedAlarms = [...activeAlarms].sort((a, b) => a.alertTime - b.alertTime);
    
    let html = '<div class="alarm-list">';
    sortedAlarms.forEach(alarm => {
        const timeString = alarm.alertTime.toLocaleString();
        html += `
            <div class="alarm-item">
                <div class="alarm-details">
                    <strong>${alarm.event}</strong> at ${alarm.eventTime} 
                    (${alarm.alertMinutes} min before) - Alert at: ${timeString}
                </div>
                <button class="remove-alarm" onclick="removeAlarm(${alarm.id})">Remove</button>
            </div>`;
    });
    html += '</div>';
    
    alarmsList.innerHTML = html;
}

// Remove a specific alarm
function removeAlarm(alarmId) {
    // Find the alarm
    const alarmIndex = activeAlarms.findIndex(a => a.id === alarmId);
    if (alarmIndex === -1) return;
    
    // Clear the timeout
    const timeoutEntry = alarmTimeouts.find(t => t.id === alarmId);
    if (timeoutEntry) {
        clearTimeout(timeoutEntry.timeoutId);
        alarmTimeouts = alarmTimeouts.filter(t => t.id !== alarmId);
    }
    
    // Remove from active alarms
    activeAlarms.splice(alarmIndex, 1);
    
    // Update UI
    updateActiveAlarmsList();
    
    // Show confirmation
    const statusElement = document.getElementById('alarm-status');
    if (statusElement) {
        statusElement.innerHTML = 
            '<div class="alarm-success">Alarm removed</div>';
    }
}

// Clear all active alarms
function clearActiveAlarms() {
    // Clear all timeouts
    alarmTimeouts.forEach(timeout => {
        clearTimeout(timeout.timeoutId);
    });
    
    // Clear arrays
    activeAlarms = [];
    alarmTimeouts = [];
    
    // Update UI
    updateActiveAlarmsList();
    
    // Show confirmation
    const statusElement = document.getElementById('alarm-status');
    if (statusElement) {
        statusElement.innerHTML = 
            '<div class="alarm-success">All alarms cleared</div>';
    }
}

// Removed duplicate code that was causing syntax error

