# GraphQL SSE MongoDB Server

A TypeScript server designed to replicate Firebase Realtime Database functionality using MongoDB's change streams and GraphQL SSE subscriptions. Built with Bun and GraphQL Yoga.

## 📽 Demo

[https://github.com/your-username/graphqlsse-mongodb/assets/video-graphql-server-sample.mp4  ](https://github.com/darylchill/graphql-sse-server/blob/main/video-graphql-server-sample.mp4)


## Features

- Realtime updates using MongoDB change streams.
- GraphQL Subscriptions over Server-Sent Events (SSE).
- MongoDB Replica Set ready (for enabling change streams).
- Designed for Firebase-like realtime DB structure and behavior.
- Lightweight and performant with Bun runtime.

## Stack

- **Bun** - Modern JavaScript runtime
- **TypeScript** - Static type checking
- **GraphQL Yoga** - Fully-featured GraphQL server
- **MongoDB** - Change streams with replica set enabled

## Setup

### Prerequisites

- [Bun](https://bun.sh/) installed
- MongoDB replica set initialized 

### Installation

```bash
bun install
```

### Run the server

```bash
bun run server
```

## GraphQL Subscription Example

```graphql
subscription {
  wishlistUpdated {
    id
    eventDate
    name
  }
}
```

## Replication Scenario

This server replicates Firebase Realtime Database behavior using:

- **MongoDB Cluster with Replica Set**: Enables change streams for real-time updates.
- **Change Streams**: Watches collections for changes (insert, update, delete).
- **GraphQL Yoga**: Pushes these updates to subscribed clients via GraphQL SSE.


## License

MIT
