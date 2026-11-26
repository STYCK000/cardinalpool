import React from 'react';
import { TileLayer } from 'react-leaflet';
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
