import {FC, useState} from 'react';

import {ContentProp} from './Props';
import './styles/MainContent.css';

const OneContent: FC<{
  article: any;
  onClick?: () => void;
  isSelected?: boolean;
}> = ({ article, onClick, isSelected }) => {
  const { title, pubDate, author, isRead, isFavorite } = article

  return (
    <div className={`article-item ${isRead ? 'read' : 'unread'} ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="article-title-row">
        <h3 className="article-title">{title}</h3>
        {isFavorite && <span className="favorite-indicator">♥</span>}
      </div>
      <div className="article-meta">
        {author && <span className="author">{author}</span>}
        <span className="date">{new Date(pubDate).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

const MainContent: FC<{
  content: ContentProp;
  onArticleClick?: (article: any) => void;
  selectedFeedIndex?: number;
  showAllArticles?: boolean;
  onToggleShowAll?: (showAll: boolean) => void;
}> = ({content, onArticleClick, showAllArticles = true, onToggleShowAll}) => {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)

  const handleArticleClick = (article: any) => {
    setSelectedArticleId(article.id)
    onArticleClick?.(article)
  }

  const {feed, items} = content;

  // Filter articles based on read status
  const filteredItems = showAllArticles ? items : items.filter(item => !item.isRead)

  // Sort articles by date (newest first) - always by time regardless of read status
  const sortedItems = [...filteredItems].sort((a, b) => {
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  })

  if (content.status === 'loading') {
    return (
      <div className="mainContent">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading RSS feed...</p>
        </div>
      </div>
    )
  }

  if (content.status === 'error') {
    return (
      <div className="mainContent">
        <div className="error-state">
          <h3>Failed to load feed</h3>
          <p>{feed.description}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mainContent">
      <div className="mainContent_title">
        <div className="title-row">
          <h3>
            <a href={feed.link}>{feed.title}</a>
          </h3>
          <div className="filter-controls">
            <button
              className={`filter-btn ${showAllArticles ? 'all' : 'unread'}`}
              onClick={() => onToggleShowAll?.(!showAllArticles)}
              title={showAllArticles ? 'Show unread only' : 'Show all articles'}
            >
              {showAllArticles ? '📖 未读' : '📚 全部'}
            </button>
          </div>
        </div>
        <article>{feed.description}</article>
      </div>
      <div className="mainContent_content">
        {sortedItems.length === 0 ? (
          <div className="empty-state">
            <p>{showAllArticles ? 'No articles found in this feed.' : 'No unread articles. Great job!'}</p>
          </div>
        ) : (
          sortedItems.map((article) => {
            return (
              <OneContent
                key={article.id}
                article={article}
                onClick={() => handleArticleClick(article)}
                isSelected={selectedArticleId === article.id}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default MainContent;
