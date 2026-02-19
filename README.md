# RescuEdge — Personal Safety Node (ADGC)
### Unified Emergency Response & Victim-Centric Safety Engine

> **The ultimate safety companion** that transforms the victim's smartphone into an active emergency broadcast node. Featuring Google Personal Safety parity, offline-first vaulting, and an intelligent "Handover Mode" for bystanders.

---

## 🏗️ Unified Architecture

```
Rapid_Rescue/
├── apps/
│   ├── personal-safety-node/ # Unified Flutter App: Victim Safety + Rescuer Handover
│   └── dashboard/            # Next.js — High-precision command center
└── infrastructure/
    ├── shared/               # TypeScript — Unified RCTF models and configs
    └── backend/
        ├── detection-service/      # Node.js — SOS ingestion & broadcast
        ├── corridor-service/       # Node.js — Green Corridor management
        ├── notification-service/   # Node.js — FCM & SMS alerting
        └── tracking-service/       # Node.js — Real-time location relay
```

## 🚀 Quick Start

### 1. Backend Services
```bash
# Install and start detection service
cd infrastructure/backend/detection-service && npm install && npm run dev
```

### 2. Dashboard
```bash
cd apps/dashboard && npm install && npm run dev
```

### 3. Unified Safety Node (Mobile)
```bash
cd apps/personal-safety-node && flutter run
```

---

## 🔐 Security & Environment

The backend services enforce **Production Integrity**. If `NODE_ENV=production` is set, the services will **refuse to start** unless the following variables are configured:

| Variable | Description | Default (Dev) |
|----------|-------------|---------------|
| `JWT_SECRET` | Signing key for RCTF envelopes | `rescuedge-dev-...` |
| `CORS_ORIGINS` | Allowed dashboard origins | `*` (Dev only) |
| `MQTT_BROKER_URL` | HiveMQ/Private broker URL | `mqtt://broker...` |
| `PUBLIC_URL` | Full URL of the dashboard | `http://localhost:3000` |

> **Note:** Run `validateConfig()` at startup to ensure all critical dependencies (FCM, Twilio, Gemini) are initialized.

---

## 🧠 Victim-Centric Ecosystem

### Unified Mobile Node
- **Offline-First Vault:** Personal medical data and emergency contacts are encrypted and available without network.
- **Google Safety Parity:** Integrated "Safety Check" timer and automatic Car Crash detection.
- **Handover Mode (Post-Crash):** When an accident is detected, the app shifts into a high-visibility instruction set for bystanders.
- **Situational Intelligence:** Automated guidance for bystanders to capture 45° scene angles; automatically ingest audio/video for on-device ML processing.
- **Professional Takeover:** Official responders can log in directly on the victim's device to access advanced vitals logging and status updates.

### Dashboard Command Center
- **🔴 Live Evidence Stream:** Displays real-time media chunks processed on the device and relayed via RCTF.
- **Incident Timeline:** Visual progression from Crash Detected → Handover Active → AI Analysis → Professional Takeover.
- **Green Corridor Engine:** Automatically creates clear paths for dispatchers en route to the node's GPS coordinates.

---

## 🏆 Offline-First Resilience

The **Personal Safety Node** implements a robust offline queue. If a crash is detected in a zero-network zone:
1.  **Local Vaulting:** The device stores the AI scene analysis and crash metrics locally.
2.  **Local Warning:** Siren and Vibration patterns alert nearby people immediately.
3.  **Automatic Sync:** The moment a 2G/3G/WiFi pulse is detected, the RCTF envelope is broadcast to the global HiveMQ hub.

---

## 🆓 Infrastructure Stack

| Service | Provider | Use Case |
|---------|----------|----------|
| Intelligence | Google Gemini | Scene Analysis & Vision |
| Event Bus | HiveMQ | Global Message Routing |
| Signal Hub | Firebase | Dispatcher Alerts |
| Context | Leaflet | GIS Visualization |
| Hosting | Vercel | Production Deployment |
