'use client';
// LiveMap — Leaflet map with accident pins, ambulance tracking, and signal indicators
// Dynamically imported (no SSR) because Leaflet requires window
import { useEffect, useRef } from 'react';
import type { CaseRecord, AmbulanceLocation, TrafficSignalPayload } from '@/types/rctf';
import styles from './LiveMap.module.css';

interface LiveMapProps {
    cases: CaseRecord[];
    ambulanceLocations: Map<string, AmbulanceLocation>;
    signals: TrafficSignalPayload[];
    selectedCase: CaseRecord | null;
    onCaseSelect: (c: CaseRecord) => void;
}

export default function LiveMap({ cases, ambulanceLocations, signals, selectedCase, onCaseSelect }: LiveMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMap = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());
    const ambulanceRef = useRef<Map<string, L.Marker>>(new Map());
    const signalRef = useRef<Map<string, L.Marker>>(new Map());

    // Initialize map
    useEffect(() => {
        if (!mapRef.current) return;
        // Guard against React Strict Mode double-invoke:
        // Leaflet stamps _leaflet_id on the DOM node; if it exists the container
        // was already initialised (even if our ref was cleared by cleanup).
        if ((mapRef.current as unknown as Record<string, unknown>)._leaflet_id) return;

        let destroyed = false; // flag for async safety

        // Dynamic import of Leaflet
        import('leaflet').then((L) => {
            // Bail if the component unmounted before the promise resolved
            if (destroyed || !mapRef.current || leafletMap.current) return;
            // Also bail if Leaflet already stamped the container in a concurrent render
            if ((mapRef.current as unknown as Record<string, unknown>)._leaflet_id) return;

            // Fix default icon paths
            delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            const map = L.map(mapRef.current!, {
                center: [18.5204, 73.8567], // Pune, India
                zoom: 13,
                zoomControl: true,
            });

            // Dark tile layer (CartoDB Dark Matter — free, no API key)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CARTO',
                subdomains: 'abcd',
                maxZoom: 19,
            }).addTo(map);

            leafletMap.current = map;
        });

        return () => {
            destroyed = true;
            if (leafletMap.current) {
                leafletMap.current.remove();
                leafletMap.current = null;
            }
        };
    }, []);

    // Update accident markers
    useEffect(() => {
        if (!leafletMap.current) return;
        import('leaflet').then((L) => {
            const map = leafletMap.current!;

            // Remove stale markers
            Array.from(markersRef.current.entries()).forEach(([id, marker]) => {
                if (!cases.find((c) => c.accidentId === id)) {
                    map.removeLayer(marker);
                    markersRef.current.delete(id);
                }
            });

            // Add/update markers
            for (const c of cases) {
                const existing = markersRef.current.get(c.accidentId);
                const isSelected = selectedCase?.accidentId === c.accidentId;

                const icon = L.divIcon({
                    className: '',
                    html: `<div style="
            width: ${isSelected ? 40 : 32}px;
            height: ${isSelected ? 40 : 32}px;
            background: ${c.status === 'RESOLVED' ? '#22c55e' : '#ef4444'};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isSelected ? 18 : 14}px;
            box-shadow: 0 0 ${isSelected ? 20 : 12}px ${c.status === 'RESOLVED' ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)'};
            cursor: pointer;
            transition: all 0.3s;
          ">🚨</div>`,
                    iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
                    iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16],
                });

                if (existing) {
                    existing.setIcon(icon);
                } else {
                    const marker = L.marker([c.location.lat, c.location.lng], { icon })
                        .addTo(map)
                        .bindPopup(`
              <div style="font-family: Inter, sans-serif; min-width: 200px;">
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 6px;">${c.accidentId}</div>
                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">Blood Group: <strong style="color: #ef4444">${c.medicalProfile.bloodGroup}</strong></div>
                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">G-Force: ${c.metrics.gForce.toFixed(1)}g</div>
                <div style="font-size: 12px; color: #94a3b8;">Status: ${c.status}</div>
              </div>
            `);
                    marker.on('click', () => onCaseSelect(c));
                    markersRef.current.set(c.accidentId, marker);
                }
            }

            // Pan to selected case
            if (selectedCase) {
                // Find associated ambulance
                const amb = Array.from(ambulanceLocations.values()).find(a => a.accidentId === selectedCase.accidentId);

                if (amb) {
                    // Fit map to show both
                    const bounds = L.latLngBounds([
                        [selectedCase.location.lat, selectedCase.location.lng],
                        [amb.location.lat, amb.location.lng]
                    ]);
                    map.fitBounds(bounds, { padding: [50, 50], animate: true });
                } else {
                    map.panTo([selectedCase.location.lat, selectedCase.location.lng], { animate: true });
                    if (map.getZoom() < 15) {
                        map.setZoom(15, { animate: true });
                    }
                }
            }
        });
    }, [cases, selectedCase, onCaseSelect, ambulanceLocations]);

    // Update polyline for active route
    const polylineRef = useRef<L.Polyline | null>(null);
    useEffect(() => {
        if (!leafletMap.current) return;
        import('leaflet').then((L) => {
            const map = leafletMap.current!;

            // Remove old polyline
            if (polylineRef.current) {
                map.removeLayer(polylineRef.current);
                polylineRef.current = null;
            }

            if (selectedCase) {
                const amb = Array.from(ambulanceLocations.values()).find(a => a.accidentId === selectedCase.accidentId);
                if (amb) {
                    const polyline = L.polyline([
                        [amb.location.lat, amb.location.lng],
                        [selectedCase.location.lat, selectedCase.location.lng]
                    ], {
                        color: '#3b82f6',
                        weight: 4,
                        opacity: 0.6,
                        dashArray: '10, 10',
                        lineCap: 'round'
                    }).addTo(map);
                    polylineRef.current = polyline;
                }
            }
        });
    }, [selectedCase, ambulanceLocations]);

    // Update ambulance markers
    useEffect(() => {
        if (!leafletMap.current) return;
        import('leaflet').then((L) => {
            const map = leafletMap.current!;

            Array.from(ambulanceLocations.entries()).forEach(([entityId, amb]) => {
                const icon = L.divIcon({
                    className: '',
                    html: `
                        <div style="
                            width: 44px;
                            height: 44px;
                            background: #3b82f6;
                            border: 2px solid white;
                            border-radius: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 0 15px rgba(59,130,246,0.6);
                            transform: rotate(${amb.location.heading ?? 0}deg);
                            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                        ">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 10L19 13L16 16"/>
                                <path d="M5 10L2 13L5 16"/>
                                <rect width="16" height="10" x="4" y="6" rx="2"/>
                                <path d="M12 10V14"/>
                                <path d="M10 12H14"/>
                            </svg>
                        </div>
                    `,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                });

                const existing = ambulanceRef.current.get(entityId);
                if (existing) {
                    existing.setLatLng([amb.location.lat, amb.location.lng]);
                    existing.setIcon(icon);
                } else {
                    const marker = L.marker([amb.location.lat, amb.location.lng], { icon })
                        .addTo(map)
                        .bindPopup(`<div style="font-family: Inter, sans-serif;"><strong>${entityId}</strong><br/>Speed: ${((amb.location.speed ?? 0) * 3.6).toFixed(0)} km/h</div>`);
                    ambulanceRef.current.set(entityId, marker);
                }
            });
        });
    }, [ambulanceLocations]);

    // Update signal markers
    useEffect(() => {
        if (!leafletMap.current) return;
        import('leaflet').then((L) => {
            const map = leafletMap.current!;

            for (const signal of signals) {
                const isGreen = signal.state === 'GREEN';
                const color = isGreen ? '#22c55e' : signal.state === 'RED' ? '#ef4444' : '#eab308';
                const isCorridor = signal.corridor;

                // Use a CSS class for the pulse animation instead of injecting a <style>
                // tag into every divIcon — which would create O(n) <style> nodes in the DOM.
                // The `leaflet-corridor-pulse` class is defined globally in LiveMap.module.css.
                const pulseClass = isCorridor && isGreen ? 'leaflet-corridor-pulse' : '';
                const size = isCorridor ? 32 : 24;
                const icon = L.divIcon({
                    className: '',
                    html: `<div class="${pulseClass}" style="
                            width: ${size}px;
                            height: ${size}px;
                            background: ${color};
                            border: 2px solid white;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 0 ${isCorridor ? 15 : 8}px ${color};
                        ">${isCorridor ? '🚑' : ''}</div>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2],
                });

                const existing = signalRef.current.get(signal.signalId);

                if (existing) {
                    existing.setLatLng([signal.location.lat, signal.location.lng]);
                    existing.setIcon(icon);
                } else {
                    const marker = L.marker([signal.location.lat, signal.location.lng], { icon })
                        .addTo(map)
                        .bindPopup(`<div style="font-family: Inter, sans-serif;"><strong>${signal.junctionId}</strong><br/>State: ${signal.state}${signal.corridor ? '<br/>🚑 Corridor Active' : ''}</div>`);
                    signalRef.current.set(signal.signalId, marker);
                }
            }
        });
    }, [signals]);

    return (
        <div className={styles.container}>
            <div ref={mapRef} className={styles.map} />
            <div className={styles.legend}>
                <LegendItem color="#ef4444" label="Accident" />
                <LegendItem color="#3b82f6" label="Ambulance" />
                <LegendItem color="#22c55e" label="Green Signal" />
                <LegendItem color="#ef4444" label="Red Signal" />
            </div>
        </div>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
        </div>
    );
}
