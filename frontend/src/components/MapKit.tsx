import React, { useEffect, useRef } from 'react';
import { Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';

/**
 * Shared map pieces so the trip editor and the live map look the same.
 * Marker wrappers have zero size and the chip centers itself on the coordinate,
 * so labels of any length stay anchored correctly.
 */

const chipIcon = (variant: string, html: string) =>
  L.divIcon({
    className: 'cr-marker',
    html: `<div class="cr-chip cr-chip--${variant}">${html}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -16],
  });

export const startIcon = chipIcon('start', 'Start');
export const campusIcon = chipIcon('campus', 'Mapúa Intramuros');
export const driverIcon = chipIcon('driver', '<span class="cr-pulse"></span>Driver live');
export const riderIcon = chipIcon('rider', 'Rider live');

export const stopIcon = (num: number) =>
  L.divIcon({
    className: 'cr-marker',
    html: `<div class="cr-stop">${num}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -16],
  });

/**
 * Top-down Grab / inDrive-style CardiRide car SVG marker rotated to match road heading.
 */
export const createCarIcon = (headingDeg = 0) =>
  L.divIcon({
    className: 'cr-car-marker',
    html: `
      <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:2px;border-radius:9999px;background:rgba(185,28,28,0.18);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="transform:rotate(${Math.round(headingDeg)}deg);transition:transform 300ms ease-out;filter:drop-shadow(0 4px 6px rgba(15,23,42,0.45));">
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="3" width="18" height="30" rx="6.5" fill="#B91C1C" stroke="#FFFFFF" stroke-width="2"/>
            <path d="M12 11.5C12 9.8 13.5 8.5 18 8.5C22.5 8.5 24 9.8 24 11.5L23.2 15.2H12.8L12 11.5Z" fill="#0F172A"/>
            <rect x="13" y="16.5" width="10" height="7" rx="2" fill="#991B1B"/>
            <path d="M13 24.5H23L23.6 27.5C23.6 28.4 22.8 29 21.8 29H14.2C13.2 29 12.4 28.4 12.4 27.5L13 24.5Z" fill="#1E293B"/>
            <rect x="11.5" y="4.8" width="3.5" height="2" rx="1" fill="#FDE68A"/>
            <rect x="21" y="4.8" width="3.5" height="2" rx="1" fill="#FDE68A"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });

function computeBearingDeg(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLng = toRad(to[1] - from[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

interface SmoothCarMarkerProps {
  position: [number, number];
  heading?: number | null;
  driverName: string;
  updatedAt: string;
  durationMs?: number;
}

/**
 * Smoothly glides the driver's car marker between GPS updates using requestAnimationFrame
 * and rotates the car along the road heading (Grab / inDrive style).
 */
export const SmoothCarMarker: React.FC<SmoothCarMarkerProps> = ({
  position,
  heading,
  driverName,
  updatedAt,
  durationMs = 1100,
}) => {
  const markerRef = useRef<L.Marker | null>(null);
  const prevPosRef = useRef<[number, number]>(position);
  const headingRef = useRef<number>(heading ?? 0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = prevPosRef.current;
    const to = position;

    const movedEnough = Math.abs(to[0] - from[0]) > 1e-6 || Math.abs(to[1] - from[1]) > 1e-6;
    if (!movedEnough) return;

    const nextHeading =
      typeof heading === 'number' && !Number.isNaN(heading)
        ? heading
        : computeBearingDeg(from, to);
    headingRef.current = nextHeading;
    marker.setIcon(createCarIcon(nextHeading));

    if (animRef.current !== null) cancelAnimationFrame(animRef.current);

    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // Smooth ease-out curve for natural vehicle motion
      const ease = 1 - Math.pow(1 - t, 3);
      const lat = from[0] + (to[0] - from[0]) * ease;
      const lng = from[1] + (to[1] - from[1]) * ease;
      marker.setLatLng([lat, lng]);
      prevPosRef.current = [lat, lng];

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevPosRef.current = to;
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [position[0], position[1], heading, durationMs]);

  return (
    <Marker
      ref={markerRef}
      position={prevPosRef.current}
      icon={createCarIcon(headingRef.current)}
      zIndexOffset={500}
    >
      <Popup>
        <div className="text-xs">
          <strong>{driverName}</strong> (Driver Live)
          <br />
          Updated {new Date(updatedAt).toLocaleTimeString()}
        </div>
      </Popup>
    </Marker>
  );
};

export const BaseTiles: React.FC = () => (
  <TileLayer
    attribution="&copy; OpenStreetMap contributors"
    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    maxZoom={19}
  />
);

/** White casing under the red line keeps the route readable on busy streets. */
export const routeStyles = {
  casing: { color: '#ffffff', weight: 9, opacity: 0.95 },
  line: { color: '#B91C1C', weight: 5, opacity: 1 },
};
