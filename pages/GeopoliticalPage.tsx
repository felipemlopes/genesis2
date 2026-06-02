import React, { useEffect } from 'react';
import GeopoliticalRadar from '../components/GeopoliticalRadar';
import { useGeoEngine } from '../contexts/GeoEngineContext';

const GeopoliticalPage: React.FC = () => {
  const { setIsOnRadarPage, dismissAllToasts } = useGeoEngine();

  useEffect(() => {
    setIsOnRadarPage(true);
    dismissAllToasts();
    return () => { setIsOnRadarPage(false); };
  }, [setIsOnRadarPage, dismissAllToasts]);

  return <GeopoliticalRadar />;
};

export default GeopoliticalPage;
