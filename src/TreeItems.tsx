import { FC } from "react";

import "./styles/TreeItems.css";

import { oneItemProp, ListProp } from "./Props";

const TreeItems: FC<{
  lists: ListProp;
  crawlerContent: (url: string, index: number) => void;
  deleteOneItem: (index: number) => void;
  modifyOneItem: (oneItem: oneItemProp, index: number) => void;
  updateFeed: (index: number) => void;
  selectedIndex?: number;
}> = ({
  lists,
  crawlerContent,
  deleteOneItem,
  modifyOneItem,
  updateFeed,
  selectedIndex,
}) => {
  return (
    <ul className="tree-items">
      {lists.map((feed: oneItemProp, index) => {
        const { title, rss } = feed;
        return (
          <li
            key={index}
            className={`tree-item ${selectedIndex === index ? "selected" : ""}`}
            onClick={() => {
              crawlerContent(rss, index);
            }}
          >
            <div className="item-content">
              <span className="item-title">
                {title}
              </span>
              {feed.lastUpdated && (
                <span className="last-updated">
                  {new Date(feed.lastUpdated).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="item-actions">
              <button
                className={`update-btn ${feed.isUpdating ? "updating" : ""}`}
                onClick={(e) => {
                  e.stopPropagation()
                  updateFeed(index)
                }}
                disabled={feed.isUpdating}
                title="Update feed"
              >
                {feed.isUpdating ? "🔄" : "🔁"}
              </button>
              <button
                className="edit-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  modifyOneItem(feed, index)
                }}
                title="Edit RSS"
              >
                ✏️
              </button>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteOneItem(index)
                }}
                title="Delete RSS"
              >
                🗑️
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default TreeItems;
