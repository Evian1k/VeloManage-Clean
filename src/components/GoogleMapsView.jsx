import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin, Users, Truck, Home, Building, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/api';

const GoogleMapsView = ({ isAdmin = false, onLocationAdd }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const { toast } = useToast();

  const locationTypeIcons = {
    home: Home,
    work: Building,
    service_location: Truck,
    pickup: MapPin,
    delivery: MapPin,
    emergency: AlertTriangle,
    other: MapPin
  };

  const locationTypeColors = {
    home: '#22c55e',
    work: '#3b82f6',
    service_location: '#f59e0b',
    pickup: '#ef4444',
    delivery: '#8b5cf6',
    emergency: '#dc2626',
    other: '#6b7280'
  };

  useEffect(() => {
    initializeMap();
    loadLocations();
    getCurrentLocation();
  }, []);

  const initializeMap = async () => {
    try {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY',
        version: 'weekly',
        libraries: ['places', 'geometry']
      });

      await loader.load();
      setIsLoaded(true);

      // Default center (can be customized)
      const defaultCenter = { lat: -1.286389, lng: 36.817223 }; // Nairobi, Kenya

      const map = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        styles: [
          {
            "featureType": "all",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#1a1a1a" }]
          },
          {
            "featureType": "all",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
          },
          {
            "featureType": "water",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#0f172a" }]
          },
          {
            "featureType": "road",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#374151" }]
          }
        ]
      });

      mapInstanceRef.current = map;

      // Add click listener for adding new locations
      if (!isAdmin) {
        map.addListener('click', (event) => {
          handleMapClick(event);
        });
      }

    } catch (error) {
      console.error('Error loading Google Maps:', error);
      toast({
        title: "Maps Error",
        description: "Failed to load Google Maps. Please check your internet connection.",
        variant: "destructive"
      });
    }
  };

  const loadLocations = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.get('/locations/maps-format');
      
      if (response.success) {
        setLocations(response.data);
        if (mapInstanceRef.current) {
          displayLocationsOnMap(response.data);
        }
      }
    } catch (error) {
      console.error('Error loading locations:', error);
      toast({
        title: "Error",
        description: "Failed to load locations.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(userPos);
          
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter(userPos);
            mapInstanceRef.current.setZoom(15);
            
            // Add user location marker
            new google.maps.Marker({
              position: userPos,
              map: mapInstanceRef.current,
              title: 'Your Location',
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
              }
            });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  const displayLocationsOnMap = (locationData) => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    locationData.forEach((location) => {
      const marker = new google.maps.Marker({
        position: location.position,
        map: mapInstanceRef.current,
        title: location.title,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
                    fill="${locationTypeColors[location.type] || '#6b7280'}" 
                    stroke="#ffffff" 
                    stroke-width="1"/>
              <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32)
        }
      });

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-2 min-w-48">
            <h3 class="font-semibold text-gray-900">${location.title}</h3>
            <p class="text-sm text-gray-600 mb-2">${location.description || 'No description'}</p>
            <div class="text-xs text-gray-500">
              <p><strong>User:</strong> ${location.user.name}</p>
              <p><strong>Type:</strong> ${location.type}</p>
              <p><strong>Address:</strong> ${location.address || 'N/A'}</p>
              <p><strong>Added:</strong> ${new Date(location.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
        setSelectedLocation(location);
      });

      markersRef.current.push(marker);
    });
  };

  const handleMapClick = async (event) => {
    if (isAdmin) return; // Admins can't add locations by clicking

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    try {
      // Reverse geocoding to get address
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      
      let address = {};
      if (response.results.length > 0) {
        address.formatted = response.results[0].formatted_address;
      }

      const locationData = {
        latitude: lat,
        longitude: lng,
        name: `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        type: 'other',
        address
      };

      onLocationAdd && onLocationAdd(locationData);
    } catch (error) {
      console.error('Error with reverse geocoding:', error);
      
      // Fallback without address
      const locationData = {
        latitude: lat,
        longitude: lng,
        name: `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        type: 'other'
      };

      onLocationAdd && onLocationAdd(locationData);
    }
  };

  const handleRefreshLocations = () => {
    loadLocations();
    toast({
      title: "Refreshed",
      description: "Locations have been updated.",
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-400">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Header */}
      <Card className="glass-effect border-blue-900/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location Map
              {isAdmin && <Badge variant="secondary" className="ml-2">Admin View</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-gray-300">
                {locations.length} {locations.length === 1 ? 'location' : 'locations'}
              </Badge>
              <Button
                onClick={handleRefreshLocations}
                size="sm"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          {!isAdmin && (
            <p className="text-gray-400 text-sm">
              Click anywhere on the map to add a new location
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* Map Container */}
          <div className="relative">
            <div 
              ref={mapRef} 
              className="w-full h-96 rounded-lg border border-gray-600"
            />
            
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-white text-sm">Loading locations...</p>
                </div>
              </div>
            )}
          </div>

          {/* Location Types Legend */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(locationTypeColors).map(([type, color]) => {
              const Icon = locationTypeIcons[type];
              const count = locations.filter(loc => loc.type === type).length;
              
              return (
                <div key={type} className="flex items-center gap-2 p-2 bg-gray-800/50 rounded">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-300 capitalize">
                    {type.replace('_', ' ')} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Location Details */}
      {selectedLocation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="glass-effect border-green-900/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">{selectedLocation.title}</h3>
                  <p className="text-gray-400 text-sm mb-2">{selectedLocation.description}</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-300">
                      <span className="text-gray-500">User:</span> {selectedLocation.user.name}
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Type:</span> 
                      <Badge 
                        variant="outline" 
                        className="ml-2 text-xs"
                        style={{ borderColor: locationTypeColors[selectedLocation.type] }}
                      >
                        {selectedLocation.type.replace('_', ' ')}
                      </Badge>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Coordinates:</span> 
                      {selectedLocation.position.lat.toFixed(6)}, {selectedLocation.position.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-300 text-sm">
                    <span className="text-gray-500">Address:</span><br />
                    {selectedLocation.address || 'No address available'}
                  </p>
                  <p className="text-gray-300 text-sm mt-2">
                    <span className="text-gray-500">Added:</span> {new Date(selectedLocation.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default GoogleMapsView;