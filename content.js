// Content script that runs on Facebook, TikTok, Instagram
let isActive = false;
let lastUrl = '';
let checkInterval = null;
let feedScanInterval = null;
let processedLinks = new Set();
let lastScanCount = 0;

// Check if extension is active
chrome.storage.local.get(['isRunning'], (result) => {
  isActive = result.isRunning || false;
  if (isActive) {
    startMonitoring();
    startFeedScan();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    isActive = true;
    startMonitoring();
    startFeedScan();
    sendResponse({ success: true });
  } else if (request.action === 'stop') {
    isActive = false;
    stopMonitoring();
    stopFeedScan();
    sendResponse({ success: true });
  }
  return true;
});

// ==================== URL Monitoring ====================
function startMonitoring() {
  if (checkInterval) return;
  
  lastUrl = window.location.href;
  
  checkInterval = setInterval(() => {
    if (!isActive) return;
    
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      const platform = PlatformDetector.detect(currentUrl);
      
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
  }, 1000);
}

function stopMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// ==================== Feed Scanning ====================
function startFeedScan() {
  if (feedScanInterval) return;
  
  processedLinks.clear();
  lastScanCount = 0;
  
  feedScanInterval = setInterval(() => {
    if (!isActive) return;
    scanFeedForLinks();
  }, 2000);
}

function stopFeedScan() {
  if (feedScanInterval) {
    clearInterval(feedScanInterval);
    feedScanInterval = null;
  }
  processedLinks.clear();
}

function scanFeedForLinks() {
  const currentPlatform = detectCurrentPlatform();
  if (!currentPlatform) return;
  
  // Tìm tất cả các thẻ <a> trên trang
  const allLinks = document.querySelectorAll('a[href]');
  let foundNewLinks = 0;
  
  allLinks.forEach(linkElement => {
    let href = linkElement.getAttribute('href');
    if (!href) return;
    
    // Xử lý relative URLs
    let fullUrl = href;
    if (href.startsWith('/')) {
      fullUrl = window.location.origin + href;
    } else if (href.startsWith('./')) {
      fullUrl = window.location.origin + href.substring(1);
    } else if (!href.startsWith('http') && !href.startsWith('https')) {
      // Bỏ qua các link không hợp lệ
      return;
    }
    
    // Kiểm tra link có phải video không
    const videoInfo = isVideoLink(fullUrl, currentPlatform);
    
    if (videoInfo && videoInfo.isVideo) {
      // Kiểm tra trùng lặp trong phiên
      if (!processedLinks.has(fullUrl)) {
        processedLinks.add(fullUrl);
        foundNewLinks++;
        
        const cleanUrl = PlatformDetector.extractVideoUrl(fullUrl);
        
        console.log(`[${currentPlatform.toUpperCase()} Feed Scan] Found: ${cleanUrl}`);
        
        chrome.runtime.sendMessage({
          action: 'newUrl',
          url: cleanUrl,
          platform: videoInfo.platform
        });
      }
    }
  });
  
  if (foundNewLinks > 0) {
    console.log(`[Feed Scan] Collected ${foundNewLinks} new links. Total: ${processedLinks.size}`);
  }
}

function detectCurrentPlatform() {
  const url = window.location.href;
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return null;
}

function isVideoLink(url, platform) {
  switch(platform) {
    case 'facebook':
      if (url.includes('/reels/') || url.includes('/reel/')) {
        return { isVideo: true, platform: 'Facebook Reels' };
      }
      if (url.includes('/videos/') && !url.includes('/watch')) {
        return { isVideo: true, platform: 'Facebook Video' };
      }
      break;
      
    case 'tiktok':
      // TikTok patterns
      if (url.includes('/video/')) {
        return { isVideo: true, platform: 'TikTok Video' };
      }
      // Pattern cho @username/video/id
      if (url.match(/@[\w.]+\/video\/\d+/)) {
        return { isVideo: true, platform: 'TikTok Video' };
      }
      // Pattern cho /v/ID
      if (url.match(/\/v\/\d+/)) {
        return { isVideo: true, platform: 'TikTok Video' };
      }
      break;
      
    case 'instagram':
      if (url.includes('/reel/')) {
        return { isVideo: true, platform: 'Instagram Reels' };
      }
      if (url.includes('/p/')) {
        return { isVideo: true, platform: 'Instagram Post' };
      }
      break;
  }
  
  return { isVideo: false, platform: null };
}

// ==================== MutationObserver cho infinite scroll ====================
let observer = null;

function setupMutationObserver() {
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver((mutations) => {
    if (!isActive) return;
    
    let hasNewContent = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        hasNewContent = true;
        break;
      }
    }
    
    if (hasNewContent) {
      setTimeout(() => {
        if (isActive) {
          scanFeedForLinks();
        }
      }, 500);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ==================== History API monitoring ====================
let lastPushState = location.href;
const pushState = history.pushState;
history.pushState = function() {
  pushState.apply(history, arguments);
  if (isActive) {
    setTimeout(() => {
      checkUrlChange();
      processedLinks.clear();
      setTimeout(() => scanFeedForLinks(), 500);
    }, 100);
  }
};

const replaceState = history.replaceState;
history.replaceState = function() {
  replaceState.apply(history, arguments);
  if (isActive) {
    setTimeout(() => {
      checkUrlChange();
      processedLinks.clear();
      setTimeout(() => scanFeedForLinks(), 500);
    }, 100);
  }
};

window.addEventListener('popstate', () => {
  if (isActive) {
    setTimeout(() => {
      checkUrlChange();
      processedLinks.clear();
      setTimeout(() => scanFeedForLinks(), 500);
    }, 100);
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

// ==================== Scroll event ====================
let scrollTimeout = null;
window.addEventListener('scroll', () => {
  if (!isActive) return;
  
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  scrollTimeout = setTimeout(() => {
    if (isActive) {
      scanFeedForLinks();
    }
  }, 1000);
});

// ==================== Initialize ====================
console.log('Video Link Collector - Enhanced TikTok scanning enabled');
setupMutationObserver();

setTimeout(() => {
  if (isActive) {
    scanFeedForLinks();
  }
}, 1500);
