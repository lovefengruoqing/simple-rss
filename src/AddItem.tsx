import React, {FC, useEffect, useState} from 'react';
import ReactDOM from 'react-dom';

import './AddItem.css';

import {oneItemProp, ListProp} from './Props';

const AddItem: FC<{
  hidden: () => void;
  addOneRecord: ({title, rss}: oneItemProp, cur: number) => void;
  item: oneItemProp;
  cur: number;
}> = ({hidden, addOneRecord, item, cur}) => {
  const [title, setTitle] = useState((item && item.title) || '');
  const [rss, setRss] = useState((item && item.rss) || '');
  return (
    <div className="addItem">
      <div>
        <h2>新增一个 RSS 订阅</h2>
        <div>
          <label htmlFor="title">标题：</label>
          <input
            type="text"
            id="title"
            placeholder="请输入标题"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          ></input>
        </div>
        <div>
          <label htmlFor="title">RSS 地址：</label>
          <input
            type="url"
            id="rss"
            placeholder="请输入要订阅的 rss 地址"
            value={rss}
            onChange={(e) => {
              setRss(e.target.value);
            }}
          ></input>
        </div>
        <div>
          <button
            onClick={() => {
              if (title === '') return;
              if (rss === '') return;

              addOneRecord({title, rss}, cur);
              hidden();
            }}
          >
            确定
          </button>
          <button
            onClick={() => {
              hidden();
            }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddItem;
