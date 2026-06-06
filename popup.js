document.addEventListener('DOMContentLoaded', async () => {
  const fixedZoomMap = {
    'zoom-90': 0.9,
    'zoom-100': 1.0,
    'zoom-110': 1.1,
    'zoom-125': 1.25
  };
  
  let customValues = {
    c1: 1.50,
    c2: 2.00,
    resetClosed: true // デフォルトは閉じたらリセット（ON）
  };
  
  const stored = await chrome.storage.local.get(['custom1', 'custom2', 'resetClosed']);
  if (stored.custom1) customValues.c1 = stored.custom1;
  if (stored.custom2) customValues.c2 = stored.custom2;
  if (stored.resetClosed !== undefined) customValues.resetClosed = stored.resetClosed;
  
  const inputC1 = document.getElementById('input-c1');
  const inputC2 = document.getElementById('input-c2');
  const checkReset = document.getElementById('check-reset-closed');
  const btnC1 = document.getElementById('custom-1');
  const btnC2 = document.getElementById('custom-2');
  const saveBtn = document.getElementById('save-btn');
  
  inputC1.value = Math.round(customValues.c1 * 100);
  inputC2.value = Math.round(customValues.c2 * 100);
  checkReset.checked = customValues.resetClosed;
  btnC1.textContent = `${inputC1.value}%`;
  btnC2.textContent = `${inputC2.value}%`;
  
  Object.keys(fixedZoomMap).forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      sendZoomMessage(fixedZoomMap[id]);
    });
  });
  
  btnC1.addEventListener('click', () => sendZoomMessage(customValues.c1));
  btnC2.addEventListener('click', () => sendZoomMessage(customValues.c2));
  
  saveBtn.addEventListener('click', async () => {
    const val1 = parseInt(inputC1.value, 10);
    const val2 = parseInt(inputC2.value, 10);
    const isResetClosed = checkReset.checked;
    
    if (isNaN(val1) || val1 < 25 || val1 > 500 || isNaN(val2) || val2 < 25 || val2 > 500) {
      alert('Please enter a value between 25 and 500.');
      return;
    }
    
    const zoomFactor1 = val1 / 100;
    const zoomFactor2 = val2 / 100;
    
    await chrome.storage.local.set({
      custom1: zoomFactor1,
      custom2: zoomFactor2,
      resetClosed: isResetClosed
    });
    
    chrome.runtime.sendMessage({ action: 'settingsChanged' });
    
    customValues.c1 = zoomFactor1;
    customValues.c2 = zoomFactor2;
    customValues.resetClosed = isResetClosed;
    btnC1.textContent = `${val1}%`;
    btnC2.textContent = `${val2}%`;
    
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved! ✨';
    saveBtn.style.backgroundColor = '#3cb371';
    saveBtn.disabled = true;
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '';
      saveBtn.disabled = false;
    }, 600);
  });
  
  function sendZoomMessage(zoomFactor) {
    chrome.runtime.sendMessage({
      action: 'changeZoom',
      zoomFactor: zoomFactor
    });
    window.close();
  }
});
