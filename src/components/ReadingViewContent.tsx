import { FC } from 'react'
import { feedItemProp } from './../Props'
import { RSSService } from './../services/RSSService'

interface ReadingViewContentProps {
  article: feedItemProp
  onToggleFavorite: (itemId: string) => void
  onToggleRead: (itemId: string) => void
}

const ReadingViewContent: FC<ReadingViewContentProps> = ({
  article,
  onToggleFavorite,
  onToggleRead
}) => {
  const handleExportPDF = () => {
    RSSService.exportToPDF(article)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="reading-content">
      <div className="reading-header">
        <div className="reading-controls">
          <button
            className={`favorite-btn ${article.isFavorite ? 'active' : ''}`}
            onClick={() => onToggleFavorite(article.id)}
            title={article.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            ♥
          </button>
          <button
            className="export-btn"
            onClick={handleExportPDF}
            title="Export to PDF"
          >
            📄
          </button>
          <button
            className={`read-btn ${article.isRead ? 'read' : 'unread'}`}
            onClick={() => onToggleRead(article.id)}
            title={article.isRead ? 'Mark as unread' : 'Mark as read'}
          >
            {article.isRead ? '✅' : '⭕'}
          </button>
        </div>
      </div>

      <div className="reading-body">
        <article className="article-content">
          <header className="article-header">
            <h1 className="article-title">{article.title}</h1>
            <div className="article-meta">
              {article.author && (
                <span className="article-author">By {article.author}</span>
              )}
              <span className="article-date">
                {formatDate(article.pubDate)}
              </span>
              {article.link && (
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="article-source"
                >
                  View Original
                </a>
              )}
            </div>
          </header>

          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: article.content || article.description }}
          />
        </article>
      </div>
    </div>
  )
}

export default ReadingViewContent