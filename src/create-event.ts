import { faker } from '@faker-js/faker';
import { GraphQLClient, gql } from 'graphql-request';

const endpoint = 'http://localhost:8000/graphql';
const client = new GraphQLClient(endpoint);

const ADD_EVENT_MUTATION = gql`
  mutation AddEvent($android: String!, $ios: String!,$datetime: String!) {
    addEvent(android: $android,ios: $ios,datetime: $datetime) {
      android,
      ios,
      datetime
    }
  }
`;

async function addSampleEvent() {
  try {
    const variables = { android: faker.number.bigInt,ios: faker.number.bigInt,datetime: faker.date.anytime, };
    const response: any = await client.request(ADD_EVENT_MUTATION, variables);
    console.log('Event added successfully:', response.addEvent);
  } catch (error) {
    console.error('Error adding event:', error);
  }
}

addSampleEvent();