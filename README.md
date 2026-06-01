# IUH CNM TachFen Pro

## Maintainability

Repository được tách theo 3 lớp rõ ràng:

- `backend/`: Express API, Socket.IO, MongoDB, Redis.
- `frontend/`: React + Vite cho web client.
- `MobileApp/`: Expo/React Native cho mobile client.

Các điểm hỗ trợ bảo trì đã được chuẩn hóa:

- File ví dụ môi trường: `backend/.env.example`, `frontend/.env.example`.
- Script kiểm tra backend: `npm run check:syntax` trong `backend/`.
- Frontend có sẵn `lint` và `build` để dùng trong CI.
- Docker tách riêng theo service, tránh phụ thuộc cài đặt máy cá nhân.

## Chạy Local

### Backend

1. Tạo file `.env` từ `backend/.env.example`.
2. Cài dependencies:

```bash
cd backend
npm install
```

3. Chạy server:

```bash
npm run dev
```

Tạo `ACCESS_TOKEN_SECRET` nhanh bằng:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend

1. Tạo file `.env` từ `frontend/.env.example` nếu chạy ngoài Docker.
2. Cài dependencies và chạy:

```bash
cd frontend
npm install
npm run dev
```

### MobileApp

```bash
cd MobileApp
npm install
npx expo start
```

## Chạy Bằng Docker Compose

Stack Docker gồm 4 service: `frontend`, `backend`, `mongo`, `redis`.

```bash
docker compose up --build -d
```

Sau khi chạy:

- Web app: `http://localhost:8080`
- Backend health: `http://localhost:5001/api/health`
- Swagger: `http://localhost:8080/api-docs`

Lưu ý:

- MobileApp không nằm trong Docker Compose; mobile dùng chung backend đang chạy từ stack này qua `EXPO_PUBLIC_API_URL` và `EXPO_PUBLIC_SOCKET_URL`.
- Cấu hình compose đang dùng giá trị demo an toàn cho môi trường báo cáo. Với production, thay `ACCESS_TOKEN_SECRET`, Cloudinary, SMTP và TURN server bằng giá trị thật.

## CI/CD

Workflow GitHub Actions nằm tại `.github/workflows/ci-cd.yml`.

Pipeline hiện tại tự động:

- Cài dependency và kiểm tra cú pháp backend.
- Lint và build frontend.
- Validate `docker compose` và build Docker images.
- Khi push lên nhánh `main`, tự động publish 2 image lên GitHub Container Registry (`ghcr.io`).

## Cấu Hình Khác Mạng

Khi triển khai ra domain công khai, cần cấu hình các biến sau để web/mobile cùng nói chuyện với một backend chung:

- Backend: `PUBLIC_API_URL`, `PUBLIC_SOCKET_URL`, `CLIENT_URL`
- Frontend: `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_PUBLIC_ORIGIN`
- Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`

Để WebRTC ổn định khi khác mạng, nên khai báo TURN server:

- Backend: `WEBRTC_TURN_URLS`, `WEBRTC_TURN_USERNAME`, `WEBRTC_TURN_CREDENTIAL`
- Frontend: `VITE_WEBRTC_TURN_URLS`, `VITE_WEBRTC_TURN_USERNAME`, `VITE_WEBRTC_TURN_CREDENTIAL`
