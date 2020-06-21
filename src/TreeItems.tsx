import React, {FC, useEffect} from 'react';
import ReactDOM from 'react-dom';

import './TreeItems.css';

import {oneItemProp, ListProp} from './Props';

const TreeItems: FC<{
  lists: ListProp;
  crawlerContent: (url: string) => Promise<void>;
  deleteOneItem: (index: number) => void;
  modifyOneItem: (oneItem: oneItemProp, index: number) => void;
}> = ({lists, crawlerContent, deleteOneItem, modifyOneItem}) => {
  return (
    <ol className="treeItems">
      {lists.map(({title, rss}: oneItemProp, index) => {
        return (
          <li data-rss={rss}>
            <a
              href="#"
              onClick={() => {
                crawlerContent(rss);
              }}
            >
              {title}
            </a>
            <span
              className="modify"
              onClick={() => {
                modifyOneItem({title, rss}, index);
              }}
              title="modify this rss"
            ></span>
            <span
              className="delete"
              onClick={() => {
                deleteOneItem(index);
              }}
              title="delete this rss"
            ></span>
          </li>
        );
      })}
    </ol>
  );
};

export default TreeItems;
