document.addEventListener('DOMContentLoaded', async () => {
  const fixedZoomMap = {
    'zoom-90': 0.9,
    'zoom-100': 1.0,
    'zoom-110': 1.1,
    'zoom-125': 1.25
  };
  
  let customValues = {
    c1: 1.50,
    c2: 2.00
  };
  
  // 1. ストレージからカスタム倍率のみを読み込む
  const stored = await chrome.storage.local.get(['custom1', 'custom2']);
  if (stored.custom1) customValues.c1 = stored.custom1;
  if (stored.custom2) customValues.c2 = stored.custom2;
  
  // HTML要素の取得
  const inputC1 = document.getElementById('input-c1');
  const inputC2 = document.getElementById('input-c2');
  const btnC1 = document.getElementById('custom-1');
  const btnC2 = document.getElementById('custom-2');
  const saveBtn = document.getElementById('save-btn');
  
  // UIに反映
  inputC1.value = Math.round(customValues.c1 * 100);
  inputC2.value = Math.round(customValues.c2 * 100);
  btnC1.textContent = `${inputC1.value}%`;
  btnC2.textContent = `${inputC2.value}%`;
  
  // --- クリックイベント ---
  Object.keys(fixedZoomMap).forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      sendZoomMessage(fixedZoomMap[id]);
    });
  });
  
  btnC1.addEventListener('click', () => sendZoomMessage(customValues.c1));
  btnC2.addEventListener('click', () => sendZoomMessage(customValues.c2));
  
  // chrome:// は a href では開けないため tabs.create を使う
  document.getElementById('zoom-levels-link').addEventListener('click', (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: 'chrome://settings/content/zoomLevels' });
    window.close();
  });
  
  // 「Save Settings」ボタン
  saveBtn.addEventListener('click', async () => {
    const val1 = parseInt(inputC1.value, 10);
    const val2 = parseInt(inputC2.value, 10);
    
    if (isNaN(val1) || val1 < 25 || val1 > 500 || isNaN(val2) || val2 < 25 || val2 > 500) {
      alert('Please enter a value between 25 and 500.');
      return;
    }
    
    const zoomFactor1 = val1 / 100;
    const zoomFactor2 = val2 / 100;
    
    // ストレージに保存
    await chrome.storage.local.set({
      custom1: zoomFactor1,
      custom2: zoomFactor2
    });
    
    customValues.c1 = zoomFactor1;
    customValues.c2 = zoomFactor2;
    btnC1.textContent = `${val1}%`;
    btnC2.textContent = `${val2}%`;
    
    // インラインフィードバック (Saved! ✨)
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved! ✨';
    saveBtn.style.backgroundColor = '#3cb371';
    saveBtn.disabled = true;
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '';
      saveBtn.disabled = false;
    }, 1500);
  });
  
  function sendZoomMessage(zoomFactor) {
    chrome.runtime.sendMessage({
      action: 'changeZoom',
      zoomFactor: zoomFactor
    });
    window.close();
  }
});
