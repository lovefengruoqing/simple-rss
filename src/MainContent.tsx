import React, {FC, useEffect} from 'react';
import ReactDOM from 'react-dom';

import {ContentProp, feedItemProp} from './Props';
import './MainContent.css';

const OneContent: FC<feedItemProp> = (
    {link, title, pubDate, author, content},
) => {
  return (
    <details>
      <summary>
        <a href={link}>{title}</a> {pubDate} {author}
      </summary>
      <article dangerouslySetInnerHTML={{__html: content}}></article>
    </details>
  );
};

const MainContent: FC<{ content: ContentProp }> = ({content}) => {
  const {feed, items} = content;
  return (
    <div className="mainContent">
      <div className="mainContent_title">
        <h3>
          <a href={feed.link}>{feed.title}</a>
        </h3>
        <article>{feed.description}</article>
      </div>
      <div className="mainContent_content">
        {items.map(({author, content, description, link, pubDate, title}) => {
          return <OneContent
            author={author}
            content={content}
            description={description}
            link={link}
            pubDate={pubDate}
            title={title}
          />;
        })}
      </div>
    </div>
  );
};

export default MainContent;
