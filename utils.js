// Utility functions
const PlatformDetector = {
  detect(url) {
    if (url.includes('facebook.com')) {
      if (url.includes('/reels/') || url.includes('/reel/')) {
        return 'Facebook Reels';
      }
      return 'Facebook';
    }
    if (url.includes('tiktok.com')) {
      if (url.includes('/video/')) {
        return 'TikTok Video';
      }
      return 'TikTok';
    }
    if (url.includes('instagram.com')) {
      if (url.includes('/reel/')) {
        return 'Instagram Reels';
      }
      if (url.includes('/p/')) {
        return 'Instagram Post';
      }
      return 'Instagram';
    }
    return 'Unknown';
  },
  
  extractVideoUrl(url) {
    try {
      // Clean URL by removing tracking parameters
      const urlObj = new URL(url);
      const cleanParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'ref', 'e', 's', 'type'];
      cleanParams.forEach(param => urlObj.searchParams.delete(param));
      
      // Loại bỏ các ký tự đặc biệt cuối URL
      let cleanUrl = urlObj.toString();
      cleanUrl = cleanUrl.replace(/[\/?#]$/, '');
      
      return cleanUrl;
    } catch (e) {
      // Nếu URL không hợp lệ, trả về original
      return url;
    }
  },
  
  getPlatformType(url) {
    if (url.includes('facebook.com')) return 'facebook';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    return 'unknown';
  }
};

// Video patterns for different platforms
const VideoPatterns = {
  facebook: [
    { pattern: /\/reels\/|\/reel\//, type: 'Facebook Reels' },
    { pattern: /\/videos\/(?!watch)/, type: 'Facebook Video' }
  ],
  tiktok: [
    { pattern: /\/video\//, type: 'TikTok Video' },
    { pattern: /\/v\/\d+/, type: 'TikTok Video' },
    { pattern: /@[\w.]+\/video\/\d+/, type: 'TikTok Video' } // Pattern cho link TikTok dạng @username/video/id
  ],
  instagram: [
    { pattern: /\/reel\//, type: 'Instagram Reels' },
    { pattern: /\/p\//, type: 'Instagram Post' }
  ]
};

// Debounce function to prevent too many checks
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Hàm kiểm tra link video
function isVideoLinkAdvanced(url, platform) {
  const patterns = VideoPatterns[platform];
  if (!patterns) return null;
  
  for (const item of patterns) {
    if (item.pattern.test(url)) {
      return item.type;
    }
  }
  return null;
}
