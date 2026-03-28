// Content script that runs on Facebook, TikTok, Instagram
let isActive = false;
let lastUrl = '';
let checkInterval = null;

// Check if extension is active
chrome.storage.local.get(['isRunning'], (result) => {
  isActive = result.isRunning || false;
  if (isActive) {
    startMonitoring();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    isActive = true;
    startMonitoring();
    sendResponse({ success: true });
  } else if (request.action === 'stop') {
    isActive = false;
    stopMonitoring();
    sendResponse({ success: true });
  }
  return true;
});

function startMonitoring() {
  if (checkInterval) return;
  
  lastUrl = window.location.href;
  
  // Check URL every 1 second
  checkInterval = setInterval(() => {
    if (!isActive) return;
    
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      // URL changed, check if it's a video/reel
      const platform = PlatformDetector.detect(currentUrl);
      
      // Only collect if it's a video/reel content
      if (platform.includes('Reels') || platform.includes('Video') || 
          (platform === 'Instagram Post')) {
        
        const cleanUrl = PlatformDetector.extractVideoUrl(currentUrl);
        
        chrome.runtime.sendMessage({
          action: 'newUrl',
          url: cleanUrl,
          platform: platform
        });
      }
      
      lastUrl = currentUrl;
    }
  }, 1000); // Check every 1 second
}

function stopMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// Also listen for URL changes via History API (for SPAs)
let lastPushState = location.href;
const pushState = history.pushState;
history.pushState = function() {
  pushState.apply(history, arguments);
  if (isActive) {
    setTimeout(checkUrlChange, 100);
  }
};

const replaceState = history.replaceState;
history.replaceState = function() {
  replaceState.apply(history, arguments);
  if (isActive) {
    setTimeout(checkUrlChange, 100);
  }
};

window.addEventListener('popstate', () => {
  if (isActive) {
    setTimeout(checkUrlChange, 100);
  }
});

function checkUrlChange() {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    const platform = PlatformDetector.detect(currentUrl);
    if (platform.includes('Reels') || platform.includes('Video') || 
        platform === 'Instagram Post') {
      const cleanUrl = PlatformDetector.extractVideoUrl(currentUrl);
      chrome.runtime.sendMessage({
        action: 'newUrl',
        url: cleanUrl,
        platform: platform
      });
    }
    lastUrl = currentUrl;
  }
}

console.log('Video Link Collector content script loaded');
