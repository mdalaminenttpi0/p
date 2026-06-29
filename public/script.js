// ====== DOM Elements ======
const urlInput = document.getElementById('urlInput');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const loadingState = document.getElementById('loadingState');
const statusMessage = document.getElementById('statusMessage');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const historyList = document.getElementById('historyList');
const qualityRadios = document.querySelectorAll('input[name="quality"]');
const metadataToggle = document.getElementById('metadataToggle');

// ====== Configuration ======
const API_BASE_URL = window.location.origin || 'http://localhost:5000';
const CONVERSION_TIMEOUT = 60000; // 60 seconds
let conversionHistory = JSON.parse(localStorage.getItem('conversionHistory')) || [];

// ====== Utility Functions ======
function showMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 5000);
    }
}

function hideMessage() {
    statusMessage.classList.add('hidden');
}

function showLoading(show = true) {
    if (show) {
        loadingState.classList.remove('hidden');
        convertBtn.disabled = true;
    } else {
        loadingState.classList.add('hidden');
        convertBtn.disabled = false;
    }
}

function showProgress(show = true) {
    if (show) {
        progressSection.classList.remove('hidden');
    } else {
        progressSection.classList.add('hidden');
    }
}

function updateProgress(percent, status) {
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressStatus.textContent = status;
}

function validateURL(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

function formatURL(url) {
    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
    }
    return url;
}

function getQuality() {
    return document.querySelector('input[name="quality"]:checked').value;
}

function saveToHistory(url, quality) {
    const entry = {
        url: url,
        quality: quality,
        timestamp: new Date().toLocaleString(),
        id: Date.now()
    };

    conversionHistory.unshift(entry);
    
    // Keep only last 10 entries
    if (conversionHistory.length > 10) {
        conversionHistory = conversionHistory.slice(0, 10);
    }

    localStorage.setItem('conversionHistory', JSON.stringify(conversionHistory));
    renderHistory();
}

function renderHistory() {
    if (conversionHistory.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No conversions yet. Start by entering a URL above!</p>';
        return;
    }

    historyList.innerHTML = conversionHistory.map(item => `
        <div class="history-item">
            <div>
                <div class="history-item-url" title="${item.url}">${item.url}</div>
                <div class="history-item-time">${item.quality.toUpperCase()} • ${item.timestamp}</div>
            </div>
            <button class="btn btn-secondary" onclick="retryConversion('${item.url}', '${item.quality}')" style="margin-left: 10px; padding: 8px 12px; font-size: 0.85rem;">
                🔄 Retry
            </button>
        </div>
    `).join('');
}

function retryConversion(url, quality) {
    urlInput.value = url;
    const qualityRadio = document.getElementById(quality);
    if (qualityRadio) {
        qualityRadio.checked = true;
    }
    convertPDF();
}

// ====== Main Conversion Function ======
async function convertPDF() {
    hideMessage();

    // Validate URL
    let url = urlInput.value.trim();
    if (!url) {
        showMessage('Please enter a valid URL', 'error');
        return;
    }

    url = formatURL(url);

    if (!validateURL(url)) {
        showMessage('Invalid URL format. Please check and try again.', 'error');
        return;
    }

    const quality = getQuality();
    const includeMetadata = metadataToggle.checked;

    console.log('Starting conversion:', { url, quality, includeMetadata });

    showLoading(true);
    showProgress(true);
    updateProgress(10, 'Initializing...');

    try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
            const currentPercent = parseInt(progressFill.style.width);
            if (currentPercent < 90) {
                updateProgress(currentPercent + Math.random() * 20, 'Processing webpage...');
            }
        }, 1000);

        const response = await fetch(`${API_BASE_URL}/api/convert-with-screenshot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                quality: quality,
                includeMetadata: includeMetadata
            }),
            timeout: CONVERSION_TIMEOUT
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Conversion failed with status ${response.status}`);
        }

        updateProgress(95, 'Finalizing PDF...');

        // Get the PDF blob
        const blob = await response.blob();
        
        // Create download link
        const url_obj = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url_obj;
        link.download = `webpage-${Date.now()}.pdf`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url_obj);

        updateProgress(100, 'Conversion complete!');
        
        showMessage('✅ PDF downloaded successfully!', 'success');
        saveToHistory(url, quality);

        // Reset UI
        setTimeout(() => {
            showLoading(false);
            showProgress(false);
            updateProgress(0, '');
        }, 2000);

    } catch (error) {
        console.error('Conversion error:', error);
        clearInterval(progressInterval);
        
        showLoading(false);
        showProgress(false);
        
        let errorMessage = 'An error occurred during conversion.';
        
        if (error.message.includes('Invalid URL')) {
            errorMessage = 'Invalid URL. Please check the address and try again.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Conversion took too long. The website might be too large or slow.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot reach the PDF conversion service. Please try again.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showMessage(`❌ Error: ${errorMessage}`, 'error');
    }
}

// ====== Event Listeners ======
convertBtn.addEventListener('click', convertPDF);

clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    hideMessage();
    document.getElementById('hd').checked = true;
    metadataToggle.checked = true;
    urlInput.focus();
});

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        convertPDF();
    }
});

urlInput.addEventListener('focus', () => {
    hideMessage();
});

// Example URLs for testing
const exampleURLs = [
    'https://www.google.com',
    'https://github.com',
    'https://wikipedia.org',
    'https://bbc.com'
];

// Add example suggestion
urlInput.addEventListener('blur', () => {
    if (!urlInput.value) {
        const random = exampleURLs[Math.floor(Math.random() * exampleURLs.length)];
        urlInput.placeholder = `Example: ${random}`;
    }
});

// ====== Initialize ======
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    console.log('API Base URL:', API_BASE_URL);
    renderHistory();
    
    // Check if server is running
    fetch(`${API_BASE_URL}/api/health`)
        .then(response => response.json())
        .then(data => {
            console.log('✅ Server is running:', data);
        })
        .catch(error => {
            console.warn('⚠️ Server connection check failed:', error.message);
            showMessage('⚠️ Server may not be running. Please ensure the backend is started.', 'info');
        });
});

// ====== Service Worker Registration (for Progressive Web App) ======
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service Worker registration failed:', err);
    });
}

// ====== Handle Upload via Drag & Drop (future enhancement) ======
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

// ====== Utility: Add to Home Screen Prompt ======
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('Install prompt ready');
});

// ====== Export functions for global use ======
window.convertPDF = convertPDF;
window.retryConversion = retryConversion;
