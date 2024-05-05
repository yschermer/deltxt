const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// eslint-disable-next-line max-len
exports.deleteOldNotes = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
  // const cutoff = new Date(Date.now() - (3 * 60 * 1000)); // 3 minutes ago
  const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago

  const querySnapshot = await db.collection("notes").get();
  const deletePromises = querySnapshot.docs.map(async (doc) => {
    const files = doc.data().files || [];
    const filesToDelete = files.filter((file) =>
      file.lastModified.toDate() < cutoff);

    if (filesToDelete.length > 0) {
      const newFiles = files.filter((file) =>
        file.lastModified.toDate() >= cutoff);
      await db.collection("notes").doc(doc.id).update({files: newFiles});
    }
  });

  return Promise.all(deletePromises);
});
