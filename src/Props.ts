export interface oneItemProp {
  id: string
  title: string
  rss: string
  lastUpdated?: number
  isUpdating?: boolean
}

export type ListProp = oneItemProp[]

export interface feedItemProp {
  id: string
  author: string
  content: string
  description: string
  link: string
  pubDate: string
  title: string
  isRead?: boolean
  isFavorite?: boolean
  dateAdded?: number
}

export interface feedProp {
  link: string
  title: string
  description: string
}

export interface ContentProp {
  status: string
  feed: feedProp
  items: feedItemProp[]
  lastUpdated?: number
}

