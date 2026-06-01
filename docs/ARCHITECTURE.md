# System Architecture

## Maintainability summary

The project is organized as three separate applications:

- `backend/`: Express API, Socket.IO, MongoDB access, and core business logic.
- `frontend/`: React + Vite web client.
- `MobileApp/`: Expo React Native mobile client.

This split keeps responsibilities clear and lets each runtime be built or deployed independently.

## Backend layout

- `src/controllers/`: request handlers and use-case flows.
- `src/models/`: Mongoose schemas and persistence layer.
- `src/middlewares/`: authentication, upload, and socket guards.
- `src/routes/`: HTTP route registration.
- `src/socket/`: realtime messaging and call signaling.
- `src/utils/`: shared helpers such as CORS, mail, and realtime config.

## Runtime topology

- `frontend` serves the web bundle through Nginx.
- `frontend` proxies `/api` and `/socket.io` traffic to `backend`.
- `backend` persists data in MongoDB.
- `backend` uses Redis for Socket.IO adapter when available and falls back to single-instance mode otherwise.
- `MobileApp` uses the same backend endpoints but remains outside Docker because Expo targets device runtimes.

## DevOps assets

- `docker-compose.yml`: one-command local stack for demo/report.
- `backend/Dockerfile` and `frontend/Dockerfile`: reproducible image builds.
- `.github/workflows/ci-cd.yml`: automated validation and image publishing.
- `.env.example` files: easier onboarding and safer environment setup.