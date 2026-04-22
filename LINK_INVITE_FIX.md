# 🔧 Fix: Link Mời Nhóm Không Hoạt Động

## ❌ Vấn Đề Tìm Thấy

Link mời nhóm không hoạt động vì **backend endpoints chưa được triển khai**.

### Các vấn đề chi tiết:
1. ❌ Backend không có `generateInvitationLink` controller
2. ❌ Backend không có `joinGroupByToken` controller  
3. ❌ Routes chưa được đăng ký
4. ❌ Model `Conversation` chưa có fields `invitationToken` và `invitationExpiry`
5. ❌ Missing `FRONTEND_URL` environment variable
6. ❌ Route ordering issue (join-by-token phải trước :conversationId)

---

## ✅ Các Sửa Chữa Đã Thực Hiện

### 1. **Backend Controller** (`conversationController.js`)
Thêm 2 functions mới:

```javascript
export const generateInvitationLink = async (req, res) => {
  // Tạo token duy nhất 36 ký tự
  // Đặt hết hạn 30 ngày
  // Trả về URL mời
}

export const joinGroupByToken = async (req, res) => {
  // Kiểm tra token hợp lệ
  // Kiểm tra token còn hạn
  // Kiểm tra user chưa là thành viên
  // Thêm user vào nhóm
  // Phát sóng thông báo qua Socket.IO
}
```

### 2. **Backend Routes** (`conversationRoute.js`)
Đăng ký 2 routes mới:

```javascript
// IMPORTANT: join-by-token PHẢI TRƯỚC :conversationId routes
router.post('/join-by-token', joinGroupByToken);
router.post('/:conversationId/generate-invite', generateInvitationLink);
```

### 3. **Conversation Model** (`Conversation.js`)
Thêm 2 fields:

```javascript
invitationToken: {
    type: String,
    unique: true,
    sparse: true,
},
invitationExpiry: {
    type: Date,
    default: null,
},
```

### 4. **Environment Variable** (`.env`)
Thêm:
```
FRONTEND_URL=http://localhost:5173
```

### 5. **Import Missing**
Thêm import `crypto` vào controller:
```javascript
import crypto from "crypto";
```

---

## 🧪 Test Flow

### 1. Tạo Link Mời
```bash
POST /api/conversations/:conversationId/generate-invite
Header: Authorization: Bearer {token}
Response:
{
  "invitationUrl": "http://localhost:5173/join-group/a1b2c3d4e5f6...",
  "invitationToken": "a1b2c3d4e5f6...",
  "invitationExpiry": "2026-05-22T04:17:00.000Z",
  "message": "Tạo link mời thành công"
}
```

### 2. Tham Gia Nhóm
```bash
POST /api/conversations/join-by-token
Header: Authorization: Bearer {token}
Body: { "token": "a1b2c3d4e5f6..." }
Response:
{
  "message": "Tham gia nhóm thành công",
  "conversation": { ... }
}
```

---

## 🔒 Bảo Mật & Kiểm Tra

✅ Token tạo bằng `crypto.randomBytes(18).toString('hex')` - 36 ký tự ngẫu nhiên
✅ Token chỉ dùng được 30 ngày
✅ Không thể tham gia nếu đã là thành viên
✅ Chỉ người tạo nhóm mới có thể tạo link mời
✅ ProtectedRoute middleware đảm bảo authorization

---

## 📋 Files Đã Sửa

```
backend/
├── src/
│   ├── controllers/
│   │   └── conversationController.js ✏️ (thêm 2 functions)
│   ├── models/
│   │   └── Conversation.js ✏️ (thêm 2 fields)
│   ├── routes/
│   │   └── conversationRoute.js ✏️ (đăng ký 2 routes + fix order)
│   └── .env ✏️ (thêm FRONTEND_URL)
```

---

## 🚀 Tiếp Theo

1. **Restart backend server** để apply changes
2. **Test flow**:
   - Mở nhóm → Nhấn icon 🔗 → Copy link
   - Dán link ở "Tham gia nhóm" → Check kết quả
3. Nếu vẫn lỗi, check:
   - Browser console (F12)
   - Backend logs
   - Network tab (Request/Response)

---

## 💡 Ghi Chú

**Tại sao `join-by-token` phải trước `/:conversationId`?**
- Express Router khớp routes theo thứ tự từ trên xuống
- Nếu `/:conversationId` trước, nó sẽ match `/join-by-token` với `conversationId = "join-by-token"`
- Điều này gây lỗi vì backend tìm conversation với id là "join-by-token"

**Backend authentication:**
- Cả 2 routes đều được bảo vệ bởi `protectedRoute` middleware
- User phải authenticated (có JWT token) mới gọi được
- `generateInvitationLink` thêm check: chỉ creator mới tạo được link
