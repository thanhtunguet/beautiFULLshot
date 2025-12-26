# Brainstorm: Ứng Dụng Làm Đẹp Screenshot Đa Nền Tảng

**Ngày**: 2025-12-26
**Bối cảnh**: Xây dựng app làm đẹp screenshot tương tự Winshot cho Windows, macOS, Linux
**Ràng buộc**: Dev solo, timeline nhanh, đầy đủ tính năng, tất cả công cụ annotation

---

## Mô Tả Vấn Đề

Xây dựng ứng dụng làm đẹp screenshot đa nền tảng tương tự [Winshot](https://github.com/mrgoonie/winshot) với các tính năng:
- Chụp screenshot (toàn màn hình, vùng chọn, cửa sổ)
- Công cụ annotation phong phú (hình dạng, mũi tên, text, số, spotlight)
- Tính năng làm đẹp (background gradient, cắt ảnh)
- Xuất nhiều định dạng (PNG, JPEG với điều chỉnh chất lượng)
- Tích hợp native với OS (system tray, global hotkeys, notifications)

---

## Phân Tích Kiến Trúc Winshot

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | Wails v2.10.2 (Go + Web) |
| Backend | Go 1.24.0 |
| Frontend | React 18 + TypeScript + Vite |
| Canvas | react-konva 18.2.10 |
| Styling | Tailwind CSS |
| Screenshot | kbinani/screenshot (Go, chỉ Windows) |

**Insight quan trọng**: Frontend của Winshot (React + Konva) đã cross-platform sẵn. Thách thức nằm ở **backend** - thư viện screenshot Go và Win32 API calls.

---

## Các Phương Án Đã Đánh Giá

### Phương án 1: Tauri v2 + React/Konva (✅ Khuyến nghị)

**Kiến trúc**:
- Backend: Rust + Tauri v2
- Frontend: Port code React + Konva từ Winshot (80% tái sử dụng)
- Screenshot: Thư viện Rust [xcap](https://github.com/nashaofu/xcap) (Linux/macOS/Windows)
- Hotkeys: [tauri-plugin-global-shortcut](https://v2.tauri.app/plugin/global-shortcut/)
- Tray: [System tray support](https://v2.tauri.app/learn/system-tray/) tích hợp sẵn

**Ưu điểm**:
- Kích thước bundle nhỏ nhất (~2-10MB so với 100MB+ của Electron)
- Hiệu năng tốt nhất (Rust backend native, RAM thấp)
- Thư viện xcap đã proven cho screenshot đa nền tảng
- Tauri v2 có plugin tray/hotkey mature
- Code frontend React/Konva 80% portable từ Winshot
- Model bảo mật mạnh mặc định

**Nhược điểm**:
- Cần học Rust cơ bản cho native integrations
- Một số quirks nền tảng (khác biệt WebView giữa OS)
- [Bug multi-monitor window placement](https://github.com/tauri-apps/tauri/issues/14019) đã báo cáo
- Thời gian compile đầu tiên lâu hơn

**Đánh giá rủi ro**: Trung bình - Learning curve Rust tồn tại nhưng plugins có docs tốt giảm code native cần viết.

---

### Phương án 2: Wails v3 + Go

**Kiến trúc**:
- Backend: Go + Wails v3 (alpha)
- Frontend: Port code React + Konva từ Winshot
- Screenshot: Custom Go bindings hoặc shell out tới platform tools
- Hotkeys: Wails v3 global shortcuts (đang phát triển)

**Ưu điểm**:
- Go dễ học hơn Rust
- Gần với kiến trúc gốc của Winshot
- Kích thước bundle khá tốt (~8-15MB)
- Community active

**Nhược điểm**:
- Wails v3 vẫn đang alpha (không ổn định)
- Wails v2 thiếu global hotkey support đúng nghĩa
- System tray support chưa hoàn chỉnh trong v2
- Không có thư viện screenshot cross-platform mature cho Go
- Cross-compile macOS yêu cầu máy Mac

**Đánh giá rủi ro**: CAO - v3 chưa stable, v2 thiếu tính năng quan trọng cho feature parity.

---

### Phương án 3: Electron + React/Konva

**Kiến trúc**:
- Backend: Node.js + Electron
- Frontend: Port code React + Konva từ Winshot (90% tái sử dụng)
- Screenshot: Electron desktopCapturer API (built-in)
- Hotkeys: globalShortcut module (built-in)
- Tray: Built-in Tray API

**Ưu điểm**:
- Thời gian phát triển nhanh nhất
- Tất cả tính năng built-in (tray, hotkeys, screenshot)
- Tech stack quen thuộc nhất (pure JavaScript)
- Ecosystem/community lớn nhất
- Không cần học Rust/Go

**Nhược điểm**:
- Kích thước bundle lớn (100-150MB)
- RAM sử dụng cao (~200-300MB)
- Bị người dùng coi là "bloated"
- Lo ngại bảo mật (full Node.js access)

**Đánh giá rủi ro**: Rủi ro kỹ thuật thấp, rủi ro UX/nhận thức cao do kích thước.

---

## Khuyến Nghị: Tauri v2

Với ràng buộc của bạn (solo, nhanh, feature parity), **Tauri v2** cung cấp balance tốt nhất:

1. **Frontend portable**: Code React + Konva từ Winshot hoạt động trong Tauri với ít thay đổi
2. **xcap giải quyết screenshot**: Thư viện Rust proven xử lý Windows/macOS/Linux
3. **Plugins giảm code Rust**: Hotkey/tray plugins là drop-in
4. **Bundle nhỏ gây ấn tượng**: App 5-10MB vs 100MB+ alternatives
5. **Ecosystem đang phát triển**: Active development, docs tốt

### Rust Cần Viết Tối Thiểu

Bạn chỉ cần Rust cho:
- Kết nối xcap screenshot captures
- Custom window detection nếu cần
- ~100-200 dòng code Rust tổng cộng

Mọi thứ khác (UI, annotations, export) vẫn ở TypeScript/React.

---

## Các Cân Nhắc Khi Triển Khai

### Thách Thức Đa Nền Tảng

| Tính năng | Windows | macOS | Linux |
|-----------|---------|-------|-------|
| Screenshot | xcap ✓ | xcap ✓ | xcap (X11/Wayland) ✓ |
| Hotkeys | Tauri plugin ✓ | Tauri plugin ✓ | Tauri plugin ✓ |
| System Tray | Native ✓ | Template icons ✓ | Tùy theo DE |
| Notifications | Native ✓ | Native ✓ | libnotify |
| Auto-start | Registry | LaunchAgents | XDG autostart |

### Các Vấn Đề Cần Giải Quyết

1. **macOS permissions**: Cần quyền screen recording cho screenshots
2. **Linux Wayland**: Một số tính năng có thể hoạt động khác X11
3. **Multi-monitor**: Test kỹ - có issues được báo cáo trong Tauri
4. **Khác biệt WebView**: Safari (macOS) vs WebView2 (Windows) vs WebKitGTK (Linux)

### Khả Năng Port Frontend từ Winshot

| Thành phần | Khả năng port |
|------------|---------------|
| React + TypeScript | 100% |
| react-konva canvas | 100% |
| Tailwind CSS | 100% |
| Annotation tools | 100% |
| Export logic | 100% |
| Backend calls | Cần rewiring sang Tauri IPC |
| Go-specific code | Thay bằng Rust/Tauri |

---

## Chỉ Số Thành Công

1. **Kích thước bundle**: Mục tiêu < 15MB installer
2. **Thời gian khởi động**: < 1 giây cold start
3. **RAM sử dụng**: < 100MB idle
4. **Feature parity**: Tất cả annotation tools của Winshot hoạt động
5. **Hỗ trợ nền tảng**: Windows 10+, macOS 11+, Ubuntu 22.04+

---

## Các Bước Tiếp Theo

1. **Giai đoạn prototype**: Tạo app Tauri v2 tối thiểu với xcap screenshot
2. **Port frontend**: Copy code React/Konva từ Winshot, adapt IPC calls
3. **Native integration**: Thêm tray, hotkeys, notifications
4. **Polish**: Test và fix theo từng nền tảng
5. **Distribution**: Build installers cho mỗi nền tảng

---

## Câu Hỏi Chưa Giải Quyết

1. Bạn đã có tên project chưa? ("BeautyShot" theo tên thư mục?)
2. App có cần hoạt động không cần quyền admin/root?
3. Có Linux distro nào cần ưu tiên ngoài Ubuntu?
4. Cloud sync hay ứng dụng hoàn toàn local?
5. Có phân phối qua app stores (MS Store, Mac App Store)?

---

## Bảng So Sánh Tổng Hợp

| Tiêu chí | Tauri v2 | Wails v3 | Electron |
|----------|----------|----------|----------|
| **Kích thước** | ~5-10MB | ~8-15MB | ~100-150MB |
| **RAM** | ~50-80MB | ~60-100MB | ~200-300MB |
| **Tính năng đầy đủ** | ✅ Có plugins | ❌ Thiếu hotkey/tray | ✅ Built-in |
| **Tốc độ dev** | Trung bình | Nhanh nhưng unstable | Nhanh nhất |
| **Ngôn ngữ backend** | Rust (cần học) | Go (dễ học) | JS (quen thuộc) |
| **Độ stable** | ✅ v2 stable | ❌ v3 alpha | ✅ Mature |
| **Screenshot lib** | xcap ✅ | Không có mature | Built-in ✅ |
| **Bảo mật** | Cao | Trung bình | Thấp |
| **Rủi ro tổng thể** | Trung bình | Cao | Thấp kỹ thuật, cao UX |

---

## Kết Luận

**Tauri v2 là lựa chọn tối ưu** cho dự án này vì:

1. **Balance tốt nhất** giữa kích thước, hiệu năng, và thời gian dev
2. **Learning curve chấp nhận được** - chỉ ~100-200 dòng Rust, còn lại TypeScript
3. **Ecosystem đang phát triển mạnh** - v2 stable, docs tốt, community active
4. **80% frontend từ Winshot tái sử dụng** - chỉ cần rewire IPC calls
5. **Ấn tượng với người dùng** - app 5-10MB vs 100MB+ competitors

---

## Nguồn Tham Khảo

- [Winshot GitHub](https://github.com/mrgoonie/winshot)
- [Tauri v2 Documentation](https://v2.tauri.app/)
- [xcap - Cross-platform screenshot library](https://github.com/nashaofu/xcap)
- [Tauri Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/)
- [Tauri System Tray](https://v2.tauri.app/learn/system-tray/)
- [tauri-plugin-screenshots](https://github.com/ayangweb/tauri-plugin-screenshots)
- [Tauri vs Electron Comparison](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
- [Wails vs Tauri Discussion](https://dev.to/arashgl/taurirust-vs-wailsgo-4pd6)
- [react-konva](https://github.com/konvajs/react-konva)
