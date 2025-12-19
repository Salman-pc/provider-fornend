import { ProviderView } from './components/ProviderView';

function App() {
  const tripId = 'TRIP-001';
  const provider = { name: 'Express Delivery' };

  return <ProviderView tripId={tripId} provider={provider} />;
}

export default App;