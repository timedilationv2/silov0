import { validateDocument } from "./model.mjs";
export class ConflictError extends Error {
  constructor() {
    super(
      "This document changed in another tab. Save a copy to keep this draft without overwriting the other version.",
    );
  }
}

export async function openStore() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("silov0-workspace", 2);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1)
        db.createObjectStore("documents", { keyPath: "id" });
      if (event.oldVersion < 2) {
        // Retain byte-for-byte v1 records in an upgrade transaction. Existing records
        // stay untouched; the model supplies Markdown defaults when they are read.
        const originals = db.createObjectStore("legacy-v1", { keyPath: "id" });
        const cursor = request.transaction
          .objectStore("documents")
          .openCursor();
        cursor.onsuccess = () => {
          if (cursor.result) {
            originals.put(cursor.result.value);
            cursor.result.continue();
          }
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Cannot open local storage. Check browser permissions or private browsing restrictions.",
        ),
      );
    request.onblocked = () =>
      reject(
        new Error(
          "Storage upgrade blocked. Close other SiloV0 tabs, then retry.",
        ),
      );
  });
  db.onversionchange = () => db.close();

  function transaction(mode, work) {
    return new Promise((resolve, reject) => {
      let value, failure;
      const tx = db.transaction("documents", mode);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () =>
        reject(
          failure ||
            new Error(
              "Local storage failed. Your changes are still in the editor; export a copy before leaving.",
            ),
        );
      tx.onabort = () =>
        reject(
          failure ||
            new Error(
              "Local storage transaction was cancelled. Your existing saved documents are unchanged.",
            ),
        );
      try {
        work(
          tx.objectStore("documents"),
          (result) => {
            value = result;
          },
          (error) => {
            failure = error;
            tx.abort();
          },
        );
      } catch (error) {
        failure = error;
        tx.abort();
      }
    });
  }
  return {
    async list() {
      const result = await transaction("readonly", (store, done) => {
        const r = store.getAll();
        r.onsuccess = () => done(r.result);
      });
      return result.map(validateDocument);
    },
    async save(input) {
      const doc = validateDocument(input);
      return transaction("readwrite", (store, done, fail) => {
        const r = store.get(doc.id);
        r.onsuccess = () => {
          const prior = r.result;
          if (
            (prior && prior.revision !== doc.revision) ||
            (!prior && doc.revision !== 0)
          )
            return fail(new ConflictError());
          const saved = { ...doc, revision: doc.revision + 1 };
          store.put(saved);
          done(saved);
        };
      });
    },
    async remove(doc) {
      return transaction("readwrite", (store, done, fail) => {
        const r = store.get(doc.id);
        r.onsuccess = () => {
          if (!r.result || r.result.revision !== doc.revision)
            return fail(new ConflictError());
          store.delete(doc.id);
          done(true);
        };
      });
    },
    async addCopies(documents) {
      // Validate the complete batch before starting an all-or-nothing transaction.
      const copies = documents
        .map(validateDocument)
        .map((d) => ({ ...d, revision: 1 }));
      return transaction("readwrite", (store, done) => {
        for (const doc of copies) store.add(doc);
        done(copies);
      });
    },
    close() {
      db.close();
    },
  };
}
