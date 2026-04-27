import { StorageService } from './services/StorageService'

chrome.runtime.onInstalled.addListener(async () => {
  console.log('RSS Extension installed')

  // Initialize storage
  await StorageService.initializeStorage()

  // Migrate from old storage format if needed
  chrome.storage.sync.get('lists', async (datas) => {
    if (datas.lists) {
      // Migrate to new storage format
      await StorageService.saveFeeds(datas.lists)
      // Clear old sync storage to save space
      chrome.storage.sync.clear()
    } else {
      const feeds = await StorageService.getFeeds()
      if (feeds.length === 0) {
        console.log('No feeds to initialize')
      }
    }
  })

  // Clean up old cache entries periodically
  setInterval(() => {
    StorageService.cleanupCache()
  }, 60 * 60 * 1000) // Every hour
})

// Listen for messages from the UI
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_STORAGE_INFO') {
    StorageService.getStorageInfo().then(info => {
      sendResponse({ success: true, data: info })
    })
    return true // Keep message channel open for async response
  }

  if (request.type === 'CLEANUP_CACHE') {
    StorageService.cleanupCache().then(() => {
      sendResponse({ success: true })
    })
    return true
  }
})

console.log('Background service worker loaded')