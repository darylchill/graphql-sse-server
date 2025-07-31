import { createServer } from 'node:http';
import events from 'node:events';
import { Socket } from 'node:net';

import { MongoClient, ObjectId } from 'mongodb';
import { createYoga, createSchema, createPubSub } from 'graphql-yoga';
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
import { gql } from 'graphql-request';
import { da } from '@faker-js/faker';

// Main app builder function
const buildApp = async () => {
  // Increase the default max listeners to avoid memory leak warnings
  events.EventEmitter.defaultMaxListeners = 50;

  // MongoDB connection configuration
  const mongoUri = 'ENTER YOUR MONGODB URL';
  const dbName = 'ENTER YOUR DB NAME';
  const collectionName = 'ENTER YOUR COLLECTION NAME';

  // Initialize GraphQL pubsub for subscriptions
  const pubSub = createPubSub();

  // Connect to MongoDB
  const client = new MongoClient(mongoUri);
  await client.connect();
  console.log('[MongoDB] Connected');

  // Get the database and collection references
  const db = client.db(dbName);
  const versionCollection = db.collection(collectionName);

  // --- MongoDB Equivalent to Firebase onValue ---
  // Listen for all changes (insert, update, replace) in the collection
  const changeStream = versionCollection.watch([], { fullDocument: 'updateLookup' });
  console.log('[onValue-MongoDB] Listening for all changes...');

  // When a change is detected, publish it to all subscribers
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
      // Ignore other operation types (like delete)
      console.log(`[onValue-MongoDB] Ignored operationType: ${change.operationType}`);
    }
  });

  // Define GraphQL schema and resolvers
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
        // Fetch all events from the collection
        getEvents: async () => {
          const results = await db.collection('version').find({}).toArray();
          return results;
        }
      },
      Mutation: {
        // Add a new event to the collection
        addEvent: async (_: any, { android, ios, datetime }) => {
          console.log('[Mutation:addEvent] Inserting new event...');
          const res = await versionCollection.insertOne({ android, ios, datetime });
          console.log('[Mutation:addEvent] Inserted:', res.insertedId.toString());

          const data = {
            id: res.insertedId.toString(),
            android,
            ios,
            datetime,
          };
          console.log("Publishing new Data on Mutation", data);
          // pubSub.publish('newData', data); // Publishing is handled by changeStream

          return data;
        },
        // You can implement updateEvent similarly if needed
      },
      Subscription: {
        newData: {
          // Subscription resolver for newData
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

              // Yield initial value (like onValue snapshot)
              yield payload;
            }

            // 2. Then keep streaming future changes from pubsub
            const asyncIterator = await pubSub.subscribe('newData');
            for await (const event of asyncIterator) {
              yield event;
            }
          },

          // Resolve function for the subscription payload
          resolve: (payload) => {
            console.log('[Subscription:newData] Resolving payload:', payload);
            return payload;
          },
        },
      },
    },
  });

  // Create the GraphQL Yoga server with SSE plugin
  const yoga = createYoga({
    schema,
    plugins: [useGraphQLSSE()],
  });

  // Create HTTP server and manage sockets for graceful shutdown
  const server = createServer(yoga);
  const sockets = new Set<Socket>();

  server.on('connection', (socket) => {
    sockets.add(socket);
    server.once('close', () => sockets.delete(socket));
  });

  // Return a start method to launch the server
  return {
    start: (port: number) =>
      new Promise<void>((resolve, reject) => {
        server.on('error', reject);
        server.on('listening', resolve);
        server.listen(port);
      }),
  };
}

// Start the server immediately
(async () => {
  const app = await buildApp();
  const port = 8000;
  await app.start(port);
  console.log(`🚀 GraphQL Yoga Server running at http://localhost:${port}/graphql`);
})();
