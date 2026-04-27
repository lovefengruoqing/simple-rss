import { ListProp, ContentProp, feedItemProp } from './../Props'

export interface CacheEntry {
  data: any
  timestamp: number
  etag?: string
  lastModified?: string
}

export interface FeedCache {
  [feedId: string]: {
    content: ContentProp | null
    lastUpdated: number
    etag?: string
    lastModified?: string
  }
}

export interface GlobalArticle extends feedItemProp {
  feedId: string
  feedTitle: string
}

export class StorageService {
  private static readonly CACHE_DURATION = 15 * 60 * 1000 // 15 minutes
  private static readonly MAX_CACHE_AGE = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly MAX_ITEMS_PER_FEED = 100 // Limit items per feed
  private static readonly STORAGE_KEYS = {
    FEEDS: 'rss_feeds',
    CONTENT_CACHE: 'rss_content_cache',
    ITEMS_CACHE: 'rss_items_cache',
    READ_STATUS: 'rss_read_status',
    READ_TIMESTAMPS: 'rss_read_timestamps',
    FAVORITES: 'rss_favorites',
    GLOBAL_ARTICLES: 'rss_global_articles'
  }

  // Initialize storage structure
  static async initializeStorage(): Promise<void> {
    try {
      const data = await this.getStorageData()

      if (!data[this.STORAGE_KEYS.FEEDS]) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.FEEDS]: [] })
      }

      if (!data[this.STORAGE_KEYS.CONTENT_CACHE]) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.CONTENT_CACHE]: {} })
      }

      if (!data[this.STORAGE_KEYS.ITEMS_CACHE]) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.ITEMS_CACHE]: {} })
      }

      if (!data[this.STORAGE_KEYS.READ_STATUS]) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.READ_STATUS]: {} })
      }

      if (!data[this.STORAGE_KEYS.FAVORITES]) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.FAVORITES]: {} })
      }

      if (!data[this.STORAGE_KEYS.READ_TIMESTAMPS]) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.READ_TIMESTAMPS]: {} })
      }

      if (!data[this.STORAGE_KEYS.GLOBAL_ARTICLES]) {
        await chrome.storage.local.set({ [this.STORAGE_KEYS.GLOBAL_ARTICLES]: [] })
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error)
    }
  }

  // Get all storage data
  static async getStorageData(): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(result)
      })
    })
  }

  // Save feeds list
  static async saveFeeds(feeds: ListProp): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEYS.FEEDS]: feeds }, () => {
        resolve()
      })
    })
  }

  // Get feeds list
  static async getFeeds(): Promise<ListProp> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.FEEDS], (result) => {
        resolve(result[this.STORAGE_KEYS.FEEDS] || [])
      })
    })
  }

  // Cache management
  static async getCachedContent(feedId: string): Promise<ContentProp | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.CONTENT_CACHE], (result) => {
        const cache: FeedCache = result[this.STORAGE_KEYS.CONTENT_CACHE] || {}
        const entry = cache[feedId]

        if (!entry || !entry.content) {
          resolve(null)
          return
        }

        // Check if cache is still valid
        const now = Date.now()
        const age = now - entry.lastUpdated

        if (age > this.CACHE_DURATION) {
          // Cache expired, but return it anyway for offline use if it's not too old
          if (age > this.MAX_CACHE_AGE) {
            resolve(null)
            return
          }
        }

        resolve(entry.content)
      })
    })
  }

  static async cacheContent(feedId: string, content: ContentProp, etag?: string, lastModified?: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.CONTENT_CACHE], (result) => {
        const cache: FeedCache = result[this.STORAGE_KEYS.CONTENT_CACHE] || {}

        // Limit the number of items to prevent storage bloat
        const limitedItems = content.items.slice(0, this.MAX_ITEMS_PER_FEED)

        cache[feedId] = {
          content: {
            ...content,
            items: limitedItems
          },
          lastUpdated: Date.now(),
          etag,
          lastModified
        }

        chrome.storage.local.set({ [this.STORAGE_KEYS.CONTENT_CACHE]: cache }, () => {
          resolve()
        })
      })
    })
  }

  // Items cache for incremental updates
  static async getCachedItems(feedId: string): Promise<feedItemProp[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.ITEMS_CACHE], (result) => {
        const itemsCache = result[this.STORAGE_KEYS.ITEMS_CACHE] || {}
        resolve(itemsCache[feedId] || [])
      })
    })
  }

  static async saveItems(feedId: string, items: feedItemProp[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.ITEMS_CACHE], (result) => {
        const itemsCache = result[this.STORAGE_KEYS.ITEMS_CACHE] || {}

        // Merge with existing items and remove duplicates
        const existingItems = itemsCache[feedId] || []
        const mergedItems = this.mergeItems(existingItems, items)

        // Limit total items to prevent storage bloat
        itemsCache[feedId] = mergedItems.slice(0, this.MAX_ITEMS_PER_FEED)

        chrome.storage.local.set({ [this.STORAGE_KEYS.ITEMS_CACHE]: itemsCache }, () => {
          resolve()
        })
      })
    })
  }

  // Read status management
  static async getReadStatus(): Promise<{ [itemId: string]: boolean }> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.READ_STATUS], (result) => {
        resolve(result[this.STORAGE_KEYS.READ_STATUS] || {})
      })
    })
  }

  static async setReadStatus(itemId: string, isRead: boolean): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.READ_STATUS, this.STORAGE_KEYS.READ_TIMESTAMPS], (result: any) => {
        const readStatus = result[this.STORAGE_KEYS.READ_STATUS] || {}
        const readTimestamps = result[this.STORAGE_KEYS.READ_TIMESTAMPS] || {}
        readStatus[itemId] = isRead

        if (isRead) {
          readTimestamps[itemId] = Date.now()
        } else {
          delete readTimestamps[itemId]
        }

        chrome.storage.local.set({
          [this.STORAGE_KEYS.READ_STATUS]: readStatus,
          [this.STORAGE_KEYS.READ_TIMESTAMPS]: readTimestamps
        }, () => {
          resolve()
        })
      })
    })
  }

  static async getReadTimestamps(): Promise<{ [itemId: string]: number }> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.READ_TIMESTAMPS], (result: any) => {
        resolve(result[this.STORAGE_KEYS.READ_TIMESTAMPS] || {})
      })
    })
  }

  // Favorites management
  static async getFavorites(): Promise<{ [itemId: string]: boolean }> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.FAVORITES], (result) => {
        resolve(result[this.STORAGE_KEYS.FAVORITES] || {})
      })
    })
  }

  static async setFavorite(itemId: string, isFavorite: boolean): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.FAVORITES], (result) => {
        const favorites = result[this.STORAGE_KEYS.FAVORITES] || {}

        if (isFavorite) {
          favorites[itemId] = true
        } else {
          delete favorites[itemId]
        }

        chrome.storage.local.set({ [this.STORAGE_KEYS.FAVORITES]: favorites }, () => {
          resolve()
        })
      })
    })
  }

  // Apply read and favorite status to items
  static async applyItemStatus(items: feedItemProp[]): Promise<feedItemProp[]> {
    const [readStatus, favorites] = await Promise.all([
      this.getReadStatus(),
      this.getFavorites()
    ])

    return items.map(item => ({
      ...item,
      isRead: readStatus[item.id] || false,
      isFavorite: !!favorites[item.id]
    }))
  }

  // Global article management
  static async saveGlobalArticles(articles: GlobalArticle[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEYS.GLOBAL_ARTICLES]: articles }, () => {
        resolve()
      })
    })
  }

  static async getGlobalArticles(): Promise<GlobalArticle[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.GLOBAL_ARTICLES], (result) => {
        resolve(result[this.STORAGE_KEYS.GLOBAL_ARTICLES] || [])
      })
    })
  }

  static async mergeArticlesToGlobal(feedId: string, feedTitle: string, items: feedItemProp[]): Promise<void> {
    const existing = await this.getGlobalArticles()
    const existingMap = new Map<string, GlobalArticle>()

    existing.forEach(article => {
      existingMap.set(article.id, article)
    })

    items.forEach(item => {
      const existingArticle = existingMap.get(item.id)
      if (existingArticle) {
        // Update metadata but preserve read/favorite status
        existingMap.set(item.id, {
          ...item,
          feedId,
          feedTitle,
          isRead: existingArticle.isRead,
          isFavorite: existingArticle.isFavorite
        })
      } else {
        existingMap.set(item.id, {
          ...item,
          feedId,
          feedTitle
        })
      }
    })

    const merged = Array.from(existingMap.values())
    await this.saveGlobalArticles(merged)
  }

  static async getGlobalFavorites(): Promise<GlobalArticle[]> {
    const articles = await this.getGlobalArticles()
    const favorites = await this.getFavorites()
    return articles.filter(article => favorites[article.id])
  }

  static async getGlobalReadArticles(): Promise<GlobalArticle[]> {
    const articles = await this.getGlobalArticles()
    const readStatus = await this.getReadStatus()
    const readTimestamps = await this.getReadTimestamps()
    return articles
      .filter(article => readStatus[article.id])
      .sort((a, b) => (readTimestamps[b.id] || 0) - (readTimestamps[a.id] || 0))
  }

  static async updateGlobalArticleStatus(itemId: string, isRead?: boolean, isFavorite?: boolean): Promise<void> {
    const articles = await this.getGlobalArticles()
    const updated = articles.map(article => {
      if (article.id === itemId) {
        return {
          ...article,
          ...(isRead !== undefined && { isRead }),
          ...(isFavorite !== undefined && { isFavorite })
        }
      }
      return article
    })
    await this.saveGlobalArticles(updated)
  }

  // Merge new items with existing ones, avoiding duplicates
  private static mergeItems(existing: feedItemProp[], newItems: feedItemProp[]): feedItemProp[] {
    const existingMap = new Map<string, feedItemProp>()

    // Add existing items to map
    existing.forEach(item => {
      const key = item.link || `${item.title}_${item.pubDate}`
      existingMap.set(key, item)
    })

    // Add new items, avoiding duplicates
    newItems.forEach(item => {
      const key = item.link || `${item.title}_${item.pubDate}`
      if (!existingMap.has(key)) {
        existingMap.set(key, item)
      }
    })

    // Convert back to array and sort by date (newest first)
    return Array.from(existingMap.values())
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
  }

  // Clean up old cache entries
  static async cleanupCache(): Promise<void> {
    const now = Date.now()
    const maxAge = this.MAX_CACHE_AGE

    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEYS.CONTENT_CACHE], (result) => {
        const cache: FeedCache = result[this.STORAGE_KEYS.CONTENT_CACHE] || {}
        let cleaned = false

        Object.keys(cache).forEach(feedId => {
          if (now - cache[feedId].lastUpdated > maxAge) {
            delete cache[feedId]
            cleaned = true
          }
        })

        if (cleaned) {
          chrome.storage.local.set({ [this.STORAGE_KEYS.CONTENT_CACHE]: cache })
        }

        resolve()
      })
    })
  }

  // Get storage usage info
  static async getStorageInfo(): Promise<{ size: number; feedCount: number; itemCount: number }> {
    const data = await this.getStorageData()

    let totalSize = 0
    let feedCount = 0
    let itemCount = 0

    // Estimate storage size
    const jsonString = JSON.stringify(data)
    totalSize = new Blob([jsonString]).size

    // Count feeds
    const feeds = data[this.STORAGE_KEYS.FEEDS] || []
    feedCount = feeds.length

    // Count items
    const itemsCache = data[this.STORAGE_KEYS.ITEMS_CACHE] || {}
    Object.values(itemsCache).forEach((items: any) => {
      if (Array.isArray(items)) {
        itemCount += items.length
      }
    })

    return { size: totalSize, feedCount, itemCount }
  }
}