// Wallpaper presets for background beautification
// Using curated collection of beautiful, royalty-free wallpapers from Unsplash
// All IDs verified working as of 2026-01-16

export interface WallpaperCategory {
  id: string;
  name: string;
  icon?: string;
}

export interface WallpaperPreset {
  id: string;
  name: string;
  categoryId: string;
  url: string;
  thumbnailUrl?: string;
  colors: string[];
}

export const WALLPAPER_CATEGORIES: WallpaperCategory[] = [
  { id: 'professional', name: 'Professional', icon: 'briefcase' },
  { id: 'nature', name: 'Nature', icon: 'leaf' },
  { id: 'abstract', name: 'Abstract', icon: 'shapes' },
  { id: 'minimal', name: 'Minimal', icon: 'square' },
];

// Helper for Unsplash URLs
const unsplash = (id: string, width = 1920) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  // ============ PROFESSIONAL (12) - Workspace, Office, Desk ============
  {
    id: 'prof-1',
    name: 'Modern Desk',
    categoryId: 'professional',
    url: unsplash('1497215728101-856f4ea42174'),
    thumbnailUrl: unsplash('1497215728101-856f4ea42174', 400),
    colors: ['#e0e0e0', '#ffffff'],
  },
  {
    id: 'prof-2',
    name: 'Clean Workspace',
    categoryId: 'professional',
    url: unsplash('1497366216548-37526070297c'),
    thumbnailUrl: unsplash('1497366216548-37526070297c', 400),
    colors: ['#f5f5f5', '#dddddd'],
  },
  {
    id: 'prof-3',
    name: 'Office Building',
    categoryId: 'professional',
    url: unsplash('1486406146926-c627a92ad1ab'),
    thumbnailUrl: unsplash('1486406146926-c627a92ad1ab', 400),
    colors: ['#ffffff', '#f0f0f0'],
  },
  {
    id: 'prof-4',
    name: 'MacBook Setup',
    categoryId: 'professional',
    url: unsplash('1519389950473-47ba0277781c'),
    thumbnailUrl: unsplash('1519389950473-47ba0277781c', 400),
    colors: ['#333333', '#444444'],
  },
  {
    id: 'prof-5',
    name: 'Writing Desk',
    categoryId: 'professional',
    url: unsplash('1455390582262-044cdead277a'),
    thumbnailUrl: unsplash('1455390582262-044cdead277a', 400),
    colors: ['#555555', '#222222'],
  },
  {
    id: 'prof-6',
    name: 'Coffee & Work',
    categoryId: 'professional',
    url: unsplash('1495474472287-4d71bcdd2085'),
    thumbnailUrl: unsplash('1495474472287-4d71bcdd2085', 400),
    colors: ['#3e2723', '#5d4037'],
  },
  {
    id: 'prof-7',
    name: 'Notebook',
    categoryId: 'professional',
    url: unsplash('1517842645767-c639042777db'),
    thumbnailUrl: unsplash('1517842645767-c639042777db', 400),
    colors: ['#f5f5f5', '#e0e0e0'],
  },
  {
    id: 'prof-8',
    name: 'Modern Office',
    categoryId: 'professional',
    url: unsplash('1497366811353-6870744d04b2'),
    thumbnailUrl: unsplash('1497366811353-6870744d04b2', 400),
    colors: ['#fafafa', '#eeeeee'],
  },
  {
    id: 'prof-9',
    name: 'Desk Setup',
    categoryId: 'professional',
    url: unsplash('1518455027359-f3f8164ba6bd'),
    thumbnailUrl: unsplash('1518455027359-f3f8164ba6bd', 400),
    colors: ['#2c2c2c', '#1a1a1a'],
  },
  {
    id: 'prof-10',
    name: 'Library',
    categoryId: 'professional',
    url: unsplash('1521587760476-6c12a4b040da'),
    thumbnailUrl: unsplash('1521587760476-6c12a4b040da', 400),
    colors: ['#8b4513', '#654321'],
  },
  {
    id: 'prof-11',
    name: 'Meeting Room',
    categoryId: 'professional',
    url: unsplash('1497215842964-222b430dc094'),
    thumbnailUrl: unsplash('1497215842964-222b430dc094', 400),
    colors: ['#f0f0f0', '#e0e0e0'],
  },
  {
    id: 'prof-12',
    name: 'Tech Workspace',
    categoryId: 'professional',
    url: unsplash('1498050108023-c5249f4df085'),
    thumbnailUrl: unsplash('1498050108023-c5249f4df085', 400),
    colors: ['#2d2d2d', '#1f1f1f'],
  },

  // ============ NATURE (12) - Landscapes, Mountains, Ocean ============
  {
    id: 'nature-1',
    name: 'Misty Mountains',
    categoryId: 'nature',
    url: unsplash('1472214103451-9374bd1c798e'),
    thumbnailUrl: unsplash('1472214103451-9374bd1c798e', 400),
    colors: ['#6b7b8c', '#a0aab5'],
  },
  {
    id: 'nature-2',
    name: 'Deep Forest',
    categoryId: 'nature',
    url: unsplash('1441974231531-c6227db76b6e'),
    thumbnailUrl: unsplash('1441974231531-c6227db76b6e', 400),
    colors: ['#1e2f23', '#2d4435'],
  },
  {
    id: 'nature-3',
    name: 'Ocean Beach',
    categoryId: 'nature',
    url: unsplash('1507525428034-b723cf961d3e'),
    thumbnailUrl: unsplash('1507525428034-b723cf961d3e', 400),
    colors: ['#006994', '#009dc4'],
  },
  {
    id: 'nature-4',
    name: 'Golden Desert',
    categoryId: 'nature',
    url: unsplash('1473580044384-7ba9967e16a0'),
    thumbnailUrl: unsplash('1473580044384-7ba9967e16a0', 400),
    colors: ['#c2b280', '#e6d8ad'],
  },
  {
    id: 'nature-5',
    name: 'Blue Sky',
    categoryId: 'nature',
    url: unsplash('1513002749550-c59d786b8e6c'),
    thumbnailUrl: unsplash('1513002749550-c59d786b8e6c', 400),
    colors: ['#87CEEB', '#E0F4FF'],
  },
  {
    id: 'nature-6',
    name: 'Lake Reflection',
    categoryId: 'nature',
    url: unsplash('1439066615861-d1af74d74000'),
    thumbnailUrl: unsplash('1439066615861-d1af74d74000', 400),
    colors: ['#2c5364', '#203a43'],
  },
  {
    id: 'nature-7',
    name: 'Autumn Forest',
    categoryId: 'nature',
    url: unsplash('1508193638397-1c4234db14d8'),
    thumbnailUrl: unsplash('1508193638397-1c4234db14d8', 400),
    colors: ['#ff6b35', '#f7931e'],
  },
  {
    id: 'nature-8',
    name: 'Waterfall',
    categoryId: 'nature',
    url: unsplash('1432405972618-c60b0225b8f9'),
    thumbnailUrl: unsplash('1432405972618-c60b0225b8f9', 400),
    colors: ['#1e3a5f', '#3d6b99'],
  },
  {
    id: 'nature-9',
    name: 'Mountain Peak',
    categoryId: 'nature',
    url: unsplash('1464822759023-fed622ff2c3b'),
    thumbnailUrl: unsplash('1464822759023-fed622ff2c3b', 400),
    colors: ['#4a5568', '#2d3748'],
  },
  {
    id: 'nature-10',
    name: 'Green Valley',
    categoryId: 'nature',
    url: unsplash('1501854140801-50d01698950b'),
    thumbnailUrl: unsplash('1501854140801-50d01698950b', 400),
    colors: ['#228b22', '#006400'],
  },
  {
    id: 'nature-11',
    name: 'Sunset',
    categoryId: 'nature',
    url: unsplash('1495616811223-4d98c6e9c869'),
    thumbnailUrl: unsplash('1495616811223-4d98c6e9c869', 400),
    colors: ['#ff7e5f', '#feb47b'],
  },
  {
    id: 'nature-12',
    name: 'Northern Lights',
    categoryId: 'nature',
    url: unsplash('1531366936337-7c912a4589a7'),
    thumbnailUrl: unsplash('1531366936337-7c912a4589a7', 400),
    colors: ['#00d4aa', '#7b68ee'],
  },

  // ============ ABSTRACT (12) - Colorful, Artistic, Patterns ============
  {
    id: 'abstract-1',
    name: 'Fluid Art',
    categoryId: 'abstract',
    url: unsplash('1550684848-fac1c5b4e853'),
    thumbnailUrl: unsplash('1550684848-fac1c5b4e853', 400),
    colors: ['#ff6b6b', '#feca57'],
  },
  {
    id: 'abstract-2',
    name: 'Color Splash',
    categoryId: 'abstract',
    url: unsplash('1541701494587-cb58502866ab'),
    thumbnailUrl: unsplash('1541701494587-cb58502866ab', 400),
    colors: ['#ff0000', '#00ff00', '#0000ff'],
  },
  {
    id: 'abstract-3',
    name: 'Dark Clouds',
    categoryId: 'abstract',
    url: unsplash('1478760329108-5c3ed9d495a0'),
    thumbnailUrl: unsplash('1478760329108-5c3ed9d495a0', 400),
    colors: ['#1a1a2e', '#16213e'],
  },
  {
    id: 'abstract-4',
    name: 'Neon Gradient',
    categoryId: 'abstract',
    url: unsplash('1579546929662-711aa81148cf'),
    thumbnailUrl: unsplash('1579546929662-711aa81148cf', 400),
    colors: ['#667eea', '#764ba2'],
  },
  {
    id: 'abstract-5',
    name: 'Colorful Waves',
    categoryId: 'abstract',
    url: unsplash('1620641788421-7a1c342ea42e'),
    thumbnailUrl: unsplash('1620641788421-7a1c342ea42e', 400),
    colors: ['#fc466b', '#3f5efb'],
  },
  {
    id: 'abstract-6',
    name: 'Gradient Mesh',
    categoryId: 'abstract',
    url: unsplash('1618005182384-a83a8bd57fbe'),
    thumbnailUrl: unsplash('1618005182384-a83a8bd57fbe', 400),
    colors: ['#a8edea', '#fed6e3'],
  },
  {
    id: 'abstract-7',
    name: 'Ink Drops',
    categoryId: 'abstract',
    url: unsplash('1553356084-58ef4a67b2a7'),
    thumbnailUrl: unsplash('1553356084-58ef4a67b2a7', 400),
    colors: ['#e8e8e8', '#c0c0c0'],
  },
  {
    id: 'abstract-8',
    name: 'Purple Smoke',
    categoryId: 'abstract',
    url: unsplash('1557672172-298e090bd0f1'),
    thumbnailUrl: unsplash('1557672172-298e090bd0f1', 400),
    colors: ['#9b59b6', '#8e44ad'],
  },
  {
    id: 'abstract-9',
    name: 'Geometric',
    categoryId: 'abstract',
    url: unsplash('1558591710-4b4a1ae0f04d'),
    thumbnailUrl: unsplash('1558591710-4b4a1ae0f04d', 400),
    colors: ['#2193b0', '#6dd5ed'],
  },
  {
    id: 'abstract-10',
    name: 'Light Leaks',
    categoryId: 'abstract',
    url: unsplash('1557682224-5b8590cd9ec5'),
    thumbnailUrl: unsplash('1557682224-5b8590cd9ec5', 400),
    colors: ['#ff9a9e', '#fad0c4'],
  },
  {
    id: 'abstract-11',
    name: 'Bokeh Lights',
    categoryId: 'abstract',
    url: unsplash('1519751138087-5bf79df62d5b'),
    thumbnailUrl: unsplash('1519751138087-5bf79df62d5b', 400),
    colors: ['#ffd700', '#ff8c00'],
  },
  {
    id: 'abstract-12',
    name: 'Crystal',
    categoryId: 'abstract',
    url: unsplash('1518837695005-2083093ee35b'),
    thumbnailUrl: unsplash('1518837695005-2083093ee35b', 400),
    colors: ['#00d4ff', '#090979'],
  },

  // ============ MINIMAL (12) - Clean, Simple, White Space ============
  {
    id: 'minimal-1',
    name: 'White Interior',
    categoryId: 'minimal',
    url: unsplash('1586023492125-27b2c045efd7'),
    thumbnailUrl: unsplash('1586023492125-27b2c045efd7', 400),
    colors: ['#ffffff', '#f8f8f8'],
  },
  {
    id: 'minimal-2',
    name: 'Minimal Room',
    categoryId: 'minimal',
    url: unsplash('1519710164239-da123dc03ef4'),
    thumbnailUrl: unsplash('1519710164239-da123dc03ef4', 400),
    colors: ['#f5f5f5', '#eeeeee'],
  },
  {
    id: 'minimal-3',
    name: 'White Marble',
    categoryId: 'minimal',
    url: unsplash('1520607162513-77705c0f0d4a'),
    thumbnailUrl: unsplash('1520607162513-77705c0f0d4a', 400),
    colors: ['#e0e0e0', '#d0d0d0'],
  },
  {
    id: 'minimal-4',
    name: 'Cream Paper',
    categoryId: 'minimal',
    url: unsplash('1523821741446-edb2b68bb7a0'),
    thumbnailUrl: unsplash('1523821741446-edb2b68bb7a0', 400),
    colors: ['#fafafa', '#f0f0f0'],
  },
  {
    id: 'minimal-5',
    name: 'White Paint',
    categoryId: 'minimal',
    url: unsplash('1507652313519-d4e9174996dd'),
    thumbnailUrl: unsplash('1507652313519-d4e9174996dd', 400),
    colors: ['#ffffff', '#f5f5f5'],
  },
  {
    id: 'minimal-6',
    name: 'Clean Wall',
    categoryId: 'minimal',
    url: unsplash('1560448205-17d3a46c84de'),
    thumbnailUrl: unsplash('1560448205-17d3a46c84de', 400),
    colors: ['#f8f8f8', '#e8e8e8'],
  },
  {
    id: 'minimal-7',
    name: 'Minimal Furniture',
    categoryId: 'minimal',
    url: unsplash('1533090161767-e6ffed986c88'),
    thumbnailUrl: unsplash('1533090161767-e6ffed986c88', 400),
    colors: ['#f5f5dc', '#eeeecc'],
  },
  {
    id: 'minimal-8',
    name: 'Abstract Lines',
    categoryId: 'minimal',
    url: unsplash('1558591710-4b4a1ae0f04d'),
    thumbnailUrl: unsplash('1558591710-4b4a1ae0f04d', 400),
    colors: ['#e0e0e0', '#c0c0c0'],
  },
  {
    id: 'minimal-9',
    name: 'Soft Gradient',
    categoryId: 'minimal',
    url: unsplash('1557682260-96773eb01377'),
    thumbnailUrl: unsplash('1557682260-96773eb01377', 400),
    colors: ['#ffecd2', '#fcb69f'],
  },
  {
    id: 'minimal-10',
    name: 'Soft Pink',
    categoryId: 'minimal',
    url: unsplash('1557682268-e3955ed5d83f'),
    thumbnailUrl: unsplash('1557682268-e3955ed5d83f', 400),
    colors: ['#ffe4e6', '#ffc0cb'],
  },
  {
    id: 'minimal-11',
    name: 'Light Texture',
    categoryId: 'minimal',
    url: unsplash('1517816428104-797678c7cf0c'),
    thumbnailUrl: unsplash('1517816428104-797678c7cf0c', 400),
    colors: ['#f0f0f0', '#e0e0e0'],
  },
  {
    id: 'minimal-12',
    name: 'Simple White',
    categoryId: 'minimal',
    url: unsplash('1449247709967-d4461a6a6103'),
    thumbnailUrl: unsplash('1449247709967-d4461a6a6103', 400),
    colors: ['#ffffff', '#fafafa'],
  },
];

// Helper to get wallpapers by category
export function getWallpapersByCategory(categoryId: string): WallpaperPreset[] {
  return WALLPAPER_PRESETS.filter((w) => w.categoryId === categoryId);
}

// Helper to get a random wallpaper
export function getRandomWallpaper(): WallpaperPreset {
  const randomIndex = Math.floor(Math.random() * WALLPAPER_PRESETS.length);
  return WALLPAPER_PRESETS[randomIndex];
}

// Parse gradient URL to CSS
export function parseWallpaperUrl(url: string): { type: 'gradient' | 'image'; value: string } {
  if (url.startsWith('gradient:')) {
    return { type: 'gradient', value: url.replace('gradient:', '') };
  }
  return { type: 'image', value: url };
}
