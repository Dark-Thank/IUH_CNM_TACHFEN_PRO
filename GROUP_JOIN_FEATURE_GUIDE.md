# Chức năng Tham gia Nhóm Chat qua Link/QR - Hướng dẫn Sử dụng

## 📋 Tổng Quan

Chức năng này cho phép người dùng tham gia nhóm chat thông qua:
1. **Link mời** - Chia sẻ đường link trực tiếp
2. **Mã QR** - Quét mã QR bằng camera
3. **Token** - Nhập mã token trực tiếp

## 🎯 Các Tính Năng Đã Triển Khai

### 1. **Chia Sẻ Link Nhóm** (ShareGroupLinkModal)
- **Vị trí**: Chat window header (khi chọn nhóm chat)
- **Button**: Icon link ở góc phải header
- **Chức năng**:
  - Tạo link mời duy nhất cho nhóm (có hiệu lực 30 ngày)
  - Hiển thị QR code của link mời
  - Sao chép link vào clipboard
  - Chia sẻ link (via web share API hoặc fallback copy)
  - Tải xuống mã QR dưới dạng hình ảnh

**File**: `frontend/src/components/chat/ShareGroupLinkModal.tsx`

### 2. **Tham Gia Nhóm** (JoinGroupModal)
- **Vị trí**: Sidebar trong mục "NHÓM CHAT" 
- **Button**: Icon entry (+) bên cạnh nút tạo nhóm
- **Chức năng**:
  - Tab "Link/Mã": Nhập token hoặc dán link
  - Tab "Camera": Quét QR code bằng camera
  - Dán từ clipboard (tự động trích xuất token từ URL)
  - Xử lý lỗi (link hết hạn, đã là thành viên, etc.)

**File**: `frontend/src/components/chat/JoinGroupModal.tsx`

### 3. **Cập Nhật Backend**
Đã xác nhận backend có các API endpoint:
- `POST /conversations/:conversationId/generate-invite` - Tạo link mời
- `POST /conversations/join-by-token` - Tham gia nhóm bằng token
- Model `Conversation` hỗ trợ `invitationToken` và `invitationExpiry`

### 4. **Cập Nhật Frontend Service**
Thêm hai method vào `chatService`:
```typescript
async generateInvitationLink(conversationId: string)
async joinGroupByToken(token: string)
```

## 🚀 Cách Sử Dụng

### Người Tạo Nhóm - Chia Sẻ Link

1. Mở nhóm chat trong app
2. Nhấn vào icon link **🔗** ở góc phải header
3. Modal sẽ hiển thị:
   - Tên nhóm
   - Mã QR
   - Link mời
4. Chọn một trong ba tùy chọn:
   - **"Sao chép link"** - Copy link vào clipboard
   - **"Chia sẻ link"** - Chia sẻ qua hệ thống share (nếu hỗ trợ)
   - **"Lưu mã QR"** - Tải mã QR xuống máy

### Người Muốn Tham Gia - Nhập Token

1. Mở sidebar
2. Nhấn vào icon **➕** trong mục "NHÓM CHAT"
3. Modal "Tham gia nhóm chat" mở ra
4. Chọn tab "Link/Mã"
5. Dán link hoặc token vào input (hoặc nhấn icon copy để dán từ clipboard)
6. Nhấn "Tham gia nhóm"

### Người Muốn Tham Gia - Quét QR

1. Mở sidebar
2. Nhấn vào icon **➕** trong mục "NHÓM CHAT"
3. Chọn tab "Camera"
4. Nhấn "Mở Camera"
5. Quét mã QR từ nhóm
6. ⚠️ **Lưu ý**: Quét QR đầy đủ cần cài thư viện `html5-qrcode` (xem phần Nâng Cao)

## 📦 Dependencies

### Đã Cài Đặt
- `qrcode.react` - Tạo QR code

### Cần Cài Đặt (Optional)
- `html5-qrcode` - Quét QR code bằng camera (cho tính năng quét QR đầy đủ)

```bash
npm install html5-qrcode
```

## 🔧 Các File Được Thay Đổi

```
frontend/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindowHeader.tsx (✏️ Updated)
│   │   │   ├── ShareGroupLinkModal.tsx (✨ New)
│   │   │   ├── JoinGroupModal.tsx (✨ New)
│   │   ├── sidebar/
│   │   │   └── app-sidebar.tsx (✏️ Updated)
│   └── services/
│       └── chatServiec.ts (✏️ Updated)
├── package.json (✏️ Updated with qrcode.react)
```

## 🎨 UI/UX Improvements

### ShareGroupLinkModal
- Thiết kế tương tự Zalo (từ ảnh mockup)
- Hiển thị thông tin nhóm
- QR code 200x200px
- 3 button hành động dễ dàng tiếp cận
- Thông tin hết hạn link

### JoinGroupModal
- Giao diện 2 tab: "Link/Mã" và "Camera"
- Clipboard paste tự động
- Camera preview với hướng dẫn
- Xử lý lỗi thân thiện

## 📱 Tích Hợp Mobile

### MobileApp
Chức năng này cũng hoạt động trên mobile:
- ✅ Chia sẻ link (share API hoặc copy)
- ✅ Quét QR (camera access)
- ✅ Dán từ clipboard

## ⚠️ Các Lưu Ý

1. **Link hết hạn**: Link mời có hiệu lực 30 ngày. Sau đó, người tạo nhóm phải tạo link mới.

2. **Quyền tạo link**: Chỉ người tạo nhóm mới có thể tạo link mời.

3. **Quét QR**: Hiện tại, tab Camera chỉ mở camera và hiển thị preview. Để quét QR đầy đủ, cần:
   - Cài `html5-qrcode`: `npm install html5-qrcode`
   - Cập nhật `JoinGroupModal.tsx` để sử dụng thư viện

4. **Browser Compatibility**:
   - Quét QR: Cần hỗ trợ `navigator.mediaDevices.getUserMedia()`
   - Share: Hỗ trợ `navigator.share()` (not all browsers)

## 🔐 Bảo Mật

- Token mời là 36 ký tự ngẫu nhiên hex (từ `crypto.randomBytes(18).toString('hex')`)
- Link mời chỉ hoạt động khi chưa hết hạn
- Không thể tham gia nhóm nếu đã là thành viên
- Token không lưu trữ ở client, chỉ gửi qua API khi cần thiết

## 🚨 Troubleshooting

### Build Error: "Module has no default export"
**Giải pháp**: Sử dụng `{ QRCodeSVG as QRCode }` khi import

### Không thể tham gia nhóm
- Kiểm tra token/link còn hiệu lực (30 ngày)
- Kiểm tra xem bạn đã là thành viên chưa
- Kiểm tra kết nối mạng

### Camera không hoạt động
- Cần bật quyền camera cho trình duyệt
- Chỉ hoạt động trên HTTPS (trừ localhost)
- Cần thư viện `html5-qrcode` cho quét tự động

## 🔄 Flow Diagram

```
Người Tạo Nhóm:
┌─────────────────┐
│ Mở Nhóm Chat    │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────┐
│ Nhấn Icon Link 🔗 Header    │
└────────┬────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│ ShareGroupLinkModal Mở       │
│ - Generate/Fetch Link+QR     │
└────────┬─────────────────────┘
         │
         ├─→ Sao chép ─→ Clipboard
         ├─→ Chia sẻ  ─→ Share API
         └─→ Lưu QR   ─→ File Download

Người Muốn Tham Gia:
┌──────────────────────────┐
│ Nhấn ➕ Sidebar (NHÓM)   │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────────┐
│ JoinGroupModal Mở            │
└────────┬─────────────────────┘
         │
         ├─→ Tab "Link/Mã"  ─→ Nhập Token ─→ Tham gia
         │
         └─→ Tab "Camera"   ─→ Quét QR   ─→ Tham gia
```

## 📝 Ghi Chú Phát Triển

### Để Hoàn Thành Tính Năng Quét QR:

```bash
# 1. Cài đặt thư viện
npm install html5-qrcode

# 2. Cập nhật JoinGroupModal.tsx
import { Html5QrcodeScanner } from "html5-qrcode";

# 3. Trong captureFrame function:
const html5QrcodeScanner = new Html5QrcodeScanner(
  "qr-reader",
  { fps: 10, qrbox: 250 },
  false
);

html5QrcodeScanner.render(
  (decodedText) => {
    // Trích xuất token từ decodedText (URL)
    const token = decodedText.split('/').pop();
    setToken(token);
  },
  (error) => {
    console.error(error);
  }
);
```

---

**Trạng thái**: ✅ Triển khai cơ bản hoàn tất
**Cần nâng cấp**: Quét QR tự động với `html5-qrcode`
**Đã kiểm tra**: Frontend components, Backend API, TypeScript types
