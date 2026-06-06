const ZOOM_MAP = {
  'a-zoom-90': 0.9,
  'b-zoom-100': 1.0,
  'c-zoom-110': 1.1,
  'd-zoom-125': 1.25
};

async function changeAllTabsZoom(zoomFactor) {
  try {
    const tabs = await chrome.tabs.query({});
    const stored = await chrome.storage.local.get(['resetClosed']);
    const isResetClosed = stored.resetClosed !== false;
    const zoomScope = isResetClosed ? 'per-tab' : 'per-origin';
    
    const zoomPromises = tabs.map(async (tab) => {
      // 各種ブラウザのシステムページや特殊ページはスキップ
      if (!tab.id || !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('brave://') ||
        tab.url.startsWith('about:')) {
        return;
      }
      
      try {
        await chrome.tabs.setZoomSettings(tab.id, { scope: zoomScope });
        await chrome.tabs.setZoom(tab.id, zoomFactor);
      } catch (err) {
        console.log(`タブ(ID: ${tab.id}) が変更前に閉じられました`);
      }
    });
    
    await Promise.all(zoomPromises);
  } catch (error) {
    console.error('一括ズーム変更の根本的な処理に失敗しました:', error);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  let zoomFactor = ZOOM_MAP[command];
  
  // カスタムショートカット（e, f）が押された場合、ストレージから設定値を読み込む
  if (command === 'e-custom-zoom-1' || command === 'f-custom-zoom-2') {
    const stored = await chrome.storage.local.get(['custom1', 'custom2']);
    if (command === 'e-custom-zoom-1') {
      zoomFactor = stored.custom1 || 1.50; // デフォルト 150%
    } else {
      zoomFactor = stored.custom2 || 2.00; // デフォルト 200%
    }
  }
  
  if (zoomFactor) {
    changeAllTabsZoom(zoomFactor);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'changeZoom' && message.zoomFactor) {
    changeAllTabsZoom(message.zoomFactor);
  }
  
  if (message.action === 'settingsChanged') {
    syncCurrentZoomSettings();
  }
});

chrome.tabs.onZoomChange.addListener((zoomChangeInfo) => {
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
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
}

function updateBadge(tabId, zoomFactor) {
  const percentage = Math.round(zoomFactor * 100);
  chrome.action.setBadgeText({
    text: String(percentage),
    tabId: tabId
  });
  chrome.action.setBadgeBackgroundColor({
    color: '#4682B4',
    tabId: tabId
  });
}

// 設定変更時に、過去にChrome本体に刻まれたズーム永続記憶を安全にクレンジングする関数
async function syncCurrentZoomSettings() {
  try {
    const tabs = await chrome.tabs.query({});
    const stored = await chrome.storage.local.get(['resetClosed']);
    const isResetClosed = stored.resetClosed !== false;
    
    const promises = tabs.map(async (tab) => {
      if (!tab.id || !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('brave://') ||
        tab.url.startsWith('about:')) {
        return;
      }
      try {
        const currentZoom = await chrome.tabs.getZoom(tab.id);
        const settings = await chrome.tabs.getZoomSettings(tab.id);
        const defaultZoom = settings.defaultZoomFactor || 1.0;
        
        if (isResetClosed) {
          if (Math.abs(currentZoom - defaultZoom) > 0.01) {
            await chrome.tabs.setZoomSettings(tab.id, { scope: 'per-origin' });
            await chrome.tabs.setZoom(tab.id, defaultZoom);
          }
          
          await chrome.tabs.setZoomSettings(tab.id, { scope: 'per-tab' });
          if (Math.abs(currentZoom - defaultZoom) > 0.01) {
            await chrome.tabs.setZoom(tab.id, currentZoom);
          }
        } else {
          await chrome.tabs.setZoomSettings(tab.id, { scope: 'per-origin' });
          await chrome.tabs.setZoom(tab.id, currentZoom);
        }
      } catch (err) {
      
      }
    });
    await Promise.all(promises);
  } catch (error) {
    console.error('設定の同期処理に失敗しました:', error);
  }
}
