import { useControl, ControlPosition } from 'react-map-gl/mapbox';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { useEffect } from 'react';

type GeocoderControlProps = {
  mapboxAccessToken: string;
  position: ControlPosition;
  marker?: boolean;
};

export default function GeocoderControl(props: GeocoderControlProps) {
  const geocoder = useControl<MapboxGeocoder>(
    () => new MapboxGeocoder({
      accessToken: props.mapboxAccessToken,
      mapboxgl: require('mapbox-gl'),
      marker: props.marker ?? false,
      flyTo: {
        duration: 2000,
        zoom: 17,
      }
    }),
    { position: props.position }
  );

  return null;
}
