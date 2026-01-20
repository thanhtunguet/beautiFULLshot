# Báo Cáo Nghiên Cứu: React-Konva Canvas & Annotation Tools

**Ngày:** 26/12/2025 | **Phạm vi:** React-Konva setup, annotation tools, image manipulation, export

---

## Tóm Tắt Điều Hành

React-Konva là declarative binding cho Konva.js, cho phép xây dựng canvas graphics phức tạp bằng React. **Khuyến nghị:** Dùng `react-konva@18.x` cho React 18 (phiên bản 19.x chỉ support React 19+). Hỗ trợ đầy đủ TypeScript, React Context (fixed từ v18.2.2), và SSR friendly với dynamic imports. Performance tốt với batchdraw(), layer management, và caching.

---

## 1. React-Konva Setup & Integration

### React 18 + TypeScript
```bash
npm install react-konva@18 konva
```

**Cấu trúc cơ bản:**
```tsx
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';

export function CanvasEditor() {
  const stageRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  return (
    <Stage
      ref={stageRef}
      width={canvasSize.width}
      height={canvasSize.height}
      onWheel={handleZoom}
    >
      <Layer>
        <KonvaImage image={imgElement} x={0} y={0} />
        <Rect x={50} y={50} width={100} height={100} fill="blue" draggable />
        <Text text="Annotation" x={100} y={100} fontSize={16} />
      </Layer>
    </Stage>
  );
}
```

### Next.js Integration
Dùng dynamic imports với `ssr: false` để avoid server-side rendering issues:
```tsx
const CanvasEditor = dynamic(() => import('./CanvasEditor'), { ssr: false });
```

---

## 2. Annotation Tools Implementation

### Supported Shapes
- **Core:** Rect, Circle, Ellipse, Line, Star, RegularPolygon
- **Text:** Text, TextPath (curved text)
- **Advanced:** Label, SVG Path, Custom Shapes
- **Arrows:** Konva.Arrow (cảnh báo: Transformer support kém với arrows)

### Drawing Rectangle & Ellipse
```tsx
<Rect
  x={20} y={20}
  width={100} height={60}
  fill="rgba(0,0,255,0.3)"
  stroke="blue"
  strokeWidth={2}
  draggable
  onDragEnd={(e) => console.log(e.target.x())}
/>

<Ellipse
  x={150} y={150}
  radiusX={50} radiusY={30}
  fill="rgba(255,0,0,0.3)"
  stroke="red"
/>
```

### Text Annotations + Auto-increment Counter
```tsx
function TextAnnotation({ id, x, y, text, fontSize = 16, fontFamily = 'Arial' }) {
  return (
    <Text
      text={`${id}. ${text}`}
      x={x} y={y}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fill="black"
      draggable
      onTransformEnd={(e) => console.log('text moved')}
    />
  );
}

// Usage: auto-increment từ state
const [annotationCount, setAnnotationCount] = useState(0);
const addAnnotation = (x, y, text) => {
  setAnnotationCount(c => c + 1);
  // Create TextAnnotation với id = annotationCount
};
```

### Spotlight/Dimming Effect
Dùng clipping region + custom layer để tạo spotlight:
```tsx
<Layer clip={{ x: spotX, y: spotY, width: 200, height: 200 }} opacity={1}>
  <Image image={imgElement} />
</Layer>

// Hoặc dùng filter (Blur) + Layer Composition
<Layer filters={[Konva.Filters.Blur]} blurRadius={15}>
  <Image image={imgElement} opacity={0.5} />
</Layer>
```

---

## 3. Image Manipulation & Transformation

### Image Cropping (Non-destructive)
```tsx
<Image
  image={imgElement}
  x={0} y={0}
  crop={{ x: 20, y: 20, width: 300, height: 200 }}
  scaleX={1.2} scaleY={1.2}
  draggable
/>
```

### Aspect Ratio Lock + Transformer
```tsx
import { Transformer } from 'react-konva';

const ASPECT_RATIO = 16/9;

<Transformer
  ref={transformerRef}
  boundBoxFunc={(oldBox, newBox) => {
    // Lock aspect ratio
    if (newBox.width / newBox.height > ASPECT_RATIO) {
      newBox.height = newBox.width / ASPECT_RATIO;
    } else {
      newBox.width = newBox.height * ASPECT_RATIO;
    }
    return newBox;
  }}
/>
```

### Gradient Background
```tsx
const gradient = ctx => {
  const grd = ctx.createLinearGradient(0, 0, stage.width(), 0);
  grd.addColorStop(0, '#ff0000');
  grd.addColorStop(1, '#0000ff');
  return grd;
};

<Rect x={0} y={0} width={800} height={600} fill={gradient} />
```

---

## 4. Export Functionality

### Export to PNG/JPEG
```tsx
const exportImage = async (format = 'image/png', quality = 0.9) => {
  const dataURL = stageRef.current.toDataURL({
    mimeType: format,
    quality: quality,
    pixelRatio: window.devicePixelRatio || 1
  });

  // Download
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `screenshot-${Date.now()}.png`;
  link.click();
};
```

### High-DPI / Retina Support
```tsx
// Export với pixelRatio = 2 cho 2x resolution (retina)
const highQualityExport = () => {
  const dataURL = stageRef.current.toDataURL({
    pixelRatio: 2, // 500x500 stage → 1000x1000 export
    mimeType: 'image/png'
  });
};

// Canvas rendering: Konva tự handle nếu stage có pixelRatio property
<Stage pixelRatio={window.devicePixelRatio} width={800} height={600} />
```

---

## 5. Responsive Canvas & Performance

### Responsive Sizing
```tsx
useEffect(() => {
  const handleResize = () => {
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const scale = containerWidth / 1000; // Virtual scene width = 1000
    setCanvasSize({
      width: containerWidth,
      height: 600 * scale
    });
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Performance Optimizations

| Technique | Lợi ích | Cách dùng |
|-----------|---------|----------|
| **batchDraw()** | Giới hạn redraws/sec | `layer.batchDraw()` thay vì `draw()` |
| **Layer Listening** | Giảm event listeners | `layer.listening(false)` nếu layer không cần events |
| **Shape Caching** | Cache complex shapes | `shape.cache()` để convert thành bitmap |
| **Dedicated Layer** | Tối ưu drag performance | Move dragging shape sang layer riêng, drag xong move back |
| **Minimize Layers** | Mỗi layer = canvas element | Keep layers < 20 để avoid overhead |
| **Mobile Viewport** | Tránh scaling overhead | `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">` |

**Cảnh báo:** Transformers hỗ trợ tốt cho Rect, Circle, Text nhưng kém cho Arrows & Stars.

---

## 6. Chú Ý Quan Trọng

- **React Context:** Fixed từ v18.2.2, dùng version mới
- **TypeScript:** Full type support, definition file có sẵn
- **Arrows + Transformer:** Tránh combine, dùng bounding box alternative
- **Export Quality:** pixelRatio=2 cho retina, quality=0.8-1.0 cho JPEG
- **Canvas Clipping:** Hỗ trợ crop + clip kết hợp: crop → scale/rotate → clip

---

## Tài Liệu & Tham Khảo

**Official:**
- [React-Konva Docs](https://konvajs.org/docs/react/index.html)
- [Konva Shapes Guide](https://konvajs.org/docs/react/Shapes.html)
- [Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [High-Quality Export](https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html)
- [GitHub: react-konva](https://github.com/konvajs/react-konva)

**Community:**
- [LogRocket: Canvas Manipulation with React Konva](https://blog.logrocket.com/canvas-manipulation-react-konva/)
- [Medium: Annotation Tool with Konva](https://medium.com/htc-research-engineering-blog/konva-use-konva-to-create-annotation-tool-34409bfa822b)
- [Coding Buddy: Image Annotation App Tutorial](https://www.coding-buddy.com/post/how-to-draw-shapes-on-html-canvas-using-konvajs-creating-image-annotation-app/)

---

## Câu Hỏi Chưa Giải Quyết

1. Custom spotlight effect implementation chi tiết (blur + gradient combine)?
2. Benchmark: Performance với 100+ annotations on 4K image?
3. Undo/Redo mechanism best practices cho annotation history?
