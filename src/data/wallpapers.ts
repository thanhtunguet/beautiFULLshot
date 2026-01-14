// Wallpaper presets for background beautification
// Using curated collection of beautiful, royalty-free wallpapers

export interface WallpaperCategory {
  id: string;
  name: string;
  icon?: string; // Optional icon identifier
}

export interface WallpaperPreset {
  id: string;
  name: string;
  categoryId: string;
  // Use data URLs for embedded wallpapers or external URLs
  // For production, these would be bundled assets
  url: string;
  thumbnailUrl?: string; // Optional smaller version for UI
  colors: string[]; // Dominant colors for fallback/preview
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
  // Professional / Workspace
  {
    id: 'prof-desk-1',
    name: 'Modern Desk',
    categoryId: 'professional',
    url: unsplash('1497215728101-856f4ea42174'),
    thumbnailUrl: unsplash('1497215728101-856f4ea42174', 400),
    colors: ['#e0e0e0', '#ffffff'],
  },
  {
    id: 'prof-workspace-clean',
    name: 'Clean Workspace',
    categoryId: 'professional',
    url: unsplash('1497366216548-37526070297c'),
    thumbnailUrl: unsplash('1497366216548-37526070297c', 400),
    colors: ['#f5f5f5', '#dddddd'],
  },
  {
    id: 'prof-co-working',
    name: 'Collaborative',
    categoryId: 'professional',
    url: unsplash('1486406146926-c627a92ad1ab'),
    thumbnailUrl: unsplash('1486406146926-c627a92ad1ab', 400),
    colors: ['#ffffff', '#f0f0f0'],
  },
  {
    id: 'prof-macbook',
    name: 'MacBook Pro',
    categoryId: 'professional',
    url: unsplash('1519389950473-47ba0277781c'),
    thumbnailUrl: unsplash('1519389950473-47ba0277781c', 400),
    colors: ['#333333', '#444444'],
  },
  {
    id: 'prof-writing',
    name: 'Writing',
    categoryId: 'professional',
    url: unsplash('1455390582262-044cdead277a'),
    thumbnailUrl: unsplash('1455390582262-044cdead277a', 400),
    colors: ['#555555', '#222222'],
  },

  // Nature
  {
    id: 'nature-mountains',
    name: 'Misty Mountains',
    categoryId: 'nature',
    url: unsplash('1472214103451-9374bd1c798e'),
    thumbnailUrl: unsplash('1472214103451-9374bd1c798e', 400),
    colors: ['#6b7b8c', '#a0aab5'],
  },
  {
    id: 'nature-forest',
    name: 'Deep Forest',
    categoryId: 'nature',
    url: unsplash('1441974231531-c6227db76b6e'),
    thumbnailUrl: unsplash('1441974231531-c6227db76b6e', 400),
    colors: ['#1e2f23', '#2d4435'],
  },
  {
    id: 'nature-ocean',
    name: 'Calm Ocean',
    categoryId: 'nature',
    url: unsplash('1507525428034-b723cf961d3e'),
    thumbnailUrl: unsplash('1507525428034-b723cf961d3e', 400),
    colors: ['#006994', '#009dc4'],
  },
  {
    id: 'nature-desert',
    name: 'Golden Desert',
    categoryId: 'nature',
    url: unsplash('1473580044384-7ba9967e16a0'),
    thumbnailUrl: unsplash('1473580044384-7ba9967e16a0', 400),
    colors: ['#c2b280', '#e6d8ad'],
  },
  {
    id: 'nature-sky',
    name: 'Blue Sky',
    categoryId: 'nature',
    url: unsplash('1513002749550-c59d786b8e6c'),
    thumbnailUrl: unsplash('1513002749550-c59d786b8e6c', 400),
    colors: ['#87CEEB', '#E0F4FF'],
  },

  // Abstract
  {
    id: 'abstract-fluid',
    name: 'Fluid Art',
    categoryId: 'abstract',
    url: unsplash('1550684848-fac1c5b4e853'),
    thumbnailUrl: unsplash('1550684848-fac1c5b4e853', 400),
    colors: ['#4a4a4a', '#2a2a2a'],
  },
  {
    id: 'abstract-geo',
    name: 'Geometric',
    categoryId: 'abstract',
    url: unsplash('1516089869689-53b49980d22d'),
    thumbnailUrl: unsplash('1516089869689-53b49980d22d', 400),
    colors: ['#000000', '#333333'],
  },
  {
    id: 'abstract-colors',
    name: 'Color Splash',
    categoryId: 'abstract',
    url: unsplash('1541701494-874177d18c95'),
    thumbnailUrl: unsplash('1541701494-874177d18c95', 400),
    colors: ['#ff0000', '#00ff00', '#0000ff'],
  },
  {
    id: 'abstract-dark',
    name: 'Dark Texture',
    categoryId: 'abstract',
    url: unsplash('1478760329108-5c3ed9d495a0'),
    thumbnailUrl: unsplash('1478760329108-5c3ed9d495a0', 400),
    colors: ['#1a1a2e', '#16213e'],
  },
  {
    id: 'abstract-light',
    name: 'Light Trails',
    categoryId: 'abstract',
    url: unsplash('1495615080073-5bca0ce80a60'),
    thumbnailUrl: unsplash('1495615080073-5bca0ce80a60', 400),
    colors: ['#ffdfba', '#ffffba'],
  },

  // Minimal
  {
    id: 'minimal-white',
    name: 'White Room',
    categoryId: 'minimal',
    url: unsplash('1494438639946-1ebd1d20bf85'),
    thumbnailUrl: unsplash('1494438639946-1ebd1d20bf85', 400),
    colors: ['#ffffff', '#f8f8f8'],
  },
  {
    id: 'minimal-plant',
    name: 'Monstera',
    categoryId: 'minimal',
    url: unsplash('1460501648673-c86db032e659'),
    thumbnailUrl: unsplash('1460501648673-c86db032e659', 400),
    colors: ['#ffffff', '#4caf50'],
  },
  {
    id: 'minimal-arch',
    name: 'Architecture',
    categoryId: 'minimal',
    url: unsplash('1487701549529-82736b6699dd'),
    thumbnailUrl: unsplash('1487701549529-82736b6699dd', 400),
    colors: ['#eeeeee', '#cccccc'],
  },
  {
    id: 'minimal-shadow',
    name: 'Shadows',
    categoryId: 'minimal',
    url: unsplash('1507646227500-4d392bee5385'),
    thumbnailUrl: unsplash('1507646227500-4d392bee5385', 400),
    colors: ['#dddddd', '#bbbbbb'],
  },
  {
    id: 'minimal-lines',
    name: 'Clean Lines',
    categoryId: 'minimal',
    url: unsplash('1496660636882-d49d92e59781'),
    thumbnailUrl: unsplash('1496660636882-d49d92e59781', 400),
    colors: ['#f0f0f0', '#d0d0d0'],
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
