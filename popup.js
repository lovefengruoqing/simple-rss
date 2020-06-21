const itemList = document.querySelector('.itemList');

chrome.storage.sync.get('lists', (datas) => {
  if (datas.lists instanceof Array) {
    datas.lists.forEach(({title, rss}) => {
      const oneItem = document.createElement('li');

      oneItem.innerText = title;
      oneItem.setAttribute('data-rss', rss);

      itemList?.appendChild(oneItem);
    });
  }
});

const b = document.querySelector('.open');
b.addEventListener(
    'click',
    () => {
      console.log('open the management page!');
    },
    false,
);
