import { createServer } from 'node:http';
import events from 'node:events';
import { Socket } from 'node:net';

import { MongoClient, ObjectId } from 'mongodb';
import { createYoga, createSchema, createPubSub } from 'graphql-yoga';
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
import { gql } from 'graphql-request';
import { da } from '@faker-js/faker';



// Main app builder
const  buildApp = async () => {
  // Config
  events.EventEmitter.defaultMaxListeners = 50;
  const mongoUri = 'mongodb+srv://Cluster52182:SFBnc1NdQ3Jo@cluster52182.ummqye6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster52182';
 
  const dbName = 'egr_mobile';
  const collectionName = 'version';

  // Initialize pubsub (once)
  const pubSub = createPubSub();

  const client = new MongoClient(mongoUri);
  await client.connect();
  console.log('[MongoDB] Connected');

  const db = client.db(dbName);
  const versionCollection = db.collection(collectionName);

 // --- MongoDB Equivalent to Firebase onValue ---
const changeStream = versionCollection.watch([], { fullDocument: 'updateLookup' });
console.log('[onValue-MongoDB] Listening for all changes...');

changeStream.on('change', (change) => {
  console.log('[onValue-MongoDB] Change detected:', change);

  if (
    change.operationType === 'insert' ||
    change.operationType === 'update' ||
    change.operationType === 'replace'
  ) {
    const doc = change.fullDocument;
    if (doc) {
      const payload = {
        id: doc._id.toString(),
        android: doc.android,
        ios: doc.ios,
        datetime: doc.datetime,
      };
      console.log('[onValue-MongoDB] Publishing:', payload);
      pubSub.publish('newData', payload);
    } else {
      console.warn('[onValue-MongoDB] fullDocument missing:', change);
    }
  } else {
    console.log(`[onValue-MongoDB] Ignored operationType: ${change.operationType}`);
  }
});


  const schema = createSchema({
    typeDefs: gql`
     scalar JSON

      type Query {
        getEvents: [EgrMobile!]!
      }

      type Mutation {
        addEvent(android: String!, ios: String!, datetime: String!): EgrMobile!
         updateEvent(id: ID!, android: String, ios: String, datetime: String): EgrMobile!
      }

      type EgrMobile {
        android: String!
        ios: String!
        datetime: String!
      }

      type Subscription {
        newData: EgrMobile!
      }
    `,
    resolvers: {
      Query: {
        getEvents: async () => {
        const results = await db.collection('version').find({}).toArray();
            return results;
        }
        },
      Mutation: {
        addEvent: async (_: any, { android, ios, datetime }) => {
          console.log('[Mutation:addEvent] Inserting new event...');
          const res = await versionCollection.insertOne({ android, ios, datetime });
          console.log('[Mutation:addEvent] Inserted:', res.insertedId.toString());
         
          const data ={
            id: res.insertedId.toString(),
            android,
            ios,
            datetime,
          }
          console.log("Publishing new Data on Mutation",data);
         //pubSub.publish('newData',data);
         
          return data;
        },
        
      },
      Subscription: {
        newData: {
           subscribe: async function* () {
              console.log('[Subscription:newData] Subscribed!');

              // 1. Send the latest value first (mimicking Firebase onValue)
              const latestDoc = await versionCollection
                .find({})
                .sort({ datetime: -1 }) // Sort by datetime (or _id)
                .limit(1)
                .toArray();

              if (latestDoc.length > 0) {
                const doc = latestDoc[0];
                const payload = {
                  id: doc._id.toString(),
                  android: doc.android,
                  ios: doc.ios,
                  datetime: doc.datetime,
                };

                // ✅ Yield initial value (like onValue snapshot)
                yield payload;
              }

              // 2. Then keep streaming future changes from pubsub
              const asyncIterator = await pubSub.subscribe('newData');
              for await (const event of asyncIterator) {
                yield event;
              }
            },
          
          resolve: (payload) => {
            console.log('[Subscription:newData] Resolving payload:', payload);
            return payload;
          },
        },
      },
    },
  });

  const yoga = createYoga({
    schema,
    plugins: [useGraphQLSSE()],
 
  });

  const server = createServer(yoga);
  const sockets = new Set<Socket>();

  server.on('connection', (socket) => {
    sockets.add(socket);
    server.once('close', () => sockets.delete(socket));
  });

  return {
    start: (port: number) =>
      new Promise<void>((resolve, reject) => {
        server.on('error', reject);
        server.on('listening', resolve);
        server.listen(port);
      }),
  };
}

// Start the server
(async () => {
  const app = await buildApp();
  const port =8000;
  await app.start(port);
  console.log(`🚀 GraphQL Yoga Server running at http://localhost:${port}/graphql`);
})();
