// ショートカットの並び順を制御するためのインデックス付きマップ
const ZOOM_MAP = {
  'a-zoom-90': 0.9,
  'b-zoom-100': 1.0,
  'c-zoom-110': 1.1,
  'd-zoom-125': 1.25
};

// 【共通処理】すべてのタブのズームを一括変更する関数
async function changeAllTabsZoom(zoomFactor) {
  try {
    // 現在の一括設定倍率をストレージに記憶する
    await chrome.storage.local.set({ currentZoom: zoomFactor });
    
    const tabs = await chrome.tabs.query({});
    const zoomedTabIds = [];
    
    const zoomPromises = tabs.map(async (tab) => {
      // 各種ブラウザのシステムページや特殊ページは安全にスキップ
      if (!tab.id || !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('brave://') ||
        tab.url.startsWith('about:')) {
        return;
      }
      
      try {
        // 常に「タブ限定（閉じたらリセット）」モードを適用
        await chrome.tabs.setZoomSettings(tab.id, { scope: 'per-tab' });
        await chrome.tabs.setZoom(tab.id, zoomFactor);
        
        // 正常にズームできたタブIDを名簿に追加
        zoomedTabIds.push(tab.id);
      } catch (err) {
        console.log(`[想定内] タブ(ID: ${tab.id}) が変更前に閉じられました。`);
      }
    });
    
    await Promise.all(zoomPromises);

    // 非同期処理中に閉じられたタブを除外してから保存する
    // （onRemovedによる削除がこの上書きで無効化される競合状態を防ぐため）
    const openTabs = await chrome.tabs.query({});
    const openTabIds = new Set(openTabs.map(t => t.id));
    const validZoomedTabIds = zoomedTabIds.filter(id => openTabIds.has(id));

    await chrome.storage.local.set({ zoomedTabIds: validZoomedTabIds });
    
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

// 2. メッセージを受け取るイベント
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'changeZoom' && message.zoomFactor) {
    changeAllTabsZoom(message.zoomFactor);
  }
});

// --- 以下、バッジの自動更新およびタブイベント処理 ---
chrome.tabs.onZoomChange.addListener((zoomChangeInfo) => {
  updateTabZoomBadge(zoomChangeInfo.tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => updateTabZoomBadge(activeInfo.tabId));

// タブが閉じられたとき、名簿（ズーム適用済みリスト）からそのIDを削除する
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const stored = await chrome.storage.local.get(['zoomedTabIds']);
    if (stored.zoomedTabIds) {
      const filteredIds = stored.zoomedTabIds.filter(id => id !== tabId);
      await chrome.storage.local.set({ zoomedTabIds: filteredIds });
    }
  } catch (e) {
    // 例外スルー
  }
});

// ページの状態が変わったときのイベント
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    return;
  }
  
  if (changeInfo.status === 'complete') {
    if (tab.url && (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('brave://') ||
      tab.url.startsWith('about:'))) {
      updateTabZoomBadge(tabId);
      return;
    }
    
    try {
      const stored = await chrome.storage.local.get(['currentZoom', 'zoomedTabIds']);
      const zoomedTabIds = stored.zoomedTabIds || [];
      
      // 名簿に載っている（リロードされただけ）場合のみ倍率を再適用
      if (stored.currentZoom && zoomedTabIds.includes(tabId)) {
        const settings = await chrome.tabs.getZoomSettings(tabId);
        const defaultZoom = settings.defaultZoomFactor || 1.0;
        
        if (Math.abs(stored.currentZoom - defaultZoom) > 0.01) {
          await chrome.tabs.setZoomSettings(tabId, { scope: 'per-tab' });
          await chrome.tabs.setZoom(tabId, stored.currentZoom);
        }
      }
    } catch (e) {
      // 例外スルー
    }
    
    updateTabZoomBadge(tabId);
  }
});

// 指定されたタブのズーム状態を調べてバッジを更新する関数
async function updateTabZoomBadge(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'loading') {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
      return;
    }
    
    const zoom = await chrome.tabs.getZoom(tabId);
    updateBadge(tabId, zoom);
  } catch (e) {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
}

// バッジの描画処理
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
