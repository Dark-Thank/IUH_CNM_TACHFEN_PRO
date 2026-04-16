# Fix Realtime Pin/Recall Messages - TODO

**Progress:**
- [x] 1. Phân tích project và xác định nguyên nhân (direct mutation không trigger re-render).
- [x] 2. Tạo TODO.md với các bước plan.
- [x] 3. Đọc useSocketStore.ts và confirm content.
- [x] 4. Edit useSocketStore.ts lần 1: Thêm "update-message" handler.
- [x] 5. Edit useSocketStore.ts lần 2: Fix tất cả handlers dùng setState() immutable để trigger UI re-render realtime.

**Progress (updated):**
- [x] 1. Phân tích project và xác định nguyên nhân (direct mutation không trigger re-render).
- [x] 2. Tạo TODO.md với các bước plan.
- [x] 3. Đọc useSocketStore.ts và confirm content.
- [x] 4. Edit useSocketStore.ts lần 1: Thêm "update-message" handler.
- [x] 5. Edit useSocketStore.ts lần 2: Fix tất cả handlers dùng setState() immutable để trigger UI re-render realtime.
- [x] 6. Feedback: Cải thiện confirm dialog thu hồi tin nhắn từ "Thu hồi tin nhắn này?" → "Bạn có chắc muốn thu hồi tin nhắn này không?".

**Next: Test realtime!**
1. `cd backend && npm start`
2. `cd frontend && npm run dev`
3. 2 tabs browser cùng conversation → ghim/thu hồi → check realtime.

**Hoàn thành khi test OK!**

