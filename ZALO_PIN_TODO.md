# Zalo-style Pin Messages TODO

### 1. MessageItem [ ]
- Nút 3 chấm MoreVertical cạnh mỗi message
- DropdownMenu: "Ghim tin nhắn"
- Call togglePinMessage

### 2. ChatWindowBody [ ]
- PinnedSection đầu chat body
- List pinned messages (filter messages[isPinned])
- Click → scrollTo message gốc + highlight

### 3. Store [ ]
- pinnedMessages selector (computed)

### 4. UI Polish [ ]
- Pinned badge "📌 3 tin đã ghim"
- Smooth scroll animation

Next: MessageItem 3-dot menu.

