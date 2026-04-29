interface GlobalArticle {
  id: string
  title: string
  feedTitle: string
  pubDate: string
  isRead?: boolean
  isFavorite?: boolean
}

interface FeedItem {
  id: string
  title: string
  rss: string
  lastUpdated?: number
}

async function getStorageData(keys: string[]): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result)
    })
  })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function formatUpdateTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function init() {
  const [articlesData, favoritesData, feedsData] = await Promise.all([
    getStorageData(['rss_global_articles']),
    getStorageData(['rss_favorites']),
    getStorageData(['rss_feeds'])
  ])

  const articles: GlobalArticle[] = articlesData.rss_global_articles || []
  const favorites = favoritesData.rss_favorites || {}
  const feeds: FeedItem[] = feedsData.rss_feeds || []

  // Stats
  const total = articles.length
  const unread = articles.filter(a => !a.isRead).length
  const favCount = Object.keys(favorites).length

  document.getElementById('total-count')!.textContent = String(total)
  document.getElementById('unread-count')!.textContent = String(unread)
  document.getElementById('favorites-count')!.textContent = String(favCount)

  // Latest update time across all feeds
  const latestUpdate = feeds.reduce((max: number, f: FeedItem) => {
    return f.lastUpdated && f.lastUpdated > max ? f.lastUpdated : max
  }, 0)

  const updateEl = document.getElementById('last-update')!
  if (latestUpdate > 0) {
    updateEl.textContent = `🕐 更新于 ${formatUpdateTime(latestUpdate)}`
    updateEl.style.display = 'block'
  } else {
    updateEl.style.display = 'none'
  }

  // Recent articles (sorted by date, newest first, max 10)
  const sorted = [...articles]
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 10)

  const listEl = document.getElementById('article-list')!

  if (sorted.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div>暂无文章</div>
        <div style="margin-top:4px;font-size:11px;">打开管理页面添加 RSS 源</div>
      </div>
    `
  } else {
    listEl.innerHTML = sorted.map(article => `
      <li class="article-item ${article.isRead ? '' : 'unread'}" data-id="${article.id}">
        <div class="article-feed">${article.feedTitle}</div>
        <div class="article-title">${article.title}</div>
        <div class="article-meta">
          <span>${formatDate(article.pubDate)}</span>
          ${article.isFavorite ? '<span>♥</span>' : ''}
        </div>
      </li>
    `).join('')
  }

  // Open options page button
  document.getElementById('open-options')!.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })

  // Click article → open options page at home
  listEl.querySelectorAll('.article-item').forEach(item => {
    item.addEventListener('click', () => {
      chrome.runtime.openOptionsPage()
    })
  })
}

init().catch(console.error)
