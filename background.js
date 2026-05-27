const ZOOM_MAP = {
  'a-zoom-90': 0.9,
  'b-zoom-100': 1.0,
  'c-zoom-110': 1.1,
  'd-zoom-125': 1.25
};

// 【共通処理】すべてのタブのズームを一括変更する関数
async function changeAllTabsZoom(zoomFactor) {
  try {
    const tabs = await chrome.tabs.query({});
    const zoomPromises = tabs.map(async (tab) => {
      if (!tab.id || !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('brave://') ||
        tab.url.startsWith('about:')) {
        return;
      }
      
      try {
        await chrome.tabs.setZoom(tab.id, zoomFactor);
      } catch (err) {
        console.log(`タブ(ID: ${tab.id}) が見つかりません`);
      }
    });
    
    await Promise.all(zoomPromises);
  } catch (error) {
    console.error('一括ズーム変更の根本的な処理に失敗しました:', error);
  }
}

// 1. キーボードショートカットが押されたときのイベント
chrome.commands.onCommand.addListener(async (command) => {
  let zoomFactor = ZOOM_MAP[command];
  
  if (command === 'e-custom-zoom-1' || command === 'f-custom-zoom-2') {
    const stored = await chrome.storage.local.get(['custom1', 'custom2']);
    if (command === 'e-custom-zoom-1') {
      zoomFactor = stored.custom1 || 1.50;
    } else {
      zoomFactor = stored.custom2 || 2.00;
    }
  }
  
  if (zoomFactor) {
    changeAllTabsZoom(zoomFactor);
  }
});

// 2. ポップアップのボタンが押されたときのメッセージを受け取るイベント
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'changeZoom' && message.zoomFactor) {
    changeAllTabsZoom(message.zoomFactor);
  }
});

chrome.tabs.onZoomChange.addListener((zoomChangeInfo) => {
  // ここもタブ消滅のタイミングと被ることがあるため、try-catch付きの関数経由にするか、安全に処理
  updateTabZoomBadge(zoomChangeInfo.tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => updateTabZoomBadge(activeInfo.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') updateTabZoomBadge(tabId);
});

async function updateTabZoomBadge(tabId) {
  try {
    const zoom = await chrome.tabs.getZoom(tabId);
    updateBadge(tabId, zoom);
  } catch (e) {
    // タブが存在しない場合は、バッジを消すだけ
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
}

function updateBadge(tabId, zoomFactor) {
  const percentage = Math.round(zoomFactor * 100);
  chrome.action.setBadgeText({ text: `${percentage}`, tabId: tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#4682B4', tabId: tabId });
}
