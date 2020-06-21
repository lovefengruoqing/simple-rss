chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.get('lists', (datas) => {
    if (datas.lists === undefined) {
      chrome.storage.sync.set({lists: []});
    }
  });
});
