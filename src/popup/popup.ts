import { DOMSnapshot } from '../types/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  const tabTitleEl = document.getElementById('tab-title');
  const metricInteractiveEl = document.getElementById('metric-interactive');
  const metricTokensEl = document.getElementById('metric-tokens');
  const btnSnapshot = document.getElementById('btn-snapshot');
  const previewBox = document.getElementById('preview-box');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      const activeTab = tabs[0];
      if (tabTitleEl) {
        tabTitleEl.textContent = activeTab.title || activeTab.url || 'Active Tab';
      }
    }
  } catch (err) {
    if (tabTitleEl) tabTitleEl.textContent = 'Error querying tab';
  }

  btnSnapshot?.addEventListener('click', async () => {
    btnSnapshot.textContent = 'Capturing...';
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DOM_SNAPSHOT'
      });

      if (response && response.success && response.data) {
        const snapshot = response.data as DOMSnapshot;
        if (metricInteractiveEl) metricInteractiveEl.textContent = String(snapshot.interactiveCount);
        if (metricTokensEl) metricTokensEl.textContent = `~${snapshot.estimatedTokens}`;
        if (previewBox) {
          previewBox.style.display = 'block';
          previewBox.textContent = snapshot.markdown.slice(0, 1500) + (snapshot.markdown.length > 1500 ? '\n... [truncated for preview]' : '');
        }
      } else {
        if (previewBox) {
          previewBox.style.display = 'block';
          previewBox.textContent = `Error: ${response?.error || 'Unknown error'}`;
        }
      }
    } catch (err: any) {
      if (previewBox) {
        previewBox.style.display = 'block';
        previewBox.textContent = `Exception: ${err?.message || err}`;
      }
    } finally {
      btnSnapshot.textContent = 'Capture Token-Pruned Snapshot';
    }
  });
});
