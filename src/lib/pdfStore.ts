import { openFileDatabase, PDF_STORE } from "./fileDatabase";

export const savePayslipPdf = async (payslipId: string, file: File) => {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PDF_STORE, "readwrite");
    transaction.objectStore(PDF_STORE).put(file, payslipId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
};

export const getPayslipPdf = async (payslipId: string) => {
  const database = await openFileDatabase();
  const file = await new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction(PDF_STORE, "readonly").objectStore(PDF_STORE).get(payslipId);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return file;
};

export const deletePayslipPdf = async (payslipId: string) => {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PDF_STORE, "readwrite");
    transaction.objectStore(PDF_STORE).delete(payslipId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
};
