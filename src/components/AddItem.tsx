import {FC, useState} from 'react';

import './../styles/AddItem.css';

import {oneItemProp} from './../Props';

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
        <div className="form-group">
          <label htmlFor="title">标题：</label>
          <input
            type="text"
            id="title"
            placeholder="请输入标题"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="rss">RSS 地址：</label>
          <input
            type="url"
            id="rss"
            placeholder="请输入要订阅的 rss 地址"
            value={rss}
            onChange={(e) => {
              setRss(e.target.value);
            }}
          />
        </div>
        <div className="button-group">
          <button
            onClick={() => {
              if (title === '') return;
              if (rss === '') return;

              addOneRecord({id: '', title, rss}, cur);
              hidden();
            }}
            disabled={!title || !rss}
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
