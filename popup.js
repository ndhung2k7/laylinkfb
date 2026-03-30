let isRunning = false;

document.addEventListener('DOMContentLoaded', () => {
  // Load saved state
  chrome.storage.local.get(['isRunning'], (result) => {
    isRunning = result.isRunning || false;
    updateUI(isRunning);
    updateStats();
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

  // Export button - Xuất 3 file riêng biệt
  document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
      if (!response) return;
      
      const { facebook, tiktok, instagram } = response;
      let exportedCount = 0;
      
      // Export Facebook links
      if (facebook && facebook.length > 0) {
        const facebookContent = facebook.join('\n');
        downloadFile(facebookContent, 'facebook_links.txt');
        exportedCount++;
      }
      
      // Export TikTok links
      if (tiktok && tiktok.length > 0) {
        const tiktokContent = tiktok.join('\n');
        downloadFile(tiktokContent, 'tiktok_links.txt');
        exportedCount++;
      }
      
      // Export Instagram links
      if (instagram && instagram.length > 0) {
        const instagramContent = instagram.join('\n');
        downloadFile(instagramContent, 'instagram_links.txt');
        exportedCount++;
      }
      
      if (exportedCount === 0) {
        alert('Không có link nào để export!');
      } else {
        alert(`Đã export ${exportedCount} file:\n- facebook_links.txt (${facebook?.length || 0} links)\n- tiktok_links.txt (${tiktok?.length || 0} links)\n- instagram_links.txt (${instagram?.length || 0} links)`);
      }
    });
  });

  // Clear button
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa tất cả link đã thu thập?')) {
      chrome.runtime.sendMessage({ action: 'clearAllUrls' }, (response) => {
        if (response && response.success) {
          updateStats();
          alert('Đã xóa tất cả link!');
        }
      });
    }
  });
});

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

function updateStats() {
  chrome.runtime.sendMessage({ action: 'getAllUrls' }, (response) => {
    if (!response) return;
    
    const { facebook, tiktok, instagram } = response;
    const total = (facebook?.length || 0) + (tiktok?.length || 0) + (instagram?.length || 0);
    
    document.getElementById('linkCount').textContent = total;
    
    const statsText = [];
    if (facebook?.length) statsText.push(`FB: ${facebook.length}`);
    if (tiktok?.length) statsText.push(`TT: ${tiktok.length}`);
    if (instagram?.length) statsText.push(`IG: ${instagram.length}`);
    
    document.getElementById('platformStats').textContent = statsText.join(' | ') || '-';
  });
}

// Listen for updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    updateStats();
  }
});
