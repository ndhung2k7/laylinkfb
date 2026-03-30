// Content script that runs on Facebook, TikTok, Instagram
let isActive = false;
let lastUrl = '';
let checkInterval = null;
let feedScanInterval = null;
let processedLinks = new Set(); // Lưu các link đã xử lý trong phiên hiện tại
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

// ==================== URL Monitoring (thanh địa chỉ) ====================
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
  }, 1000);
}

function stopMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// ==================== Feed Scanning (Quét link trong feed) ====================
function startFeedScan() {
  if (feedScanInterval) return;
  
  // Reset processed links khi bắt đầu quét mới
  processedLinks.clear();
  lastScanCount = 0;
  
  // Quét feed mỗi 2 giây
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
    const href = linkElement.getAttribute('href');
    if (!href) return;
    
    // Tạo full URL nếu là relative path
    let fullUrl = href;
    if (href.startsWith('/')) {
      fullUrl = window.location.origin + href;
    } else if (href.startsWith('./')) {
      fullUrl = window.location.origin + href.substring(1);
    } else if (!href.startsWith('http')) {
      // Bỏ qua các link javascript: hoặc # 
      return;
    }
    
    // Kiểm tra xem link có phải là video/reel không
    const videoInfo = isVideoLink(fullUrl, currentPlatform);
    if (videoInfo && videoInfo.isVideo) {
      // Kiểm tra xem link đã được xử lý trong phiên này chưa
      if (!processedLinks.has(fullUrl)) {
        processedLinks.add(fullUrl);
        foundNewLinks++;
        
        const cleanUrl = PlatformDetector.extractVideoUrl(fullUrl);
        
        console.log(`[Feed Scan] Found new ${videoInfo.platform}: ${cleanUrl}`);
        
        chrome.runtime.sendMessage({
          action: 'newUrl',
          url: cleanUrl,
          platform: videoInfo.platform
        });
      }
    }
  });
  
  // Log thông tin quét
  if (foundNewLinks > 0) {
    console.log(`[Feed Scan] Collected ${foundNewLinks} new links from feed. Total in session: ${processedLinks.size}`);
  }
  
  // Kiểm tra nếu số lượng link thay đổi đột ngột (có thể do infinite scroll)
  if (allLinks.length !== lastScanCount) {
    lastScanCount = allLinks.length;
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
      // Facebook: /reels/ hoặc /reel/ (reel trong link)
      if (url.includes('/reels/') || url.includes('/reel/')) {
        return { isVideo: true, platform: 'Facebook Reels' };
      }
      // Một số dạng Facebook video khác
      if (url.includes('/videos/') && !url.includes('/watch')) {
        return { isVideo: true, platform: 'Facebook Video' };
      }
      break;
      
    case 'tiktok':
      // TikTok: /video/ là chính xác nhất
      if (url.includes('/video/')) {
        return { isVideo: true, platform: 'TikTok Video' };
      }
      // TikTok cũng có dạng /v/ cho video ngắn
      if (url.match(/\/v\/\d+/)) {
        return { isVideo: true, platform: 'TikTok Video' };
      }
      break;
      
    case 'instagram':
      // Instagram: /reel/ hoặc /p/
      if (url.includes('/reel/')) {
        return { isVideo: true, platform: 'Instagram Reels' };
      }
      if (url.includes('/p/')) {
        // Instagram post có thể là ảnh hoặc video
        // Ta vẫn thu thập để background xử lý
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
    
    // Kiểm tra nếu có thêm node mới vào DOM (infinite scroll)
    let hasNewContent = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        hasNewContent = true;
        break;
      }
    }
    
    // Nếu có nội dung mới, quét ngay lập tức (không cần chờ interval)
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

// ==================== History API monitoring (cho SPA) ====================
let lastPushState = location.href;
const pushState = history.pushState;
history.pushState = function() {
  pushState.apply(history, arguments);
  if (isActive) {
    setTimeout(() => {
      checkUrlChange();
      // Khi chuyển trang, reset processed links và quét lại feed
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

// ==================== Debounced scroll event (optional) ====================
let scrollTimeout = null;
window.addEventListener('scroll', () => {
  if (!isActive) return;
  
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  scrollTimeout = setTimeout(() => {
    // Khi người dùng scroll, quét thêm một lần nữa
    if (isActive) {
      scanFeedForLinks();
    }
  }, 1000);
});

// ==================== Initialize ====================
console.log('Video Link Collector content script loaded - Enhanced with feed scanning');
setupMutationObserver();

// Lần quét đầu tiên sau khi load trang
setTimeout(() => {
  if (isActive) {
    scanFeedForLinks();
  }
}, 1500);
