// Service worker for Chrome Extension
let checkInterval = null;

chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with separate arrays for each platform
  chrome.storage.local.set({ 
    isRunning: false,
    facebookUrls: [],
    tiktokUrls: [],
    instagramUrls: []
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'newUrl') {
    saveUrl(request.url, request.platform, sender.tab.id);
    sendResponse({ success: true });
  }
  return true;
});

function saveUrl(url, platform, tabId) {
  chrome.storage.local.get(['isRunning', 'facebookUrls', 'tiktokUrls', 'instagramUrls'], (result) => {
    if (!result.isRunning) return;
    
    // Determine which platform this URL belongs to
    let platformKey = '';
    let urlsArray = [];
    
    if (url.includes('facebook.com')) {
      platformKey = 'facebookUrls';
      urlsArray = result.facebookUrls || [];
    } else if (url.includes('tiktok.com')) {
      platformKey = 'tiktokUrls';
      urlsArray = result.tiktokUrls || [];
    } else if (url.includes('instagram.com')) {
      platformKey = 'instagramUrls';
      urlsArray = result.instagramUrls || [];
    } else {
      // Unknown platform, don't save
      return;
    }
    
    // Check for duplicate
    const isDuplicate = urlsArray.includes(url);
    
    if (!isDuplicate) {
      urlsArray.push(url);
      
      // Save back to storage
      const updateData = {};
      updateData[platformKey] = urlsArray;
      chrome.storage.local.set(updateData, () => {
        console.log(`[Saved] ${platformKey}: ${url}`);
        
        // Update badge with total count
        updateBadgeCount(tabId);
        
        // Notify popup to update stats
        chrome.runtime.sendMessage({ action: 'updateStats' });
      });
    } else {
      console.log(`[Duplicate skipped] ${url}`);
    }
  });
}

function updateBadgeCount(tabId) {
  chrome.storage.local.get(['facebookUrls', 'tiktokUrls', 'instagramUrls'], (result) => {
    const totalCount = (result.facebookUrls?.length || 0) + 
                       (result.tiktokUrls?.length || 0) + 
                       (result.instagramUrls?.length || 0);
    
    if (totalCount > 0) {
      chrome.action.setBadgeText({ text: totalCount.toString(), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#4caf50', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  });
}

// Helper function to get all URLs (for popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAllUrls') {
    chrome.storage.local.get(['facebookUrls', 'tiktokUrls', 'instagramUrls'], (result) => {
      sendResponse({
        facebook: result.facebookUrls || [],
        tiktok: result.tiktokUrls || [],
        instagram: result.instagramUrls || []
      });
    });
    return true;
  }
  
  if (request.action === 'clearAllUrls') {
    chrome.storage.local.set({ 
      facebookUrls: [], 
      tiktokUrls: [], 
      instagramUrls: [] 
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
