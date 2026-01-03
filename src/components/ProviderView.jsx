import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getCustomerAddressApi } from '../api/api';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Customer marker icon
const customerIcon = L.divIcon({
  className: 'custom-customer-marker',
  html: `
    <div style="position: relative; width: 30px; height: 40px;">
      <div style="width: 30px; height: 38px; background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 3px 10px rgba(124, 58, 237, 0.5); display: flex; align-items: center; justify-content: center; border: 2px solid white; position: absolute; top: 0; left: 0;">
        <svg style="width: 12px; height: 12px; transform: rotate(45deg);" fill="white" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

export const ProviderView = ({ tripId, provider }) => {
  const socket = useSocket();
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState();
  const [locationAddress, setLocationAddress] = useState('Getting location...');
  const [route, setRoute] = useState([]);
  const [roadRoute, setRoadRoute] = useState([]);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    // Set provier location

    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          getAddress(latitude, longitude);
        },
        (error) => {
          console.error('Location error:', error);
          setLocationAddress('Location access denied');
        },
        { enableHighAccuracy: true, maximumAge: 500, timeout: 2000 }
      );
    }
  }, []);


  useEffect(() => {
    
    getCustomerlocation()
  }, [])
  
  const getCustomerlocation = async () => {
    try {
      const result = await getCustomerAddressApi('69574a2f1d963b8919a610af')
      console.log(result, "result");

      setCustomerLocation({ lat:result?.UserLocation?.location[0], lng:result?.UserLocation?.location[1] });

    } catch (error) {
      console.log(error);

    }
  }

  const getAddress = async (lat, lng) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data.display_name) {
        setLocationAddress(data.display_name);
      }
    } catch (error) {
      setLocationAddress('Address not available');
    }
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getRoadRoute = async (startLat, startLng, endLat, endLng) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setRoadRoute(coordinates);
        setDistance(data.routes[0].distance / 1000); // Convert to km
      }
    } catch (error) {
      console.error('Road route error:', error);
      // Fallback to straight line distance
      if (currentLocation && customerLocation) {
        const dist = calculateDistance(startLat, startLng, endLat, endLng);
        setDistance(dist);
      }
    }
  };

  const startTracking = () => {

    getCustomerlocation()

    if (!socket) {
      console.error('❌ PROVIDER: Socket not connected');
      alert('Socket not connected');
      return;
    }

    if (!navigator.geolocation) {
      console.error('❌ PROVIDER: Geolocation not supported');
      alert('Geolocation not supported');
      return;
    }

    console.log('🚗 PROVIDER: Starting tracking for trip:', tripId);
    socket.emit('provider:start', { tripId, provider, lat: currentLocation.lat, lng: currentLocation.lng });
    console.log(currentLocation, "this is cuso");

    // Get initial road route
    if (currentLocation && customerLocation) {
      getRoadRoute(currentLocation.lat, currentLocation.lng, customerLocation.lat, customerLocation.lng);
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('📍 PROVIDER: Sending location - Lat:', latitude, 'Lng:', longitude);
        setCurrentLocation({ lat: latitude, lng: longitude });
        getRoadRoute(latitude, longitude, customerLocation.lat, customerLocation.lng);
        getAddress(latitude, longitude);
        socket.emit('provider:location', { tripId, lat: latitude, lng: longitude });
        console.log('📡 PROVIDER: Location sent to customer');
        console.log('📍 PROVIDER Current Location:', { lat: latitude, lng: longitude });
      },
      (error) => {
        console.error('❌ PROVIDER: Geolocation error:', error.message);
        alert('Location error: ' + error.message);
      },
      { enableHighAccuracy: true, maximumAge: 500, timeout: 2000 }
    );

    setWatchId(id);
    setIsTracking(true);
    console.log('✅ PROVIDER: Tracking started with watchId:', id);
  };

  const stopTracking = () => {
    if (watchId) {
      if (demoMode) {
        clearInterval(watchId);
      } else {
        navigator.geolocation.clearWatch(watchId);
      }
    }
    socket.emit('trip:end', tripId);
    setIsTracking(false);
    setDemoMode(false);
    console.log('🛑 PROVIDER: Tracking stopped');
  };

  // useEffect(() => {
  //   if (!socket) return;

  //   socket.on('customer:location', (data) => {
  //     console.log('📍 PROVIDER: Customer location received - Lat:', data.lat, 'Lng:', data.lng);
  //     setCustomerLocation({ lat: data.lat, lng: data.lng });
  //   });

  //   return () => {
  //     socket.off('customer:location');
  //   };
  // }, [socket]);

  useEffect(() => {
    if (isTracking && !demoMode) {
      const interval = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              setCurrentLocation({ lat: latitude, lng: longitude });
              setRoute(prev => [...prev, [latitude, longitude]]);
              getRoadRoute(latitude, longitude, customerLocation.lat, customerLocation.lng);
              getAddress(latitude, longitude);
              console.log('📍 PROVIDER Current Location:', { lat: latitude, lng: longitude });
              if (socket) {
                socket.emit('provider:location', { tripId, lat: latitude, lng: longitude });
                console.log('📡 PROVIDER: Real-time location sent to customer');
              }
            },
            (error) => {
              console.warn('Location update error:', error.message);
              // Continue with last known location on timeout
            },
            { enableHighAccuracy: false, maximumAge: 10000, timeout: 10000 }
          );
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    return () => {
      if (watchId) {
        if (demoMode) {
          clearInterval(watchId);
        } else {
          navigator.geolocation.clearWatch(watchId);
        }
      }
    };
  }, [watchId, demoMode, isTracking, socket, tripId]);

  return (
    <div style={{ height: '100vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
          <button style={{ marginRight: '12px' }} onClick={() => window.history.back()}>
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: '600', flex: 1, textAlign: 'center', marginRight: '36px' }}>Provider Dashboard</h1>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, position: 'relative' }}>
        {currentLocation ? (
          <div style={{ height: '100%', width: '100%' }}>
            <MapContainer
              center={[currentLocation.lat, currentLocation.lng]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              key={`${currentLocation.lat}-${currentLocation.lng}`}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />



              {/* Road route to customer */}
              {roadRoute.length > 0 && (
                <Polyline
                  positions={roadRoute}
                  color="#2563eb"
                  weight={4}
                  opacity={0.8}
                />
              )}

              <Marker position={[currentLocation.lat, currentLocation.lng]}>
                <Popup>
                  <div style={{ textAlign: 'center' }}>
                    <strong>📍 Provider Location</strong><br />
                    Lat: {currentLocation.lat}<br />
                    Lng: {currentLocation.lng}<br />
                    <small>{locationAddress}</small>
                    {isTracking && <><br /><span style={{ color: '#22c55e', fontSize: '12px' }}>• Live Tracking</span></>}
                  </div>
                </Popup>
              </Marker>
              {customerLocation && (
                <Marker position={[customerLocation.lat, customerLocation.lng]} icon={customerIcon}>
                  <Popup>
                    <div style={{ textAlign: 'center' }}>
                      <strong>👤 Customer Location</strong><br />
                      Lat: {customerLocation.lat}<br />
                      Lng: {customerLocation.lng}<br />
                      <span style={{ color: '#7c3aed', fontSize: '12px' }}>• Destination</span>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
              <p style={{ color: '#6b7280' }}>Getting your location...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Card */}
      <div style={{ flexShrink: 0 }}>
        {/* Green Provider Card */}
        <div style={{ backgroundColor: '#22c55e', color: 'white', padding: '16px 20px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
              </svg>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>{provider.name}</h2>
                <p style={{ fontSize: '12px', opacity: 0.9 }}>Service Provider</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span style={{ opacity: 0.9 }}>Trip ID: {tripId}</span>
          </div>
          {distance > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginTop: '8px' }}>
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span style={{ opacity: 0.9 }}>Distance to customer: {distance.toFixed(1)} km</span>
            </div>
          )}
        </div>

        {/* Notes Card */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            <div style={{ marginBottom: '8px', fontWeight: '600', color: '#374151' }}>📋 Map Legend:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '3px', backgroundColor: '#2563eb' }}></div>
                <span>Blue: Road route to customer</span>
              </div>
            </div>
          </div>
        </div>

        {/* White Controls Card */}
        <div style={{ backgroundColor: 'white', padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!isTracking ? (
              <>

                <button
                  onClick={startTracking}
                  style={{ width: '100%', backgroundColor: '#16a34a', color: 'white', fontWeight: '600', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
                >
                  📍 Start Real GPS Tracking
                </button>
              </>
            ) : (
              <button
                onClick={stopTracking}
                style={{ width: '100%', backgroundColor: '#dc2626', color: 'white', fontWeight: '600', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
              >
                🛑 Stop Tracking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};