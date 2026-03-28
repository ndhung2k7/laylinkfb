let isRunning = false;

document.addEventListener('DOMContentLoaded', () => {
  // Load saved state
  chrome.storage.local.get(['isRunning', 'collectedUrls'], (result) => {
    isRunning = result.isRunning || false;
    updateUI(isRunning);
    updateStats(result.collectedUrls || []);
  });

  // Start button
  document.getElementById('startBtn').addEventListener('click', () => {
    isRunning = true;
    chrome.storage.local.set({ isRunning: true });
    updateUI(true);
    
    // Notify content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.includes('facebook.com') || 
                         tab.url.includes('tiktok.com') || 
                         tab.url.includes('instagram.com'))) {
          chrome.tabs.sendMessage(tab.id, { action: 'start' }).catch(() => {});
        }
      });
    });
  });

  // Stop button
  document.getElementById('stopBtn').addEventListener('click', () => {
    isRunning = false;
    chrome.storage.local.set({ isRunning: false });
    updateUI(false);
    
    // Notify content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'stop' }).catch(() => {});
      });
    });
  });

  // Export button
  document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.storage.local.get(['collectedUrls'], (result) => {
      const urls = result.collectedUrls || [];
      if (urls.length === 0) {
        alert('Không có link nào để export!');
        return;
      }
      
      const content = urls.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_links_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Clear button
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa tất cả link đã thu thập?')) {
      chrome.storage.local.set({ collectedUrls: [] }, () => {
        updateStats([]);
        alert('Đã xóa tất cả link!');
      });
    }
  });
});

function updateUI(running) {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  
  if (running) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusText.textContent = 'Đang chạy';
    statusDot.className = 'status-dot running';
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = 'Đã dừng';
    statusDot.className = 'status-dot stopped';
  }
}

function updateStats(urls) {
  document.getElementById('linkCount').textContent = urls.length;
  
  // Count by platform
  const platformCount = {
    'Facebook': 0,
    'TikTok': 0,
    'Instagram': 0,
    'Other': 0
  };
  
  urls.forEach(url => {
    if (url.includes('facebook.com')) platformCount['Facebook']++;
    else if (url.includes('tiktok.com')) platformCount['TikTok']++;
    else if (url.includes('instagram.com')) platformCount['Instagram']++;
    else platformCount['Other']++;
  });
  
  const statsText = Object.entries(platformCount)
    .filter(([_, count]) => count > 0)
    .map(([platform, count]) => `${platform}: ${count}`)
    .join(' | ');
  
  document.getElementById('platformStats').textContent = statsText || '-';
}

// Listen for updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    chrome.storage.local.get(['collectedUrls'], (result) => {
      updateStats(result.collectedUrls || []);
    });
  }
});
