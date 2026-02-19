# RescuEdge — ADGC System
### Accident Detection & Green Corridor — Unified Emergency Response

> **Dual-app emergency response ecosystem** that detects road accidents in real-time, dispatches the nearest responder, and creates a Green Corridor for ambulances — all with zero-config, free-tier infrastructure.

---

## 🏗️ Architecture

```
Rapid_Rescue/
├── apps/
│   ├── mobile-bystander/   # Flutter — Crash detection, SOS, Vision Intelligence
│   ├── mobile-responder/   # Flutter — Dispatch alerts, Navigation, Live tracking
│   └── dashboard/          # Next.js — High-precision command center
└── infrastructure/
    ├── shared/             # TypeScript — Unified RCTF models and configs
    └── backend/
        ├── detection-service/    # Node.js — SOS ingestion & broadcast
        ├── corridor-service/     # Node.js — Green Corridor management
        ├── notification-service/  # Node.js — FCM & SMS alerting
        └── tracking-service/     # Node.js — Real-time location relay
```

## 🚀 Quick Start

### 1. Backend Services

```bash
# Install and start detection service
cd infrastructure/backend/detection-service && npm install && npm run dev

# Install and start corridor service
cd infrastructure/backend/corridor-service && npm install && npm run dev

# ... repeat for other services
```

### 2. Dashboard

```bash
cd apps/dashboard
npm install
npm run dev
```

### 3. Flutter Apps

```bash
# User App
cd apps/mobile-bystander && flutter run

# Responder App
cd apps/mobile-responder && flutter run
```

---

## 🔑 Environment Variables

Copy `infrastructure/shared/config/.env.example` to each service directory as `.env`.

**Minimum required for initial load (all free):**
- `JWT_SECRET` — any random string
- `MQTT_BROKER_URL` — `mqtt://broker.hivemq.com` (public, no auth)
- `GEMINI_API_KEY` — Required for bystander AI scene analysis
- Firebase credentials — Required for FCM push notifications
- Twilio credentials — Required for emergency SMS alerts

---

## 🧠 Key Features

### User App
- **4-Stage Crash Detection:** Pulse-drop, G-force impact, ML classifier, and Gyroscope rollover detection.
- **15-Second Safety Buffer:** Intelligent cancellation to prevent false alerts.
- **Bystander AI:** Gemini Flash 1.5 analyzes scene images/audio for severity and hazard detection.
- **RCTF Integration:** All data communication follows the RescuEdge Common Transfer Format.

### Responder App
- **Real-time Dispatch:** Push notifications with detailed incident payloads.
- **Full Victim Profile:** Access to blood group, allergies, and emergency contacts.
- **Precision Navigation:** Low-latency GPS tracking synced with the command center.
- **Dynamic Transmission:** Location updates inform the Green Corridor algorithm every 3 seconds.

### Dashboard Command Center
- **Live High-Precision Map:** Leaflet-based dark mode interface with real-time marker synchronization.
- **🔴 Live Evidence Stream:** Displays real-time media chunks from the accident site (Gemini-supported).
- **Incident Timeline:** Step-by-step visual tracker (Detected → Dispatched → En Route → Arrived).
- **Adaptive Signal Grid:** Real-time traffic signal management with **Pulsing Green Corridor** visuals.
- **Smart Viewport:** Automatic map bounds calculation to fit both the ambulance and the accident site.

### Backend Services
- **MQTT Event Hub:** Low-latency event bus for cross-service communication.
- **Geospatial Corridor Engine:** Haversine-based junction lookup for automated signal clearance.
- **Modular Microservices:** Independent services for detection, corridor management, notifications, and tracking.

---

## 🏆 RCTF — RescuEdge Common Transfer Format

All system components communicate using a unified JSON envelope:

```json
{
  "meta": {
    "requestId": "REQ-uuid",
    "timestamp": "2026-02-19T00:00:00Z",
    "env": "production",
    "version": "1.2"
  },
  "auth": {
    "userId": "U-XXXXXXXX",
    "role": "ADMIN",
    "token": "jwt-auth-token"
  },
  "payload": { ... }
}
```

---

## 🆓 Infrastructure Stack

| Service | Provider | Use Case |
|---------|----------|----------|
| Intelligence | Google Gemini | Scene Analysis & Vision |
| Event Bus | HiveMQ | Global Message Routing |
| Push | Firebase | Dispatcher Alerts |
| Maps | Leaflet/CartoDB | GIS Visualization |
| Hosting | Vercel | Production Deployment |

