# 🐳 DocSee

A self-hosted Docker management dashboard for your VPS. Monitor and control containers, images, volumes, and networks through a sleek, modern web UI.

![Login](https://img.shields.io/badge/Auth-Password_Gate-blue) ![Stack](https://img.shields.io/badge/Stack-React_+_Express-61dafb) ![Docker](https://img.shields.io/badge/Deploy-Docker_Compose-2496ed)

## Features

- **Dashboard** — Live stats for containers, images, volumes, networks + system info
- **Containers** — Start, stop, restart, remove, streaming logs, inspect details
- **Images** — List, pull with live progress, force remove
- **Volumes** — Create, list, delete
- **Networks** — Create, list, delete (protects default networks)
- **Auth** — Password-based login with JWT session tokens
- **Dark UI** — Glassmorphic dark theme with smooth animations

## Quick Start

### Docker Compose (Recommended)

```bash
# Clone the repo
git clone https://github.com/darkdeathoriginal/docsee.git
cd docsee

# Configure
cp .env.example .env
# Edit .env — set DOCSEE_PASSWORD and JWT_SECRET

# Deploy
docker compose up -d
```

Access at **http://your-server-ip:3001**

### Environment Variables

| Variable          | Description               | Default                 |
| ----------------- | ------------------------- | ----------------------- |
| `DOCSEE_PASSWORD` | Login password            | `changeme`              |
| `JWT_SECRET`      | Secret key for JWT tokens | `your-super-secret-key` |
| `PORT`            | Server port               | `3001`                  |

### Local Development

```bash
npm install
npm run dev        # Runs Vite (frontend) + Express (backend) concurrently
```

- Frontend: `http://localhost:5173` (proxies API to backend)
- Backend: `http://localhost:3001`

## Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | React + Vite                            |
| Styling  | Vanilla CSS (dark theme, glassmorphism) |
| Backend  | Express.js + Dockerode                  |
| Auth     | JWT (jsonwebtoken)                      |
| Deploy   | Docker + Docker Compose                 |

## Project Structure

```
docsee/
├── server/
│   ├── index.js                # Express entry point
│   ├── middleware/auth.js      # JWT verification
│   └── routes/
│       ├── auth.js             # Login endpoint
│       ├── containers.js       # Container CRUD + logs + stats
│       ├── images.js           # Image list, pull, remove
│       ├── volumes.js          # Volume CRUD
│       ├── networks.js         # Network CRUD
│       └── system.js           # Docker engine info
├── src/
│   ├── App.jsx                 # Router + auth state
│   ├── api.js                  # API client
│   ├── index.css               # Design system
│   ├── pages/                  # Dashboard, Containers, Images, etc.
│   └── components/             # Sidebar, StatCard, Modal, LogViewer
├── Dockerfile                  # Multi-stage production build
├── docker-compose.yml
└── .env.example
```

## API Endpoints

All endpoints (except auth) require `Authorization: Bearer <token>` header.

| Method   | Endpoint                                   | Description         |
| -------- | ------------------------------------------ | ------------------- |
| `POST`   | `/api/auth/login`                          | Login with password |
| `GET`    | `/api/containers`                          | List all containers |
| `POST`   | `/api/containers/:id/start\|stop\|restart` | Container actions   |
| `DELETE` | `/api/containers/:id`                      | Remove container    |
| `GET`    | `/api/containers/:id/logs`                 | Stream logs (SSE)   |
| `GET`    | `/api/containers/:id/stats`                | Stream stats (SSE)  |
| `GET`    | `/api/images`                              | List images         |
| `POST`   | `/api/images/pull`                         | Pull image          |
| `DELETE` | `/api/images/:id`                          | Remove image        |
| `GET`    | `/api/volumes`                             | List volumes        |
| `POST`   | `/api/volumes`                             | Create volume       |
| `DELETE` | `/api/volumes/:name`                       | Remove volume       |
| `GET`    | `/api/networks`                            | List networks       |
| `POST`   | `/api/networks`                            | Create network      |
| `DELETE` | `/api/networks/:id`                        | Remove network      |
| `GET`    | `/api/system/info`                         | Docker engine info  |
| `GET`    | `/api/system/df`                           | Disk usage          |

## License

MIT
