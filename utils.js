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
    // Clean URL by removing tracking parameters
    const urlObj = new URL(url);
    const cleanParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'ref'];
    cleanParams.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
  }
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
