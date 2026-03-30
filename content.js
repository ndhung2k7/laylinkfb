// Biến kiểm soát trạng thái hoạt động
let isActive = false;
let scanInterval = null;

// Lấy trạng thái ban đầu từ storage
chrome.storage.local.get(['isActive'], (result) => {
    isActive = result.isActive || false;
    if (isActive) {
        startScanning();
    }
});

// Lắng nghe lệnh từ Popup (Bật/Tắt)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleStatus') {
        isActive = message.isActive;
        if (isActive) {
            startScanning();
        } else {
            stopScanning();
        }
    }
});

/**
 * Hàm quét tất cả các link video trên màn hình
 */
function scanLinksOnPage() {
    if (!isActive) return;

    // Tìm tất cả các thẻ <a> có thuộc tính href
    const allLinks = document.querySelectorAll('a[href]');
    
    allLinks.forEach(linkElement => {
        const rawUrl = linkElement.href;
        
        // Sử dụng PlatformDetector (từ utils.js) để nhận diện
        const platform = PlatformDetector.detect(rawUrl);

        // Chỉ xử lý nếu link đúng là Video hoặc Reel
        if (platform !== 'Unknown' && platform !== 'Facebook' && platform !== 'TikTok' && platform !== 'Instagram') {
            const cleanUrl = PlatformDetector.extractVideoUrl(rawUrl);
            
            // Gửi link về background.js để xử lý lưu trữ và chống trùng
            chrome.runtime.sendMessage({
                action: 'newUrl',
                url: cleanUrl,
                platform: platform
            });
        }
    });
}

/**
 * Bắt đầu chu kỳ quét
 */
function startScanning() {
    console.log("Video Link Collector: Started scanning...");
    // Quét ngay lập tức khi bật
    scanLinksOnPage();
    
    // Quét định kỳ mỗi 2 giây để bắt các video mới khi cuộn trang
    if (!scanInterval) {
        scanInterval = setInterval(scanLinksOnPage, 2000);
    }
}

/**
 * Dừng quét
 */
function stopScanning() {
    console.log("Video Link Collector: Stopped scanning.");
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
}

// Hỗ trợ bổ sung: Theo dõi sự thay đổi URL (cho các trang SPA)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        if (isActive) scanLinksOnPage();
    }
}).observe(document, {subtree: true, childList: true});
