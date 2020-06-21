import React, {useState, useEffect} from 'react';
import ReactDOM from 'react-dom';

import TreeItems from './TreeItems';
import AddItem from './AddItem';
import {oneItemProp, ListProp, ContentProp} from './Props';
import MainContent from './MainContent';
import './App.css';

export default () => {
  const [isShow, setShow] = useState(false);
  const [lists, setLists] = useState<ListProp>([]);
  const [content, setContent] = useState<ContentProp>();
  const [item, setItem] = useState<oneItemProp>();
  const [cur, setCur] = useState<number>(-1);

  const addOneRecord = (one: oneItemProp, cur: number) => {
    chrome.storage.sync.get('lists', (datas) => {
      if (cur === -1) {
        datas.lists.push(one);
      } else {
        datas.lists.splice(cur, 1, one);
      }
      chrome.storage.sync.set(datas, () => {
        console.log('保存成功', datas);
      });
      setLists(datas.lists);

      setItem({title: '', rss: ''});
    });
  };

  // 隐藏增加条目的弹窗
  const hidden = () => {
    setShow(false);
    setItem({title: '', rss: ''});
  };

  const crawlerContent = async (url: string) => {
    const res = await fetch(
        'https://api.rss2json.com/v1/api.json?rss_url=' + url,
    );
    const json = await res.json();
    setContent(json);
  };

  const deleteOneItem = (index: number) => {
    chrome.storage.sync.get('lists', ({lists}: { lists: ListProp }) => {
      lists.splice(index, 1);
      chrome.storage.sync.set({lists}, () => {
        console.log('保存成功', lists);
      });
      setLists(lists);
    });
  };

  const modifyOneItem = (one: oneItemProp, index: number) => {
    setItem(one);
    setShow(true);
    setCur(index);
  };

  useEffect(() => {
    chrome.storage.sync.get('lists', (datas) => {
      if (datas.lists === undefined) {
        chrome.storage.sync.set({lists: lists});
      } else {
        setLists(datas.lists);
      }
    });
  }, []);

  return (
    <React.Fragment>
      <header>
        <span className="logo" />
        <span className="title">Simple Rss</span>
      </header>
      <aside>
        <div className="aside_title">
          <h3>已订阅 RSS 列表</h3>
          <span
            className="add"
            onClick={() => {
              setShow(!isShow);
            }}
            title="add new rss"
          ></span>
        </div>
        <TreeItems
          lists={lists}
          crawlerContent={crawlerContent}
          deleteOneItem={deleteOneItem}
          modifyOneItem={modifyOneItem}
        />
      </aside>
      <main>
        {content &&
          (content.status === 'ok' ? <MainContent content={content} /> : '')}
      </main>
      {isShow ? (
        <AddItem
          hidden={hidden}
          addOneRecord={addOneRecord}
          item={item}
          cur={cur}
        />
      ) : (
        ''
      )}
    </React.Fragment>
  );
};
