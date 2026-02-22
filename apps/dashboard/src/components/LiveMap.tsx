'use client';
// LiveMap — Leaflet map with accident pins, ambulance tracking, Green Corridor,
// and signal indicators. Dynamically imported (no SSR) because Leaflet requires window.
//
// Route rendering strategy:
//  1. Try OSRM with a 4-second timeout for real road geometry.
//  2. Fall back to pre-computed Pune road polylines (puneRoutes.ts).
//  3. As a last resort, draw a direct line (only for unknown routes).

import { useEffect, useRef, useState } from 'react';
import type { CaseRecord, AmbulanceLocation, TrafficSignalPayload } from '@/types/rctf';
import { CORRIDOR_GEOMETRIES, AMBULANCE_ROUTE_GEOMETRIES, fetchOSRMRoute } from '@/data/puneRoutes';
import styles from './LiveMap.module.css';

/* ── Types ───────────────────────────────────────────────────────── */
interface LiveMapProps {
    cases: CaseRecord[];
    ambulanceLocations: Map<string, AmbulanceLocation>;
    signals: TrafficSignalPayload[];
    selectedCase: CaseRecord | null;
    onCaseSelect: (c: CaseRecord) => void;
    theme: 'light' | 'dark';
}

// Plain-object ref stores (avoids Map constructor confusion w/ Leaflet's Map)
type PolylineStore = Record<string, L.Polyline[]>;
type MarkerStore = Record<string, L.Marker>;
type RouteCache = Record<string, { lat: number; lng: number; accidentId: string }>;
type GeomCache = Record<string, L.LatLngExpression[]>;

/* ── Component ───────────────────────────────────────────────────── */
export default function LiveMap({
    cases,
    ambulanceLocations,
    signals,
    selectedCase,
    onCaseSelect,
    theme,
}: LiveMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMap = useRef<L.Map | null>(null);
    const [mapReady, setMapReady] = useState(false);

    // Marker stores (plain objects)
    const markersRef = useRef<MarkerStore>({});
    const ambulanceMarkersRef = useRef<MarkerStore>({});
    const signalMarkersRef = useRef<MarkerStore>({});

    // Route polyline stores
    const ambPolyRef = useRef<PolylineStore>({});
    const ambCacheRef = useRef<RouteCache>({});
    const corridorPolyRef = useRef<L.Polyline[]>([]);
    const corridorGeomRef = useRef<GeomCache>({});
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    // Track the last case we panned to — prevents re-pan while user is dragging
    const lastPannedCaseRef = useRef<string | null>(null);

    // ── Initialize map ──────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current) return;
        if ((mapRef.current as any)._leaflet_id) return; // already initialised

        let destroyed = false;

        import('leaflet').then((L) => {
            if (destroyed || !mapRef.current || leafletMap.current) return;
            if ((mapRef.current as any)._leaflet_id) return;

            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            const map = L.map(mapRef.current!, {
                center: [18.5204, 73.8567],
                zoom: 14,
                minZoom: 3,
                maxZoom: 19,

                // ── Zoom behaviour (M3: smooth, responsive) ──
                zoomControl: false,              // We'll add custom M3 controls
                zoomSnap: 0.5,                   // Smooth half-step snapping
                zoomDelta: 0.5,                  // Smaller increments per scroll
                wheelDebounceTime: 80,           // Responsive but not twitchy
                wheelPxPerZoomLevel: 120,         // Comfortable scroll distance

                // ── Interaction ──
                scrollWheelZoom: true,
                doubleClickZoom: true,
                touchZoom: true,
                dragging: true,
                keyboard: true,
                boxZoom: true,
                bounceAtZoomLimits: true,

                // ── Animation ──
                zoomAnimation: true,
                fadeAnimation: true,
                markerZoomAnimation: true,
            });

            // M3 zoom control positioned bottom-right
            L.control.zoom({
                position: 'bottomright',
                zoomInTitle: 'Zoom in',
                zoomOutTitle: 'Zoom out',
            }).addTo(map);

            // ── Custom "Locate me" control (above zoom) ──────────────
            const ICON = (name: string) =>
                `<span class="material-icons-round" style="font-size:20px;line-height:40px">${name}</span>`;

            const LocateControl = L.Control.extend({
                options: { position: 'bottomright' as L.ControlPosition },
                onAdd() {
                    const container = L.DomUtil.create('div');
                    container.style.cssText = `
                        display:flex;flex-direction:column;gap:4px;
                        padding:6px;background:var(--md-sys-color-surface);
                        border:1px solid var(--md-sys-color-outline-variant);
                        border-radius:8px;box-shadow:var(--shadow-md);
                    `;
                    const btn = L.DomUtil.create('button', '', container) as HTMLButtonElement;
                    btn.type = 'button';
                    btn.title = 'My location';
                    btn.setAttribute('aria-label', 'My location');
                    btn.style.cssText = `
                        width:40px;height:40px;padding:0;
                        background:var(--md-sys-color-secondary-container);
                        border:none;border-radius:6px;cursor:pointer;
                        display:flex;align-items:center;justify-content:center;
                        color:var(--md-sys-color-on-secondary-container);
                        transition:all 0.2s var(--easing-standard);
                    `;
                    btn.onmouseover = () => {
                        btn.style.background = 'var(--md-sys-color-secondary-container)';
                        btn.style.opacity = '0.8';
                    };
                    btn.onmouseout = () => {
                        btn.style.background = 'var(--md-sys-color-secondary-container)';
                        btn.style.opacity = '1';
                    };
                    btn.innerHTML = ICON('my_location');

                    // Track in-flight request so a second click cancels the first
                    let watchId: number | null = null;

                    const reset = (icon: string) => {
                        if (watchId !== null) {
                            navigator.geolocation.clearWatch(watchId);
                            watchId = null;
                        }
                        btn.innerHTML = ICON(icon);
                        if (icon !== 'my_location') {
                            setTimeout(() => { btn.innerHTML = ICON('my_location'); }, 2200);
                        }
                    };

                    L.DomEvent.disableClickPropagation(container);
                    L.DomEvent.on(btn, 'click', (e: Event) => {
                        L.DomEvent.preventDefault(e);
                        if (!navigator.geolocation) {
                            reset('location_off');
                            return;
                        }
                        // If already pending, cancel it
                        if (watchId !== null) {
                            reset('my_location');
                            return;
                        }
                        btn.innerHTML = ICON('sync');
                        // Use low-accuracy for instant response on desktops (no GPS hardware).
                        // maximumAge: accept a cached fix up to 60 s old.
                        // timeout: give up after 6 s and show the error state.
                        watchId = navigator.geolocation.watchPosition(
                            (pos) => {
                                map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.2 });
                                reset('my_location');
                            },
                            (err) => {
                                const icon = err.code === 1 /* PERMISSION_DENIED */
                                    ? 'location_off'
                                    : 'location_disabled';
                                reset(icon);
                            },
                            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 }
                        );
                    });
                    return container;
                },
            });
            new LocateControl().addTo(map);

            // Use CartoDB Light/Dark tiles to match the UI theme.
            // Read `theme` prop (captured at mount — already authoritative from
            // useLiveData's localStorage init) instead of the DOM attribute,
            // which may not be set yet when ths effect fires.
            const tileStyle = theme === 'dark' ? 'dark_all' : 'light_all';
            tileLayerRef.current = L.tileLayer(
                `https://{s}.basemaps.cartocdn.com/${tileStyle}/{z}/{x}/{y}{r}.png`,
                {
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
                    maxZoom: 19,
                    subdomains: 'abcd',
                }
            ).addTo(map);

            leafletMap.current = map;
            setMapReady(true);
        });

        return () => {
            destroyed = true;
            if (leafletMap.current) {
                leafletMap.current.remove();
                leafletMap.current = null;
            }
        };
    }, []);

    // ── Swap tile layer when theme changes ─────────────────────────
    useEffect(() => {
        if (!leafletMap.current || !tileLayerRef.current) return;
        const tileStyle = theme === 'dark' ? 'dark_all' : 'light_all';
        // setUrl alone only affects future tile requests; redraw() forces the
        // already-loaded tiles to be re-fetched with the new URL immediately.
        tileLayerRef.current
            .setUrl(`https://{s}.basemaps.cartocdn.com/${tileStyle}/{z}/{x}/{y}{r}.png`)
            .redraw();
    }, [theme, mapReady]);

    // ── Update accident markers ─────────────────────────────────────
    useEffect(() => {
        if (!leafletMap.current || !mapReady) return;
        let active = true;

        import('leaflet').then((L) => {
            if (!active || !leafletMap.current) return;
            const map = leafletMap.current;

            // Remove stale
            for (const id of Object.keys(markersRef.current)) {
                if (!cases.find(c => c.accidentId === id)) {
                    const m = markersRef.current[id];
                    if (m && map.hasLayer(m)) map.removeLayer(m);
                    delete markersRef.current[id];
                }
            }

            // Add / update
            for (const c of cases) {
                const isSelected = selectedCase?.accidentId === c.accidentId;
                const isResolved = c.status === 'RESOLVED';
                const pulseClass = !isSelected && !isResolved ? 'map-blip-pulse' : '';

                const icon = L.divIcon({
                    className: pulseClass,
                    html: `<div style="
                        width: ${isSelected ? 32 : 10}px;
                        height: ${isSelected ? 32 : 10}px;
                        background: ${isResolved ? 'var(--md-sys-color-outline)' : 'var(--color-sos-red)'};
                        border: ${isSelected ? '2px solid var(--md-sys-color-surface)' : 'none'};
                        border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 0 ${isSelected ? 15 : 6}px ${isResolved ? 'var(--md-sys-color-outline)' : 'var(--color-sos-red)'};
                        cursor: pointer;
                        transition: all 0.4s cubic-bezier(0.19,1,0.22,1);
                    ">${isSelected ? '<span class="material-icons-round" style="font-size:18px;color:var(--md-sys-color-on-primary)">car_crash</span>' : ''}</div>`,
                    iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
                    iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16],
                });

                const existing = markersRef.current[c.accidentId];
                if (existing) {
                    existing.setIcon(icon);
                } else {
                    const marker = L.marker([c.location.lat, c.location.lng], { icon })
                        .addTo(map)
                        .bindPopup(`
                            <div style="min-width:200px;font-family:var(--font-sans)">
                                <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--md-sys-color-primary)">${c.accidentId}</div>
                                <div style="font-size:12px;margin-bottom:4px;color:var(--md-sys-color-on-surface-variant)">Blood: <strong style="color:var(--color-sos-red)">${c.medicalProfile.bloodGroup}</strong></div>
                                <div style="font-size:12px;margin-bottom:4px;color:var(--md-sys-color-on-surface-variant)">G-Force: ${c.metrics.gForce.toFixed(1)}g</div>
                                <div style="font-size:12px;color:var(--md-sys-color-on-surface-variant)">Status: ${c.status}</div>
                            </div>
                        `);
                    marker.on('click', () => onCaseSelect(c));
                    markersRef.current[c.accidentId] = marker;
                }
            }

        });

        return () => { active = false; };
        // ambulanceLocations intentionally omitted — markers don't need to
        // re-run every 800 ms tick; a separate effect handles pan-on-select.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cases, selectedCase, onCaseSelect, mapReady]);

    // ── Pan / fitBounds when a new case is selected ───────────────────
    // Depends only on the case ID (a stable string) so it fires exactly once
    // per selection change and never while the user is dragging/panning.
    useEffect(() => {
        if (!leafletMap.current || !mapReady || !selectedCase) return;
        // Skip if we already panned to this case
        if (lastPannedCaseRef.current === selectedCase.accidentId) return;
        lastPannedCaseRef.current = selectedCase.accidentId;

        import('leaflet').then((L) => {
            if (!leafletMap.current || !selectedCase) return;
            const map = leafletMap.current;
            const amb = Array.from(ambulanceLocations.values()).find(
                a => a.accidentId === selectedCase.accidentId
            );
            if (amb) {
                const bounds = L.latLngBounds([
                    [selectedCase.location.lat, selectedCase.location.lng],
                    [amb.location.lat, amb.location.lng],
                ]);
                map.fitBounds(bounds, { padding: [60, 60], animate: true, maxZoom: 16 });
            } else {
                map.flyTo(
                    [selectedCase.location.lat, selectedCase.location.lng],
                    15,
                    { animate: true, duration: 0.8 }
                );
            }
        });
        // ambulanceLocations read inside but NOT a dep — we only want to re-pan
        // when the case changes, not when the ambulance moves.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCase?.accidentId, mapReady]);

    // ── Stable key for ambulance data — includes entityId to prevent polyline conflicts ──
    const ambulanceKey = JSON.stringify(
        Array.from(ambulanceLocations.entries()).map(([k, v]) => [v.entityId, v.accidentId, v.location.lat, v.location.lng])
    );
    const selectedCaseId = selectedCase?.accidentId ?? null;

    // ── Update ambulance route polylines ─────────────────────────────
    useEffect(() => {
        if (!leafletMap.current || !mapReady) return;
        let active = true;

        const map = leafletMap.current;
        const osrmAbortCtrl = new AbortController();

        const renderRoutes = async () => {
            const L = await import('leaflet');
            if (!active || !leafletMap.current) return;

            const allAmbs = Array.from(ambulanceLocations.values());
            const activeAmbs = allAmbs.filter(amb => {
                const c = cases.find(c => c.accidentId === amb.accidentId);
                return c && !['ARRIVED', 'RESOLVED', 'CANCELLED'].includes(c.status);
            });

            // ── Phase 1: Clear old polylines ──
            // Remove ALL existing ambulance polylines for a clean slate
            for (const id of Object.keys(ambPolyRef.current)) {
                ambPolyRef.current[id]?.forEach(p => {
                    if (map.hasLayer(p)) map.removeLayer(p);
                });
                delete ambPolyRef.current[id];
            }

            // ── Phase 2: Draw routes (hardcoded first, then OSRM upgrade) ──
            for (const amb of activeAmbs) {
                const targetCase = cases.find(c => c.accidentId === amb.accidentId);
                if (!targetCase) continue;

                const isSelected = selectedCaseId === targetCase.accidentId;

                // When a case is selected, only show THAT case's ambulance route
                if (selectedCaseId && !isSelected) continue;

                // Draw hardcoded route immediately (instant, no network wait)
                let coordinates: L.LatLngExpression[] | null = null;
                const fallback = AMBULANCE_ROUTE_GEOMETRIES[targetCase.accidentId];
                if (fallback) {
                    // Trim route to start from nearest point to current ambulance position
                    const ambLat = amb.location.lat;
                    const ambLng = amb.location.lng;
                    let nearestIdx = 0;
                    let minDist = Infinity;
                    for (let i = 0; i < fallback.length; i++) {
                        const [lat, lng] = fallback[i];
                        const dist = (lat - ambLat) ** 2 + (lng - ambLng) ** 2;
                        if (dist < minDist) {
                            minDist = dist;
                            nearestIdx = i;
                        }
                    }
                    const trimmed = fallback.slice(nearestIdx);
                    coordinates = [
                        [ambLat, ambLng] as L.LatLngExpression,
                        ...trimmed.map(([lat, lng]) => [lat, lng] as L.LatLngExpression),
                    ];
                }
                if (!coordinates) {
                    coordinates = [
                        [amb.location.lat, amb.location.lng],
                        [targetCase.location.lat, targetCase.location.lng],
                    ];
                }

                // ── M3 Production 4-layer ambulance route ──
                // L1: Glow halo (elevation)
                // L2: Solid backbone (road width)
                // L3: Animated flow dashes (direction)
                // L4: Arrow indicators (clarity)
                const sel = isSelected;
                const layers: L.Polyline[] = [];

                // L1 — Wide glow halo (depth / elevation shadow)
                const l1 = L.polyline(coordinates, {
                    color: sel ? 'var(--color-blue-bright)' : 'var(--color-ai-blue)',
                    weight: sel ? 24 : 20,
                    opacity: sel ? 0.18 : 0.10,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(map);
                l1.getElement()?.classList.add(styles.ambGlow);
                layers.push(l1);

                // L2 — Solid backbone (road-width foundation)
                const l2 = L.polyline(coordinates, {
                    color: sel ? 'var(--color-blue-bright)' : 'var(--color-ai-blue)',
                    weight: sel ? 6 : 4,
                    opacity: sel ? 0.55 : 0.40,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(map);
                l2.getElement()?.classList.add(styles.ambSolid);
                layers.push(l2);

                // L3 — Slowly flowing dashes (primary animated layer)
                // dashArray period = 16 + 20 = 36 px — matches keyframe offset
                const l3 = L.polyline(coordinates, {
                    color: sel ? 'var(--color-blue-bright)' : 'var(--color-ai-blue)',
                    weight: sel ? 5 : 4,
                    opacity: sel ? 1.0 : 0.85,
                    dashArray: '16, 20',
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(map);
                l3.getElement()?.classList.add(sel ? styles.ambFlowSelected : styles.ambFlow);
                layers.push(l3);

                // Use entityId + accidentId as key to prevent conflicts when multiple ambulances for same case
                const polyKey = `${amb.entityId}__${amb.accidentId}`;
                ambPolyRef.current[polyKey] = layers;
            }

            // ── Phase 3: Background OSRM upgrade (non-blocking) ──
            for (const amb of activeAmbs) {
                const targetCase = cases.find(c => c.accidentId === amb.accidentId);
                if (!targetCase) continue;
                if (selectedCaseId && selectedCaseId !== targetCase.accidentId) continue;

                // Capture polyline key in closure for OSRM callback
                const polylineStoreKey = `${amb.entityId}__${amb.accidentId}`;

                // Fire-and-forget OSRM upgrade
                fetchOSRMRoute(
                    amb.location.lng, amb.location.lat,
                    targetCase.location.lng, targetCase.location.lat,
                    3000,
                    osrmAbortCtrl.signal,
                ).then(osrmResult => {
                    if (!active || !osrmResult || !leafletMap.current) return;
                    const currentMap = leafletMap.current;
                    const sel2 = selectedCaseId === targetCase.accidentId;

                    // Replace hardcoded polylines with OSRM polylines
                    ambPolyRef.current[polylineStoreKey]?.forEach(p => {
                        if (currentMap.hasLayer(p)) currentMap.removeLayer(p);
                    });

                    // Same 4-layer M3 system
                    const newLayers: L.Polyline[] = [];

                    const g1 = L.polyline(osrmResult, { color: sel2 ? 'var(--color-blue-bright)' : 'var(--color-ai-blue)', weight: sel2 ? 24 : 20, opacity: sel2 ? 0.18 : 0.10, lineCap: 'round', lineJoin: 'round' }).addTo(currentMap);
                    g1.getElement()?.classList.add(styles.ambGlow);
                    newLayers.push(g1);

                    const g2 = L.polyline(osrmResult, { color: sel2 ? 'var(--color-blue-bright)' : 'var(--color-ai-blue)', weight: sel2 ? 6 : 4, opacity: sel2 ? 0.55 : 0.40, lineCap: 'round', lineJoin: 'round' }).addTo(currentMap);
                    g2.getElement()?.classList.add(styles.ambSolid);
                    newLayers.push(g2);

                    const g3 = L.polyline(osrmResult, { color: sel2 ? 'var(--color-blue-bright)' : 'var(--color-ai-blue)', weight: sel2 ? 5 : 4, opacity: sel2 ? 1.0 : 0.85, dashArray: '16, 20', lineCap: 'round', lineJoin: 'round' }).addTo(currentMap);
                    g3.getElement()?.classList.add(sel2 ? styles.ambFlowSelected : styles.ambFlow);
                    newLayers.push(g3);

                    ambPolyRef.current[polylineStoreKey] = newLayers;
                    console.log(`[LiveMap] 🔄 OSRM upgrade for ${targetCase.accidentId} (${osrmResult.length} pts)`);
                }).catch(() => { /* keep hardcoded */ });
            }
        };

        renderRoutes();
        return () => { active = false; osrmAbortCtrl.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ambulanceKey, selectedCaseId, cases, mapReady]);

    // ── Update ambulance markers ────────────────────────────────────
    useEffect(() => {
        if (!leafletMap.current || !mapReady) return;
        let active = true;

        import('leaflet').then((L) => {
            if (!active || !leafletMap.current) return;
            const map = leafletMap.current;

            // Remove stale
            for (const id of Object.keys(ambulanceMarkersRef.current)) {
                if (!ambulanceLocations.has(id)) {
                    const m = ambulanceMarkersRef.current[id];
                    if (m && map.hasLayer(m)) map.removeLayer(m);
                    delete ambulanceMarkersRef.current[id];
                }
            }

            Array.from(ambulanceLocations.entries()).forEach(([entityId, amb]) => {
                const icon = L.divIcon({
                    className: '',
                    html: `<div style="
                        width:40px;height:40px;
                        background:var(--md-sys-color-secondary-container);
                        border:2px solid var(--md-sys-color-surface);
                        border-radius:6px;
                        display:flex;align-items:center;justify-content:center;
                        box-shadow:var(--glow-ai-blue),var(--shadow-md);
                        transform:rotate(${amb.location.heading ?? 0}deg);
                        transition:all 0.5s var(--easing-standard);
                    "><span class="material-icons-round" style="font-size:24px;color:var(--color-sos-red)">local_hospital</span></div>`,
                    iconSize: [48, 48],
                    iconAnchor: [24, 24],
                });

                const existing = ambulanceMarkersRef.current[entityId];
                if (existing) {
                    existing.setLatLng([amb.location.lat, amb.location.lng]);
                    existing.setIcon(icon);
                } else {
                    const marker2 = L.marker([amb.location.lat, amb.location.lng], { icon })
                        .addTo(map)
                        .bindPopup(`<div style="font-family:var(--font-sans);min-width:140px"><strong style="color:var(--md-sys-color-secondary)">${entityId}</strong><br/><span style="color:var(--md-sys-color-on-surface-variant);font-size:12px">Speed: ${((amb.location.speed ?? 0) * 3.6).toFixed(0)} km/h</span></div>`);
                    ambulanceMarkersRef.current[entityId] = marker2;
                }
            });
        });

        return () => { active = false; };
    }, [ambulanceLocations, mapReady]);

    // ── Update signal markers ───────────────────────────────────────
    useEffect(() => {
        if (!leafletMap.current || !mapReady) return;
        let active = true;

        import('leaflet').then((L) => {
            if (!active || !leafletMap.current) return;
            const map = leafletMap.current;
            const activeSignals = signals.filter(s => s.corridor);

            // Clean stale
            for (const id of Object.keys(signalMarkersRef.current)) {
                if (!activeSignals.find(s => s.signalId === id)) {
                    const m = signalMarkersRef.current[id];
                    if (m && map.hasLayer(m)) map.removeLayer(m);
                    delete signalMarkersRef.current[id];
                }
            }

            // CSS custom properties work in inline styles — fully theme-adaptive
            const STATE_VARS: Record<string, string> = {
                GREEN: 'var(--indicator-GREEN)',
                RED:   'var(--indicator-RED)',
                YELLOW:'var(--indicator-YELLOW)',
            };

            for (const signal of activeSignals) {
                const colorVar = STATE_VARS[signal.state] ?? 'var(--md-sys-color-outline)';
                const pulseClass = signal.state === 'GREEN' ? 'leaflet-corridor-pulse' : '';

                const icon = L.divIcon({
                    className: pulseClass,
                    html: `<div style="
                        width:12px;height:12px;background:${colorVar};
                        border:2px solid var(--md-sys-color-surface);border-radius:50%;
                        box-shadow:0 0 12px ${colorVar};
                    "></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                });

                const existing = signalMarkersRef.current[signal.signalId];
                if (existing) {
                    existing.setLatLng([signal.location.lat, signal.location.lng]);
                    existing.setIcon(icon);
                } else {
                    const marker = L.marker([signal.location.lat, signal.location.lng], { icon })
                        .bindPopup(`<div style="font-family:var(--font-sans)"><strong style="color:var(--md-sys-color-on-surface)">${signal.junctionId}</strong><br/><span style="font-size:12px;color:var(--md-sys-color-on-surface-variant)">State: ${signal.state}</span></div>`)
                        .addTo(map);
                    signalMarkersRef.current[signal.signalId] = marker;
                }
            }
        });

        return () => { active = false; };
    }, [signals, mapReady]);

    // ── Update Green Corridor paths ─────────────────────────────────
    const signalStateKey = JSON.stringify(
        signals.map(s => ({ id: s.signalId, state: s.state, corridor: s.corridor }))
    );

    useEffect(() => {
        if (!leafletMap.current || !mapReady) return;
        let active = true;

        const drawCorridors = async () => {
            if (!leafletMap.current) return;
            const map = leafletMap.current;
            const L = await import('leaflet');

            const corridorSignals = signals.filter(s => s.corridor);
            if (corridorSignals.length < 2) {
                corridorPolyRef.current.forEach(p => { if (map.hasLayer(p)) map.removeLayer(p); });
                corridorPolyRef.current = [];
                return;
            }

            const ordered = [...corridorSignals].sort(
                (a, b) => (a.corridorOrder ?? 0) - (b.corridorOrder ?? 0)
            );

            const newPolylines: L.Polyline[] = [];

            for (let i = 0; i < ordered.length - 1; i++) {
                const from = ordered[i];
                const to = ordered[i + 1];

                // Only render when both signals are GREEN
                if (from.state !== 'GREEN' || to.state !== 'GREEN') continue;

                const segmentKey = `${from.signalId}→${to.signalId}`;

                // Get geometry: cached → hardcoded → OSRM → direct line
                let geometry: L.LatLngExpression[] | undefined = corridorGeomRef.current[segmentKey];

                if (!geometry) {
                    const hc = CORRIDOR_GEOMETRIES[segmentKey];
                    if (hc) {
                        geometry = hc.map(([lat, lng]) => [lat, lng] as L.LatLngExpression);
                        corridorGeomRef.current[segmentKey] = geometry;
                    }
                }

                if (!geometry) {
                    // Try OSRM (3s timeout)
                    const osrm = await fetchOSRMRoute(
                        from.location.lng, from.location.lat,
                        to.location.lng, to.location.lat,
                        3000,
                    );
                    if (osrm) {
                        geometry = osrm;
                        corridorGeomRef.current[segmentKey] = geometry;
                    }
                }

                if (!geometry) {
                    geometry = [
                        [from.location.lat, from.location.lng],
                        [to.location.lat, to.location.lng],
                    ];
                }

                if (!active) return;

                // ── M3 Production 5-layer corridor visualization ──
                // L1: Outer glow (depth/elevation)
                // L2: Outer border (definition)
                // L3: Solid body (main corridor)
                // L4: Inner core (glass-tube effect)
                // L5: Animated flow dashes (direction)

                // L1 — Outer glow
                const c1 = L.polyline(geometry, {
                    color: '#00C853', weight: 30, opacity: 0.10,
                    lineCap: 'round', lineJoin: 'round',
                }).addTo(map);
                c1.getElement()?.classList.add(styles.corridorGlow);
                newPolylines.push(c1);

                // L2 — Outer border
                const c2 = L.polyline(geometry, {
                    color: '#1B5E20', weight: 12, opacity: 0.35,
                    lineCap: 'round', lineJoin: 'round',
                }).addTo(map);
                c2.getElement()?.classList.add(styles.corridorOuter);
                newPolylines.push(c2);

                // L3 — Solid body
                const c3 = L.polyline(geometry, {
                    color: '#00C853', weight: 8, opacity: 0.85,
                    lineCap: 'round', lineJoin: 'round',
                }).addTo(map);
                c3.getElement()?.classList.add(styles.corridorSolid);
                newPolylines.push(c3);

                // L4 — Inner core (lighter, glass-tube)
                const c4 = L.polyline(geometry, {
                    color: '#69F0AE', weight: 4, opacity: 0.6,
                    lineCap: 'round', lineJoin: 'round',
                }).addTo(map);
                c4.getElement()?.classList.add(styles.corridorInner);
                newPolylines.push(c4);

                // L5 — Animated flow dashes
                const c5 = L.polyline(geometry, {
                    color: '#B9F6CA', weight: 3, opacity: 1.0,
                    dashArray: '10, 25', lineCap: 'round', lineJoin: 'round',
                }).addTo(map);
                c5.getElement()?.classList.add(styles.corridorFlow);
                newPolylines.push(c5);
            }

            if (!active) return;

            // Atomic swap
            corridorPolyRef.current.forEach(p => { if (map.hasLayer(p)) map.removeLayer(p); });
            corridorPolyRef.current = newPolylines;
        };

        drawCorridors();
        return () => { active = false; };
    }, [signalStateKey, mapReady]);

    // ── Render ──────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            <div ref={mapRef} className={styles.map} />
            <div className={styles.legend}>
                <div style={{
                    paddingBottom: '6px',
                    borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                    marginBottom: '6px',
                    fontWeight: 600,
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    color: 'var(--md-sys-color-text-muted)',
                }}>Mission Map</div>
                <LegendItem color="var(--color-sos-red)" label="SOS Event" />
                <LegendItem color="var(--color-blue-bright)" label="Ambulance Path" isRoute />
                <LegendItem color="var(--color-arrived-green)" label="Green Corridor" isRoute />
            </div>
        </div>
    );
}

function LegendItem({ color, label, isRoute }: { color: string; label: string; isRoute?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isRoute ? (
                <div style={{
                    width: 22,
                    height: 4,
                    borderRadius: 'var(--radius-xs)',
                    background: `linear-gradient(90deg, ${color}, ${color}88)`,
                    boxShadow: `0 0 6px ${color}`,
                    flexShrink: 0,
                }} />
            ) : (
                <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                    flexShrink: 0,
                }} />
            )}
            <span style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--md-sys-color-on-surface-variant)',
                letterSpacing: '0.2px',
                lineHeight: 1,
            }}>{label}</span>
        </div>
    );
}
