const DATABASE = "car-work-tracker-files";
const VERSION = 2;
export const PDF_STORE = "payslip-pdfs";
export const IMAGE_STORE = "job-source-images";

export const openFileDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE, VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(PDF_STORE)) request.result.createObjectStore(PDF_STORE);
    if (!request.result.objectStoreNames.contains(IMAGE_STORE)) request.result.createObjectStore(IMAGE_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const clearFileStore = async (store: string) => {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
};

export const clearAllFileStores = async () => {
  await Promise.all([clearFileStore(PDF_STORE), clearFileStore(IMAGE_STORE)]);
};
