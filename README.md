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
