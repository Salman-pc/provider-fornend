import { href, Route, Routes, useNavigate } from 'react-router-dom';
import { ProviderView } from './components/ProviderView';
import AuthForm from './components/auth';
import { useEffect } from 'react';

function App() {
  const tripId = 'TRIP-001';
  const provider = { name: 'Express Delivery' };
  const navigate = useNavigate()
  const accessToken = localStorage.getItem("accessToken");

  useEffect(() => {
    if (accessToken) {
      navigate("/");
    } 

  }, [accessToken]);

  return (
    <div>
      <Routes>
        {/* <Route path="/" element={<AuthForm mode="login" />} /> */}
        <Route path="/signup" element={<AuthForm mode="signup" />} />
        <Route
          path="/"
          element={accessToken ? <ProviderView tripId={tripId} provider={provider} /> : <AuthForm mode="login" />}
        />
         <Route path="*" element={<NOtfoundpage />} />

      </Routes>
    </div>

  )
}

export default App;


export const NOtfoundpage = () => {
  return (
    <div>
      <h2>404 - Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
    </div>
  );
}