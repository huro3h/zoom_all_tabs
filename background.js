// キーのプレフィックス a-,b-... はショートカット設定画面での並び順を決めるため意味を持つ
const ZOOM_FACTOR_BY_COMMAND = {
  'a-zoom-90': 0.9,
  'b-zoom-100': 1.0,
  'c-zoom-110': 1.1,
  'd-zoom-125': 1.25
};

const DEFAULT_CUSTOM_ZOOM_1 = 1.50;
const DEFAULT_CUSTOM_ZOOM_2 = 2.00;

// 最後に一括指定した倍率。新しく開いたタブを揃え直すために保持する
const LAST_ZOOM_FACTOR_KEY = 'lastZoomFactor';
const ZOOM_FACTOR_EPSILON = 0.001;

const BADGE_BACKGROUND_COLOR = '#4682B4';

function isBrowserInternalPage(url) {
  return !url ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://') ||
    url.startsWith('about:');
}

async function changeAllTabsZoom(zoomFactor) {
  try {
    await chrome.storage.local.set({ [LAST_ZOOM_FACTOR_KEY]: zoomFactor });

    const tabs = await chrome.tabs.query({});

    const zoomTasks = tabs.map(async (tab) => {
      if (!tab.id || isBrowserInternalPage(tab.url)) {
        return;
      }

      try {
        await chrome.tabs.setZoom(tab.id, zoomFactor);
      } catch (tabClosedBeforeZoom) {
        console.log(`[想定内] タブ(ID: ${tab.id}) が変更前に閉じられました。`);
      }
    });

    await Promise.all(zoomTasks);
  } catch (error) {
    console.error('一括ズーム変更の根本的な処理に失敗しました:', error);
  }
}

// 一括変更時に開いていなかったオリジンには古い倍率が per-origin で残るため、表示のたびに揃え直す
async function applyLastZoomFactorToTab(tabId, url) {
  if (isBrowserInternalPage(url)) {
    return;
  }

  const stored = await chrome.storage.local.get([LAST_ZOOM_FACTOR_KEY]);
  const lastZoomFactor = stored[LAST_ZOOM_FACTOR_KEY];
  if (!lastZoomFactor) {
    return;
  }

  try {
    const currentZoomFactor = await chrome.tabs.getZoom(tabId);
    if (Math.abs(currentZoomFactor - lastZoomFactor) < ZOOM_FACTOR_EPSILON) {
      return;
    }

    await chrome.tabs.setZoom(tabId, lastZoomFactor);
  } catch (tabUnavailable) {
    console.log(`[想定内] タブ(ID: ${tabId}) にズームを再適用できませんでした。`);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  let zoomFactor = ZOOM_FACTOR_BY_COMMAND[command];

  if (command === 'e-custom-zoom-1' || command === 'f-custom-zoom-2') {
    const stored = await chrome.storage.local.get(['custom1', 'custom2']);
    if (command === 'e-custom-zoom-1') {
      zoomFactor = stored.custom1 || DEFAULT_CUSTOM_ZOOM_1;
    } else {
      zoomFactor = stored.custom2 || DEFAULT_CUSTOM_ZOOM_2;
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
});

chrome.tabs.onZoomChange.addListener((zoomChangeInfo) => {
  updateTabZoomBadge(zoomChangeInfo.tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => updateTabZoomBadge(activeInfo.tabId));

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    // changeInfo.url があるときは遷移先が確定しているので、描画前に揃えてちらつきを避ける
    if (changeInfo.url) {
      await applyLastZoomFactorToTab(tabId, changeInfo.url);
    }
    return;
  }

  if (changeInfo.status === 'complete') {
    await applyLastZoomFactorToTab(tabId, tab.url);
    updateTabZoomBadge(tabId);
  }
});

async function updateTabZoomBadge(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'loading') {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
      return;
    }

    const zoomFactor = await chrome.tabs.getZoom(tabId);
    drawZoomPercentageBadge(tabId, zoomFactor);
  } catch (tabUnavailable) {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
}

function drawZoomPercentageBadge(tabId, zoomFactor) {
  const zoomPercentage = Math.round(zoomFactor * 100);
  chrome.action.setBadgeText({
    text: String(zoomPercentage),
    tabId: tabId
  });
  chrome.action.setBadgeBackgroundColor({
    color: BADGE_BACKGROUND_COLOR,
    tabId: tabId
  });
}
