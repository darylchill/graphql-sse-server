const url = new URL('http://localhost:8000/graphql/stream');
url.searchParams.append('query', 'subscription { newData }');
const source = new EventSource(url);

source.addEventListener('next', ({ data }) =>
  console.log('\n(Client-side) New Event', JSON.parse(data)?.data?.newData)
);

source.addEventListener('error', (e) => console.error(e));

source.addEventListener('complete', () => source.close());
