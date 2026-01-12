// IndexedDB storage for background images
// Much larger storage capacity than localStorage (hundreds of MB to GB)

const DB_NAME = 'beautyscreenshot-images';
const DB_VERSION = 1;
const STORE_NAME = 'background-images';

export interface StoredImage {
  id: string;
  dataUrl: string; // Full quality image
  thumbnail: string; // Small preview for UI
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

// Initialize the database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Add image to database
export async function addImageToDB(image: StoredImage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(image);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to add image'));
  });
}

// Get all images from database (sorted by timestamp, newest first)
export async function getAllImagesFromDB(): Promise<StoredImage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const images = request.result as StoredImage[];
      // Sort by timestamp descending (newest first)
      images.sort((a, b) => b.timestamp - a.timestamp);
      resolve(images);
    };
    request.onerror = () => reject(new Error('Failed to get images'));
  });
}

// Get single image by ID
export async function getImageFromDB(id: string): Promise<StoredImage | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get image'));
  });
}

// Remove image from database
export async function removeImageFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to remove image'));
  });
}

// Clear all images from database
export async function clearAllImagesFromDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear images'));
  });
}

// Get count of images
export async function getImageCountFromDB(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to count images'));
  });
}

// Remove oldest images to maintain max count
export async function trimOldestImages(maxCount: number): Promise<void> {
  const images = await getAllImagesFromDB();
  if (images.length <= maxCount) return;

  // Remove oldest images (they're already sorted newest first)
  const toRemove = images.slice(maxCount);
  for (const img of toRemove) {
    await removeImageFromDB(img.id);
  }
}
