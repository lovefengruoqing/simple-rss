import { oneItemProp, feedItemProp, ContentProp } from './../Props'
import { StorageService } from './StorageService'

export class RSSService {
  private static readonly CONCURRENCY_LIMIT = 3
  private static readonly UPDATE_TIMEOUT = 10000 // 10 seconds

  // Generate unique ID for RSS items
  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Fetch RSS feed with caching, ETags, and incremental updates
  static async fetchRSSFeed(feed: oneItemProp, forceRefresh = false): Promise<ContentProp | null> {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedContent = await StorageService.getCachedContent(feed.id)
        if (cachedContent) {
          console.log(`Using cached content for ${feed.title}`)
          return StorageService.applyItemStatus(cachedContent.items).then(items => ({
            ...cachedContent,
            items
          }))
        }
      }

      // Get existing items for incremental update
      const existingItems = await StorageService.getCachedItems(feed.id)
      const existingItemsMap = new Map<string, feedItemProp>()
      existingItems.forEach(item => {
        const key = item.link || `${item.title}_${item.pubDate}`
        existingItemsMap.set(key, item)
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.UPDATE_TIMEOUT)

      // Get cached ETag and Last-Modified for conditional requests
      const cachedContent = await StorageService.getCachedContent(feed.id)
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      }

      // Get cache entry with metadata from storage
      const storageData = await new Promise<any>((resolve) => {
        chrome.storage.local.get(['rss_content_cache'], (result) => {
          resolve(result.rss_content_cache || {})
        })
      })

      const cacheEntry = storageData[feed.id]
      if (cacheEntry && cacheEntry.etag) {
        headers['If-None-Match'] = cacheEntry.etag
      }
      if (cacheEntry && cacheEntry.lastModified) {
        headers['If-Modified-Since'] = cacheEntry.lastModified
      }

      const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.rss)}`, {
        signal: controller.signal,
        headers
      })

      clearTimeout(timeoutId)

      // Handle 304 Not Modified - return cached content
      if (response.status === 304) {
        console.log(`Feed not modified: ${feed.title}`)
        if (cachedContent) {
          return StorageService.applyItemStatus(cachedContent.items).then(items => ({
            ...cachedContent,
            items
          }))
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status !== 'ok') {
        throw new Error(`RSS API error: ${data.message || 'Unknown error'}`)
      }

      // Extract ETag and Last-Modified from response
      const etag = response.headers.get('etag') || undefined
      const lastModified = response.headers.get('last-modified') || undefined

      // Process new items
      const newItems = data.items.map((item: any) => {
        const key = item.link || `${item.title}_${item.pubDate}`
        const existingItem = existingItemsMap.get(key)

        return {
          ...item,
          id: existingItem?.id || this.generateId(),
          isRead: existingItem?.isRead || false,
          isFavorite: existingItem?.isFavorite || false,
          dateAdded: existingItem?.dateAdded || Date.now()
        }
      })

      // Merge with existing items for incremental update
      const allItems = this.mergeIncrementalItems(existingItems, newItems)

      const content: ContentProp = {
        ...data,
        items: allItems,
        lastUpdated: Date.now()
      }

      // Cache the content
      await StorageService.cacheContent(feed.id, content, etag, lastModified)
      await StorageService.saveItems(feed.id, allItems)

      // Apply current status
      const itemsWithStatus = await StorageService.applyItemStatus(content.items)

      return {
        ...content,
        items: itemsWithStatus
      }
    } catch (error) {
      console.error('Failed to fetch RSS feed:', feed.title, error)

      // Return cached content on error if available
      const cachedContent = await StorageService.getCachedContent(feed.id)
      if (cachedContent) {
        console.log(`Using cached content as fallback for ${feed.title}`)
        const itemsWithStatus = await StorageService.applyItemStatus(cachedContent.items)
        return {
          ...cachedContent,
          items: itemsWithStatus
        }
      }

      return null
    }
  }

  // Update single RSS feed
  static async updateFeed(feed: oneItemProp, forceRefresh = false): Promise<{ feed: oneItemProp, content: ContentProp | null }> {
    const updatedFeed = {
      ...feed,
      isUpdating: true,
      lastUpdated: Date.now()
    }

    const content = await this.fetchRSSFeed(feed, forceRefresh)

    return {
      feed: {
        ...updatedFeed,
        isUpdating: false
      },
      content
    }
  }

  // Update multiple RSS feeds with intelligent caching and concurrency control
  static async updateAllFeeds(feeds: oneItemProp[]): Promise<Array<{ feed: oneItemProp, content: ContentProp | null }>> {
    const results: Array<{ feed: oneItemProp, content: ContentProp | null }> = []
    const queue = [...feeds]

    // Filter feeds that need updating (not updated recently)
    const now = Date.now()
    const UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes

    const feedsToUpdate = queue.filter(feed => {
      const timeSinceUpdate = now - (feed.lastUpdated || 0)
      return timeSinceUpdate > UPDATE_INTERVAL
    })

    console.log(`Updating ${feedsToUpdate.length} out of ${feeds.length} feeds`)

    // If all feeds are fresh, return cached content
    if (feedsToUpdate.length === 0) {
      for (const feed of feeds) {
        const cachedContent = await StorageService.getCachedContent(feed.id)
        const itemsWithStatus = cachedContent ? await StorageService.applyItemStatus(cachedContent.items) : null

        results.push({
          feed: { ...feed, isUpdating: false },
          content: cachedContent ? { ...cachedContent, items: itemsWithStatus || [] } : null
        })
      }
      return results
    }

    // Process feeds that need updating in batches
    while (feedsToUpdate.length > 0) {
      const batch = feedsToUpdate.splice(0, this.CONCURRENCY_LIMIT)
      const batchPromises = batch.map(feed => this.updateFeed(feed, true))

      try {
        const batchResults = await Promise.allSettled(batchPromises)

        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value)
          } else {
            console.error('Feed update failed:', result.reason)
            // Try to use cached content on failure
            const feed = feeds.find(f => f.id === (result.reason as any)?.feed?.id) || feeds[0]
            StorageService.getCachedContent(feed.id).then(cachedContent => {
              results.push({
                feed: { ...feed, isUpdating: false },
                content: cachedContent
              })
            })
          }
        })
      } catch (error) {
        console.error('Batch update failed:', error)
      }

      // Delay between batches to respect rate limits
      if (feedsToUpdate.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
      }
    }

    // Add feeds that didn't need updating (with cached content)
    const updatedFeedIds = new Set(results.map(r => r.feed.id))
    for (const feed of feeds) {
      if (!updatedFeedIds.has(feed.id)) {
        const cachedContent = await StorageService.getCachedContent(feed.id)
        const itemsWithStatus = cachedContent ? await StorageService.applyItemStatus(cachedContent.items) : null

        results.push({
          feed: { ...feed, isUpdating: false },
          content: cachedContent ? { ...cachedContent, items: itemsWithStatus || [] } : null
        })
      }
    }

    return results
  }

  // Merge items incrementally (for RSS service updates)
  static mergeIncrementalItems(existingItems: feedItemProp[], newItems: feedItemProp[]): feedItemProp[] {
    const existingMap = new Map<string, feedItemProp>()

    // Add existing items to map
    existingItems.forEach(item => {
      const key = item.link || `${item.title}_${item.pubDate}`
      existingMap.set(key, item)
    })

    // Add new items, preserving existing read/favorite status
    let newItemsCount = 0
    newItems.forEach(newItem => {
      const key = newItem.link || `${newItem.title}_${newItem.pubDate}`
      const existing = existingMap.get(key)

      if (existing) {
        // Update existing item with new content but preserve status
        existingMap.set(key, {
          ...newItem,
          id: existing.id,
          isRead: existing.isRead,
          isFavorite: existing.isFavorite,
          dateAdded: existing.dateAdded
        })
      } else {
        // Add new item
        existingMap.set(key, newItem)
        newItemsCount++
      }
    })

    console.log(`Added ${newItemsCount} new items`)

    // Convert back to array, sort by date, and limit
    return Array.from(existingMap.values())
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 500) // Reasonable limit for storage
  }

  // Export article to PDF (using browser's print to PDF feature)
  static exportToPDF(item: feedItemProp): void {
    // Create a temporary iframe for PDF generation
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.zIndex = '-1'

    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      alert('Unable to create PDF export')
      document.body.removeChild(iframe)
      return
    }

    // Sanitize title for PDF filename (not used in current implementation but prepared for future use)
    // const sanitizedTitle = item.title.replace(/[^a-zA-Z0-9一-龥\s-]/g, '').substring(0, 50)

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${item.title} - RSS Article</title>
          <meta name="description" content="Exported from Simple RSS Reader">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #2d3748;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 10px;
              font-size: 24px;
              margin-bottom: 20px;
            }
            .meta {
              color: #718096;
              font-size: 14px;
              margin-bottom: 20px;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .content {
              font-size: 16px;
            }
            .content img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              margin: 10px 0;
            }
            .content p {
              margin: 12px 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 15px;
              }
              .meta {
                background: #f0f0f0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${item.title}</h1>
          <div class="meta">
            <p><strong>Author:</strong> ${item.author || 'Unknown'}</p>
            <p><strong>Published:</strong> ${new Date(item.pubDate).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</p>
            ${item.link ? `<p><strong>Source:</strong> <a href="${item.link}">${item.link}</a></p>` : ''}
          </div>
          <div class="content">
            ${item.content || item.description}
          </div>
          <script>
            // Auto-trigger print dialog
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  if (window.parent && window.parent.document.body.contains(document.body.parentElement)) {
                    window.parent.document.body.removeChild(document.body.parentElement);
                  }
                }, 3000);
              }, 800);
            };
          </script>
        </body>
      </html>
    `

    iframeDoc.open()
    iframeDoc.write(htmlContent)
    iframeDoc.close()

    // Trigger print after content is loaded
    iframe.onload = () => {
      try {
        iframe.contentWindow?.print()
        // Clean up after printing
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 5000)
      } catch (error) {
        console.error('PDF export failed:', error)
        alert('PDF export failed. Please try again.')
        document.body.removeChild(iframe)
      }
    }

    // Fallback cleanup
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
    }, 10000)
  }
}