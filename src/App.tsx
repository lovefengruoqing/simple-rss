import React, { useState, useEffect, useCallback, useRef } from 'react'
import { oneItemProp, ListProp, ContentProp, feedItemProp } from './Props'
import { RSSService } from './services/RSSService'
import { StorageService, GlobalArticle } from './services/StorageService'
import TreeItems from './TreeItems'
import AddItem from './components/AddItem'
import MainContent from './MainContent'
import ReadingViewContent from './components/ReadingViewContent'
import './styles/App.css'
import './styles/FavoritesList.css'
import './styles/ReadingViewContent.css'

const App: React.FC = () => {
  const [isShow, setShow] = useState(false)
  const [lists, setLists] = useState<ListProp>([])
  const [content, setContent] = useState<ContentProp | null>(null)
  const [item, setItem] = useState<oneItemProp>({ id: '', title: '', rss: '' })
  const [cur, setCur] = useState<number>(-1)
  const [selectedArticle, setSelectedArticle] = useState<feedItemProp | null>(null)
  const [isUpdatingAll, setIsUpdatingAll] = useState(false)
  const [currentPage, setCurrentPage] = useState<'home' | 'subscriptions' | 'favorites' | 'history'>('home')
  const [showAllArticles, setShowAllArticles] = useState(false)
  const [selectedFeedIndex, setSelectedFeedIndex] = useState<number>(-1)
  const [globalArticles, setGlobalArticles] = useState<GlobalArticle[]>([])
  const [globalFavorites, setGlobalFavorites] = useState<GlobalArticle[]>([])
  const [globalReadArticles, setGlobalReadArticles] = useState<GlobalArticle[]>([])
  const [homeArticle, setHomeArticle] = useState<GlobalArticle | null>(null)
  const [readTimestamps, setReadTimestamps] = useState<{ [itemId: string]: number }>({})
  const isInitialized = useRef(false)

  const formatTimeAgo = (ts: number): string => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const loadGlobalData = useCallback(async () => {
    const [articles, favorites, readArticles, timestamps] = await Promise.all([
      StorageService.getGlobalArticles(),
      StorageService.getGlobalFavorites(),
      StorageService.getGlobalReadArticles(),
      StorageService.getReadTimestamps()
    ])
    setGlobalArticles(articles)
    setGlobalFavorites(favorites)
    setGlobalReadArticles(readArticles)
    setReadTimestamps(timestamps)
  }, [])

  const mergeToGlobal = useCallback(async (feedId: string, feedTitle: string, items: feedItemProp[]) => {
    await StorageService.mergeArticlesToGlobal(feedId, feedTitle, items)
    await loadGlobalData()
  }, [loadGlobalData])

  // Auto-refresh when navigating to home page
  const refreshHomePage = useCallback(async () => {
    await loadGlobalData()
    if (lists.length > 0) {
      // Trigger background update of all feeds
      setIsUpdatingAll(true)
      try {
        const results = await RSSService.updateAllFeeds(lists)
        const updatedLists = results.map(result => result.feed)
        await StorageService.saveFeeds(updatedLists)
        setLists(updatedLists)
        for (const result of results) {
          if (result.content) {
            const feed = updatedLists.find(f => f.id === result.feed.id)
            await StorageService.mergeArticlesToGlobal(result.feed.id, feed?.title || result.feed.title, result.content.items)
          }
        }
        await loadGlobalData()
      } catch (error) {
        console.error('Failed to refresh feeds:', error)
      } finally {
        setIsUpdatingAll(false)
      }
    }
  }, [lists, loadGlobalData])

  const addOneRecord = (one: oneItemProp, currentIndex: number) => {
    StorageService.getFeeds().then(currentLists => {
      const feedWithId = { ...one, id: RSSService.generateId() }
      if (currentIndex === -1) {
        currentLists.push(feedWithId)
      } else {
        currentLists.splice(currentIndex, 1, feedWithId)
      }
      StorageService.saveFeeds(currentLists).then(() => {
        setLists(currentLists)
        setItem({ id: '', title: '', rss: '' })
      })
    })
  }

  const hidden = () => {
    setShow(false)
    setItem({ id: '', title: '', rss: '' })
  }

  const crawlerContent = async (_url: string, feedIndex: number) => {
    try {
      setSelectedFeedIndex(feedIndex)
      const feed = lists[feedIndex]
      if (!feed) return
      setSelectedArticle(null)
      setHomeArticle(null)

      const loadingContent: ContentProp = {
        status: 'loading',
        feed: { link: feed.rss, title: feed.title, description: 'Loading...' },
        items: []
      }
      setContent(loadingContent)

      let cachedContent = await StorageService.getCachedContent(feed.id)
      if (cachedContent) {
        setContent(cachedContent)
      }

      const result = await RSSService.updateFeed(feed, false)
      if (result.content) {
        setContent(result.content)
        await mergeToGlobal(feed.id, feed.title, result.content.items)
      } else if (!cachedContent) {
        setContent({
          status: 'error',
          feed: { link: feed.rss, title: feed.title, description: 'Failed to load RSS feed' },
          items: []
        })
      }
    } catch (error) {
      console.error('Failed to fetch RSS:', error)
      const feed = lists[feedIndex]
      if (feed) {
        setContent({
          status: 'error',
          feed: { link: feed.rss, title: feed.title, description: 'Failed to load RSS feed' },
          items: []
        })
      }
    }
  }

  const deleteOneItem = (index: number) => {
    StorageService.getFeeds().then(currentLists => {
      currentLists.splice(index, 1)
      StorageService.saveFeeds(currentLists).then(() => {
        setLists(currentLists)
      })
    })
  }

  const updateFeed = async (feedIndex: number) => {
    const feed = lists[feedIndex]
    if (!feed) return
    const updatedLists = [...lists]
    updatedLists[feedIndex] = { ...feed, isUpdating: true }
    setLists(updatedLists)
    try {
      const result = await RSSService.updateFeed(feed, true)
      const finalLists = [...lists]
      finalLists[feedIndex] = result.feed
      await StorageService.saveFeeds(finalLists)
      setLists(finalLists)
      if (result.content) {
        setContent(result.content)
        await mergeToGlobal(feed.id, feed.title, result.content.items)
      }
    } catch (error) {
      console.error('Failed to update feed:', error)
      const resetLists = [...lists]
      resetLists[feedIndex] = { ...feed, isUpdating: false }
      setLists(resetLists)
    }
  }

  const updateAllFeeds = async () => {
    setIsUpdatingAll(true)
    try {
      const results = await RSSService.updateAllFeeds(lists)
      const updatedLists = results.map(result => result.feed)
      await StorageService.saveFeeds(updatedLists)
      setLists(updatedLists)

      if (selectedFeedIndex >= 0 && selectedFeedIndex < results.length) {
        const selectedResult = results[selectedFeedIndex]
        if (selectedResult.content) {
          setContent(selectedResult.content)
        }
      }

      for (const result of results) {
        if (result.content) {
          const feed = updatedLists.find(f => f.id === result.feed.id)
          await mergeToGlobal(result.feed.id, feed?.title || result.feed.title, result.content.items)
        }
      }
    } catch (error) {
      console.error('Failed to update all feeds:', error)
    } finally {
      setIsUpdatingAll(false)
    }
  }

  const modifyOneItem = (one: oneItemProp, index: number) => {
    setItem(one)
    setShow(true)
    setCur(index)
  }

  const openReadingView = async (article: feedItemProp) => {
    setSelectedArticle(article)
    if (!article.isRead) {
      await toggleRead(article.id)
    }
  }

  // Open article reading view from home page
  const openHomeArticle = async (article: GlobalArticle) => {
    setHomeArticle(article)
    setSelectedArticle(article)
    if (!article.isRead) {
      await StorageService.setReadStatus(article.id, true)
      await StorageService.updateGlobalArticleStatus(article.id, true, undefined)
      await loadGlobalData()
    }
  }

  // Close home article and return to dashboard
  const closeHomeArticle = () => {
    setHomeArticle(null)
    setSelectedArticle(null)
  }

  const toggleFavorite = async (itemId: string) => {
    if (!content) return
    const article = content.items.find(i => i.id === itemId)
    if (!article) return
    const newFavoriteStatus = !article.isFavorite
    await StorageService.setFavorite(itemId, newFavoriteStatus)
    await StorageService.updateGlobalArticleStatus(itemId, undefined, newFavoriteStatus)

    const updatedItems = content.items.map(item =>
      item.id === itemId ? { ...item, isFavorite: newFavoriteStatus } : item
    )
    setContent({ ...content, items: updatedItems })
    await StorageService.saveItems(content.feed?.link || '', updatedItems)

    // Also update homeArticle if it's the same
    if (homeArticle && homeArticle.id === itemId) {
      setHomeArticle({ ...homeArticle, isFavorite: newFavoriteStatus })
    }
    await loadGlobalData()
  }

  const toggleRead = async (itemId: string) => {
    if (!content) return
    const article = content.items.find(i => i.id === itemId)
    if (!article) return
    const newReadStatus = !article.isRead
    await StorageService.setReadStatus(itemId, newReadStatus)
    await StorageService.updateGlobalArticleStatus(itemId, newReadStatus, undefined)

    const updatedItems = content.items.map(item =>
      item.id === itemId ? { ...item, isRead: newReadStatus } : item
    )
    setContent({ ...content, items: updatedItems })
    await StorageService.saveItems(content.feed?.link || '', updatedItems)

    if (homeArticle && homeArticle.id === itemId) {
      setHomeArticle({ ...homeArticle, isRead: newReadStatus })
    }
    await loadGlobalData()
  }

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await StorageService.initializeStorage()
        const feeds = await StorageService.getFeeds()
        const feedsWithIds = feeds.map(feed => ({
          ...feed,
          id: feed.id || RSSService.generateId()
        }))
        setLists(feedsWithIds)

        for (const feed of feedsWithIds) {
          const cachedContent = await StorageService.getCachedContent(feed.id)
          if (cachedContent && cachedContent.items.length > 0) {
            await StorageService.mergeArticlesToGlobal(feed.id, feed.title, cachedContent.items)
          }
        }
        await loadGlobalData()

        if (feedsWithIds.length > 0) {
          const firstFeed = feedsWithIds[0]
          const cachedContent = await StorageService.getCachedContent(firstFeed.id)
          if (cachedContent) {
            setContent(cachedContent)
            setSelectedFeedIndex(0)
          }
        }
        isInitialized.current = true
      } catch (error) {
        console.error('Failed to initialize app:', error)
      }
    }
    initializeApp()
  }, [])

  // Auto-refresh when navigating to home page (after initial load)
  useEffect(() => {
    if (isInitialized.current && currentPage === 'home') {
      refreshHomePage()
    }
  }, [currentPage])

  // Reload global data when switching to favorites/history pages
  useEffect(() => {
    if (currentPage === 'favorites' || currentPage === 'history') {
      loadGlobalData()
    }
  }, [currentPage, loadGlobalData])

  const totalArticles = globalArticles.length
  const totalUnread = globalArticles.filter(a => !a.isRead).length
  const totalRead = globalArticles.filter(a => a.isRead).length
  const totalFavorites = globalFavorites.length

  // Reading progress percentage
  const readPercentage = totalArticles > 0 ? Math.round((totalRead / totalArticles) * 100) : 0

  // Recent articles sorted by date
  const recentGlobalArticles = [...globalArticles]
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // Today's articles
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayArticles = recentGlobalArticles.filter(
    a => new Date(a.pubDate) >= todayStart
  )

  // Articles from last 7 days
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weekArticles = recentGlobalArticles.filter(
    a => new Date(a.pubDate) >= weekStart
  )

  // Feed stats
  const feedStats = lists.map(feed => {
    const feedArts = globalArticles.filter(a => a.feedId === feed.id)
    const unread = feedArts.filter(a => !a.isRead).length
    return { ...feed, articleCount: feedArts.length, unreadCount: unread }
  }).sort((a, b) => b.unreadCount - a.unreadCount)

  // Favorite articles sorted by date
  const sortedFavorites = [...globalFavorites]
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // Read articles sorted by date
  const sortedReadArticles = [...globalReadArticles]
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  return (
    <div className="app">
      <header>
        <span className="logo" />
        <span className="title">Simple RSS</span>
        <div className="header-actions">
          <div className="nav-menu">
            <button
              className={`nav-btn ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentPage('home')}
            >
              🏠 首页
            </button>
            <button
              className={`nav-btn ${currentPage === 'subscriptions' ? 'active' : ''}`}
              onClick={() => setCurrentPage('subscriptions')}
            >
              📡 已订阅 ({lists.length})
            </button>
            <button
              className={`nav-btn ${currentPage === 'favorites' ? 'active' : ''}`}
              onClick={() => setCurrentPage('favorites')}
            >
              ♥ 收藏 ({totalFavorites})
            </button>
            <button
              className={`nav-btn ${currentPage === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentPage('history')}
            >
              📚 足迹 ({totalRead})
            </button>
          </div>
          <span className="header-update-time" id="header-update-time">
            {lists.reduce((max, f) => f.lastUpdated && f.lastUpdated > max ? f.lastUpdated : max, 0) > 0
              ? `🕐 ${formatTimeAgo(lists.reduce((max, f) => f.lastUpdated && f.lastUpdated > max ? f.lastUpdated : max, 0))}`
              : ''}
          </span>
          <button
            className={`update-all-btn ${isUpdatingAll ? 'updating' : ''}`}
            onClick={updateAllFeeds}
            disabled={isUpdatingAll || lists.length === 0}
            title="Update all feeds"
          >
            {isUpdatingAll ? '🔄 更新中...' : '🔄 更新全部'}
          </button>
        </div>
      </header>
      <div className="main-container">
        {currentPage === 'home' && (
          <div className="home-page">
            {lists.length === 0 ? (
              <div className="home-empty">
                <div className="empty-icon">📡</div>
                <h3>还没有订阅任何 RSS 源</h3>
                <p>点击「已订阅」页面添加你的第一个 RSS 订阅吧！</p>
                <button className="action-btn primary" onClick={() => setCurrentPage('subscriptions')}>
                  📡 添加订阅
                </button>
              </div>
            ) : (
              <div className="dashboard">
                {/* Top stats row */}
                <div className="stats-row">
                  <div className="stat-card stat-articles">
                    <div className="stat-icon">📄</div>
                    <div className="stat-number">{totalArticles}</div>
                    <div className="stat-label">总文章数</div>
                  </div>
                  <div className="stat-card stat-unread">
                    <div className="stat-icon">🔴</div>
                    <div className="stat-number">{totalUnread}</div>
                    <div className="stat-label">未读文章</div>
                  </div>
                  <div className="stat-card stat-read">
                    <div className="stat-icon">✅</div>
                    <div className="stat-number">{totalRead}</div>
                    <div className="stat-label">已读文章</div>
                  </div>
                  <div className="stat-card stat-feeds">
                    <div className="stat-icon">📡</div>
                    <div className="stat-number">{lists.length}</div>
                    <div className="stat-label">订阅源</div>
                  </div>
                  <div className="stat-card stat-favorites">
                    <div className="stat-icon">❤️</div>
                    <div className="stat-number">{totalFavorites}</div>
                    <div className="stat-label">收藏文章</div>
                  </div>
                </div>

                {/* 3-column layout: stats+feeds | article list | reading view */}
                <div className="home-3columns">
                  {/* Column 1: Stats + Feed overview */}
                  <div className="home-col home-col-left">
                    {/* Reading progress */}
                    <div className="home-section progress-section">
                      <h3>📈 阅读进度</h3>
                      <div className="progress-card">
                        <div className="progress-ring">
                          <svg viewBox="0 0 36 36" className="circular-chart">
                            <path className="circle-bg"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path className="circle"
                              strokeDasharray={`${readPercentage}, 100`}
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <text x="18" y="20.35" className="percentage">{readPercentage}%</text>
                          </svg>
                          <div className="progress-info">
                            <span className="progress-read">{totalRead} 已读</span>
                            <span className="progress-divider">/</span>
                            <span className="progress-total">{totalArticles} 总计</span>
                          </div>
                        </div>
                        <div className="progress-stats">
                          <div className="progress-stat">
                            <span className="ps-number">{todayArticles.length}</span>
                            <span className="ps-label">今日新增</span>
                          </div>
                          <div className="progress-stat">
                            <span className="ps-number">{weekArticles.length}</span>
                            <span className="ps-label">本周新增</span>
                          </div>
                          <div className="progress-stat">
                            <span className="ps-number">{totalUnread}</span>
                            <span className="ps-label">待阅读</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Feed overview */}
                    <div className="home-section feed-section">
                      <h3>📡 订阅概览</h3>
                      <div className="feed-cards">
                        {feedStats.map((feed) => (
                          <div
                            key={feed.id}
                            className="feed-card"
                            onClick={() => {
                              setCurrentPage('subscriptions')
                              const idx = lists.findIndex(f => f.id === feed.id)
                              if (idx >= 0) crawlerContent(feed.rss, idx)
                            }}
                          >
                            <div className="feed-card-header">
                              <h4>{feed.title}</h4>
                              {feed.isUpdating && <span className="updating-badge">🔄</span>}
                            </div>
                            <div className="feed-card-stats">
                              <span className="feed-total">{feed.articleCount} 篇</span>
                              {feed.unreadCount > 0 && (
                                <span className="feed-unread">{feed.unreadCount} 未读</span>
                              )}
                            </div>
                            {feed.lastUpdated && (
                              <div className="feed-card-time">
                                更新于 {new Date(feed.lastUpdated).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Recent articles list */}
                  <div className="home-col home-col-middle">
                    <div className="home-section home-section-fill">
                      <h3>🕒 最新文章</h3>
                      <div className="recent-list">
                        {recentGlobalArticles.length === 0 ? (
                          <div className="recent-empty">
                            <p>暂无文章</p>
                            <small>添加 RSS 源并更新来获取文章</small>
                          </div>
                        ) : (
                          recentGlobalArticles.slice(0, 30).map(article => (
                            <div
                              key={article.id}
                              className={`recent-item ${article.isRead ? 'read' : 'unread'} ${homeArticle?.id === article.id ? 'active' : ''}`}
                              onClick={() => openHomeArticle(article)}
                            >
                              <div className="recent-item-main">
                                <div className="recent-item-feed">{article.feedTitle}</div>
                                <div className="recent-item-title">{article.title}</div>
                              </div>
                              <div className="recent-item-meta">
                                {article.isFavorite && <span className="fav-mark">♥</span>}
                                <span className="date">{new Date(article.pubDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Article reading view */}
                  <div className="home-col home-col-right">
                    {homeArticle ? (
                      <div className="home-reading">
                        <button className="back-to-home" onClick={closeHomeArticle}>
                          ← 返回
                        </button>
                        <ReadingViewContent
                          article={homeArticle}
                          onToggleFavorite={(id) => {
                            setContent({
                              status: 'ok',
                              feed: { link: '', title: homeArticle.feedTitle, description: '' },
                              items: [homeArticle]
                            })
                            toggleFavorite(id)
                          }}
                          onToggleRead={(id) => {
                            setContent({
                              status: 'ok',
                              feed: { link: '', title: homeArticle.feedTitle, description: '' },
                              items: [homeArticle]
                            })
                            toggleRead(id)
                          }}
                        />
                      </div>
                    ) : (
                      <div className="home-reading-empty">
                        <div className="empty-icon">📖</div>
                        <p>选择一篇文章开始阅读</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentPage === 'subscriptions' && (
          <>
            <aside className="feeds-sidebar">
              <div className="aside_title">
                <h3>已订阅 RSS 列表</h3>
                <span className="add" onClick={() => setShow(!isShow)} title="add new rss"></span>
              </div>
              <TreeItems
                lists={lists}
                crawlerContent={crawlerContent}
                deleteOneItem={deleteOneItem}
                modifyOneItem={modifyOneItem}
                updateFeed={updateFeed}
                selectedIndex={selectedFeedIndex}
              />
            </aside>

            <section className="articles-list">
              {content && content.status === 'ok' ? (
                <MainContent
                  content={content}
                  onArticleClick={openReadingView}
                  selectedFeedIndex={selectedFeedIndex}
                  showAllArticles={showAllArticles}
                  onToggleShowAll={setShowAllArticles}
                />
              ) : (
                <div className="empty-state">
                  <h3>选择一个 RSS 订阅</h3>
                  <p>从左侧列表中选择 RSS 订阅来查看文章</p>
                </div>
              )}
            </section>

            <section className="article-detail">
              {selectedArticle ? (
                <ReadingViewContent
                  article={selectedArticle}
                  onToggleFavorite={toggleFavorite}
                  onToggleRead={toggleRead}
                />
              ) : (
                <div className="empty-state">
                  <h3>选择一篇文章</h3>
                  <p>从中间列表中选择一篇文章来阅读详细内容</p>
                </div>
              )}
            </section>
          </>
        )}

        {currentPage === 'favorites' && (
          <>
            <aside className="feeds-sidebar">
              <div className="aside_title">
                <h3>♥ 收藏的文章 ({sortedFavorites.length})</h3>
              </div>
              <div className="global-list">
                {sortedFavorites.length === 0 ? (
                  <div className="empty-state">
                    <p>暂无收藏的文章</p>
                    <small>点击文章旁边的❤️来收藏文章</small>
                  </div>
                ) : (
                  sortedFavorites.map(article => (
                    <div
                      key={article.id}
                      className={`global-item ${article.isRead ? 'read' : 'unread'} ${selectedArticle?.id === article.id ? 'selected' : ''}`}
                      onClick={() => openReadingView(article)}
                    >
                      <div className="global-item-feed">{article.feedTitle}</div>
                      <h4>{article.title}</h4>
                      <div className="meta">
                        {article.author && <span className="author">{article.author}</span>}
                        <span className="date">{new Date(article.pubDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>

            <section className="article-detail">
              {selectedArticle ? (
                <ReadingViewContent
                  article={selectedArticle}
                  onToggleFavorite={toggleFavorite}
                  onToggleRead={toggleRead}
                />
              ) : (
                <div className="empty-state">
                  <h3>选择一篇收藏的文章</h3>
                  <p>从左侧列表中选择一篇文章来阅读</p>
                </div>
              )}
            </section>
          </>
        )}

        {currentPage === 'history' && (
          <>
            <aside className="feeds-sidebar">
              <div className="aside_title">
                <h3>📚 阅读足迹 ({sortedReadArticles.length})</h3>
              </div>
              <div className="global-list">
                {sortedReadArticles.length === 0 ? (
                  <div className="empty-state">
                    <p>暂无阅读记录</p>
                    <small>开始阅读文章来建立你的阅读足迹吧！</small>
                  </div>
                ) : (
                  sortedReadArticles.map(article => (
                    <div
                      key={article.id}
                      className={`global-item ${selectedArticle?.id === article.id ? 'selected' : ''}`}
                      onClick={() => openReadingView(article)}
                    >
                      <div className="global-item-feed">{article.feedTitle}</div>
                      <h4>{article.title}</h4>
                      <div className="meta">
                        {article.author && <span className="author">{article.author}</span>}
                        <span className="date" title={"发布于 " + new Date(article.pubDate).toLocaleDateString('zh-CN')}>
                          📖 {readTimestamps[article.id] ? new Date(readTimestamps[article.id]).toLocaleDateString('zh-CN') : new Date(article.pubDate).toLocaleDateString('zh-CN')}
                        </span>
                        {article.isFavorite && <span className="fav-mark">♥</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>

            <section className="article-detail">
              {selectedArticle ? (
                <ReadingViewContent
                  article={selectedArticle}
                  onToggleFavorite={toggleFavorite}
                  onToggleRead={toggleRead}
                />
              ) : (
                <div className="empty-state">
                  <h3>选择一篇历史文章</h3>
                  <p>从左侧列表中选择一篇文章来查看阅读详情</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {isShow && (
        <AddItem
          hidden={hidden}
          addOneRecord={addOneRecord}
          item={item}
          cur={cur}
        />
      )}
    </div>
  )
}

export default App
