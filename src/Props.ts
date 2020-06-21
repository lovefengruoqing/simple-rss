export type oneItemProp = { title: string, rss: string };
export type ListProp = Array<oneItemProp>;

export type feedItemProp = {
  author: string;
  content: string;
  description: string;
  link: string;
   pubDate: string;
    title: string;
};
export type feedProp = {
  link: string;
  title: string;
  description: string;
};
export type ContentProp = {
  status: string, feed: feedProp, items: Array<feedItemProp>
}
