const DATABASE = "car-work-tracker-files";
const VERSION = 2;
const IMAGE_STORE = "job-source-images";
const PDF_STORE = "payslip-pdfs";

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE, VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(PDF_STORE)) request.result.createObjectStore(PDF_STORE);
    if (!request.result.objectStoreNames.contains(IMAGE_STORE)) request.result.createObjectStore(IMAGE_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const browserImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image format is not supported by this browser")); };
  image.src = url;
});

export const compressJobImage = async (file: File) => {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = typeof createImageBitmap === "function" ? await createImageBitmap(file) : await browserImage(file);
  } catch {
    source = await browserImage(file);
  }
  const width = source instanceof ImageBitmap ? source.width : source.naturalWidth;
  const height = source instanceof ImageBitmap ? source.height : source.naturalHeight;
  const scale = Math.min(1, 1800 / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas unavailable");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source instanceof ImageBitmap) source.close();
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image compression failed")), "image/jpeg", 0.84));
};

export const saveJobImages = async (jobId: string, images: Blob[]) => {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    transaction.objectStore(IMAGE_STORE).put(images, jobId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
};

export const getJobImages = async (jobId: string) => {
  const database = await openDatabase();
  const images = await new Promise<Blob[]>((resolve, reject) => {
    const request = database.transaction(IMAGE_STORE, "readonly").objectStore(IMAGE_STORE).get(jobId);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result.filter(item => item instanceof Blob) : []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return images;
};

export const deleteJobImages = async (jobId: string) => {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    transaction.objectStore(IMAGE_STORE).delete(jobId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
};

export const clearLocalFiles = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error("Database is open"));
});
