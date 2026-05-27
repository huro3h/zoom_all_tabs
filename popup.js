document.addEventListener('DOMContentLoaded', async () => {
  // 固定倍率のマップ
  const fixedZoomMap = {
    'zoom-90': 0.9,
    'zoom-100': 1.0,
    'zoom-110': 1.1,
    'zoom-125': 1.25
  };
  
  // カスタム倍率のデフォルト値
  let customValues = {
    c1: 1.50, // 150%
    c2: 2.00  // 200%
  };
  
  // ストレージから保存されたカスタム倍率を読み込む
  const stored = await chrome.storage.local.get(['custom1', 'custom2']);
  if (stored.custom1) customValues.c1 = stored.custom1;
  if (stored.custom2) customValues.c2 = stored.custom2;
  
  // HTML要素の取得
  const inputC1 = document.getElementById('input-c1');
  const inputC2 = document.getElementById('input-c2');
  const btnC1 = document.getElementById('custom-1');
  const btnC2 = document.getElementById('custom-2');
  const saveBtn = document.getElementById('save-btn'); // 保存ボタン
  
  // UIに入力値とボタンのテキストを反映
  inputC1.value = Math.round(customValues.c1 * 100);
  inputC2.value = Math.round(customValues.c2 * 100);
  btnC1.textContent = `${inputC1.value}%`;
  btnC2.textContent = `${inputC2.value}%`;
  
  // 固定倍率ボタン
  Object.keys(fixedZoomMap).forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      sendZoomMessage(fixedZoomMap[id]);
    });
  });
  
  // カスタム倍率ボタン
  btnC1.addEventListener('click', () => sendZoomMessage(customValues.c1));
  btnC2.addEventListener('click', () => sendZoomMessage(customValues.c2));
  
  // 「設定を保存」ボタン
  saveBtn.addEventListener('click', async () => {
    const val1 = parseInt(inputC1.value, 10);
    const val2 = parseInt(inputC2.value, 10);
    
    // 入力チェック（ここだけはエラー通知なので例外的にalertを残しています）
    if (isNaN(val1) || val1 < 25 || val1 > 500 || isNaN(val2) || val2 < 25 || val2 > 500) {
      alert('25〜500の範囲で数値を入力してください。');
      return;
    }
    
    // 小数点（倍率）に変換
    const zoomFactor1 = val1 / 100;
    const zoomFactor2 = val2 / 100;
    
    // ストレージに保存
    await chrome.storage.local.set({ custom1: zoomFactor1, custom2: zoomFactor2 });
    
    // 内部変数を更新して上のカスタムボタンの表示を書き換える
    customValues.c1 = zoomFactor1;
    customValues.c2 = zoomFactor2;
    btnC1.textContent = `${val1}%`;
    btnC2.textContent = `${val2}%`;
    
    // 保存時のアニメーション
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved! ✨';
    saveBtn.style.backgroundColor = '#3cb371'; // 成功を表す少し明るい緑色に変更
    saveBtn.disabled = true;                    // 連打防止で一時的に無効化
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '';
      saveBtn.disabled = false;
    }, 800);
  });
  
  // メッセージ送信共通関数
  function sendZoomMessage(zoomFactor) {
    chrome.runtime.sendMessage({
      action: 'changeZoom',
      zoomFactor: zoomFactor
    });
    window.close();
  }
});
