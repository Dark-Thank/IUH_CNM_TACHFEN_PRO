🚀 Hướng dẫn chạy chương trình
---🖥️ Backend---
# 1. Thêm file .env vào thư mục BE

# 2. Cài dependencies
npm install

# 3. Chạy server
npm run dev

🔐 Lưu ý:
Nếu cần tạo ACCESS_TOKEN_SECRET, chạy lệnh sau:

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
---🌐 Frontend---
# 1. Cài dependencies
npm install

# 2. Chạy project
npm run dev
📱 Mobile (Expo)
# 1. Cài dependencies
npm install

# 2. Chạy ứng dụng
npx expo start

🌍 Cấu hình để gọi được khác mạng
Backend cần được public ra cùng một địa chỉ chung cho tất cả client. Nếu mỗi máy chạy frontend/mobile tự trỏ về backend cục bộ của chính máy đó thì chỉ nhắn/gọi trong cùng mạng hoặc cùng máy mới hoạt động đúng.

Biến môi trường backend nên có:
PUBLIC_API_URL=https://your-public-domain/api
PUBLIC_SOCKET_URL=https://your-public-domain
CLIENT_URL=https://your-web-domain,http://localhost:5173

Biến môi trường frontend nên có:
VITE_API_URL=https://your-public-domain/api
VITE_SOCKET_URL=https://your-public-domain

Biến môi trường mobile nên có:
EXPO_PUBLIC_API_URL=https://your-public-domain/api
EXPO_PUBLIC_SOCKET_URL=https://your-public-domain

Để WebRTC hoạt động ổn định khi hai thiết bị khác mạng, cần TURN server công khai. Có thể cấu hình trực tiếp bằng các biến sau:
WEBRTC_TURN_URLS=turn:your-turn-server:3478,turns:your-turn-server:5349?transport=tcp
WEBRTC_TURN_USERNAME=your-username
WEBRTC_TURN_CREDENTIAL=your-password

Frontend web cũng hỗ trợ đọc cấu hình TURN/STUN từ:
VITE_WEBRTC_TURN_URLS
VITE_WEBRTC_TURN_USERNAME
VITE_WEBRTC_TURN_CREDENTIAL
VITE_WEBRTC_STUN_URLS

Mobile networking hiện cũng ưu tiên EXPO_PUBLIC_API_URL và EXPO_PUBLIC_SOCKET_URL để mọi thiết bị cùng nói chuyện với một backend chung.
