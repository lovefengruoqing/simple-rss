import { FC } from 'react'
import { feedItemProp } from './../Props'

interface FavoritesListProps {
  articles: feedItemProp[]
  onArticleClick: (article: feedItemProp) => void
}

const FavoritesList: FC<FavoritesListProps> = ({ articles, onArticleClick }) => {
  if (articles.length === 0) {
    return (
      <div className="favorites-empty">
        <p>暂无收藏的文章</p>
        <small>点击文章旁边的心形图标来收藏文章</small>
      </div>
    )
  }

  return (
    <ul className="favorites-list">
      {articles.map((article) => (
        <li
          key={article.id}
          className={`favorite-item ${article.isRead ? 'read' : 'unread'}`}
          onClick={() => onArticleClick(article)}
        >
          <div className="favorite-title">{article.title}</div>
          <div className="favorite-meta">
            {article.author && <span className="author">{article.author}</span>}
            <span className="date">{new Date(article.pubDate).toLocaleDateString()}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default FavoritesList