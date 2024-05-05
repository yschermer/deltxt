import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.8.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/9.8.1/firebase-auth.js';
import { getFirestore, doc, updateDoc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA1rfZxTr4SBhRtFVdBWtXZwED_SDHBkVo",
  authDomain: "deltxt-e2af6.firebaseapp.com",
  projectId: "deltxt-e2af6",
  storageBucket: "deltxt-e2af6.appspot.com",
  messagingSenderId: "934677286690",
  appId: "1:934677286690:web:c220a84418a50e4d229f7b"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const notepad = document.getElementById('notepad');
const statusMessage = document.getElementById('status-message');

let currentFileId = null; // Track the current file
let userId = null; // Declare globally

// Authentication
const signInButton = document.getElementById('sign-in-button');
signInButton.addEventListener('click', () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).catch(error => showError(error));
});

async function ensureUserDocumentExists(userId) {
  const notesRef = doc(db, 'notes', userId);
  const docSnap = await getDoc(notesRef);

  if (!docSnap.exists()) {
    // Create an initial document with an empty files array
    await setDoc(notesRef, { files: [] }); 
  }
}

// App Logic
auth.onAuthStateChanged(async user => {
  if (user) {
    userId = user.uid;
    showApp();
    await ensureUserDocumentExists(user.uid); // Create document if it doesn't exist
  } else {
    showAuth();
  }
});

function showApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadNotes();
  notepad.addEventListener('input', () => createOrUpdateFile(notepad.value));
}

function showAuth() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('app').style.display = 'none';
}

function showError(error) {
  statusMessage.textContent = `Error: ${error.message}`;
  console.log(error);
}

function getRemainingTTLText(firestoreTimestamp) {
  const MAX_TTL_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  // Convert Firestore Timestamp to Date 
  const fileLastModifiedDate = firestoreTimestamp.toDate();
  const fileLastModifiedTimestamp = fileLastModifiedDate.getTime();

  const now = new Date().getTime();
  const timeDifference = now - fileLastModifiedTimestamp;
  const remainingTTL = MAX_TTL_IN_MS - timeDifference;

  if (remainingTTL <= 0) {
    return "(deleted today)";
  }

  const remainingDays = Math.floor(remainingTTL / (24 * 60 * 60 * 1000));
  return remainingDays === 1 ? `(1 day left)` : `(${remainingDays} days remaining)`;
}

// Load Notes
async function loadNotes() {
  const notesRef = doc(db, 'notes', userId);
  const docSnap = await getDoc(notesRef);

  if (docSnap.exists()) {
    const files = docSnap.data().files || []; // Get the 'files' array

    // Clear existing file list
    document.getElementById('files-list').innerHTML = '';

    files.forEach((file, index) => {
      const listItem = document.createElement('li');
      const ttl = getRemainingTTLText(file.lastModified);
      let title = file.content.substring(0, file.content.indexOf('\n')).replaceAll(" ", "-").trim();
      if (title === "") {
        title = file.content.substring(0, file.content.indexOf(" "));
        if (title === "") {
          title = file.content.substring(0, 10);
        }
      }
      listItem.textContent = `${title}.txt ${ttl}`;
      listItem.dataset.id = file.id; // Add the file ID
      // You might add an event listener to `listItem` for loading individual file content

      document.getElementById('files-list').appendChild(listItem);
    });
  }
}

function generateSimpleId() {
  return Date.now().toString(36); // Timestamp-based ID (not perfectly unique!) 
}

// Save note
async function createOrUpdateFile(content) {
  const notesRef = doc(db, 'notes', userId);
  const docSnap = await getDoc(notesRef);
  const lastModified = new Date();

  if (docSnap.exists()) {
    const files = docSnap.data().files || [];

    let fileIndex = -1;
    if (currentFileId) {
      fileIndex = files.findIndex(file => file.id === currentFileId);
    }

    if (fileIndex !== -1) {
      // Update existing file
      files[fileIndex].content = content;
      files[fileIndex].lastModified = lastModified;
    } else {
      // Create a new file
      currentFileId = generateSimpleId();
      files.push({
        id: currentFileId,
        content,
        lastModified: lastModified
      });
    }
    await updateDoc(notesRef, { files });
  } else {
    // Create the initial document with user ID as the document ID
    currentFileId = generateSimpleId();
    await setDoc(notesRef, { files: [{ id: currentFileId, content, lastModified }] });
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
  document.getElementById('status-message').textContent = `Last auto-save: ${timeString}`;

  return Promise.resolve(); // Return a resolved Promise
}


async function loadFile(fileId) {
  const notesRef = doc(db, 'notes', userId);
  const docSnap = await getDoc(notesRef);

  if (docSnap.exists()) {
    const files = docSnap.data().files || [];

    const file = files.find(file => file.id === fileId);

    if (file) {
      document.getElementById('notepad').value = file.content;
    } else {
      // Handle invalid fileId (show error maybe)
    }
  }
}

function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => { // Create a Promise
      timeoutId = setTimeout(() => {
        const result = func(...args);
        resolve(result); // Resolve the Promise with the result
      }, delay);
    });
  };
}

// Event Listeners 
document.getElementById('notepad').addEventListener('input', async () => {
  notepad.style.height = 'auto'; // Reset height to 'auto'
  notepad.style.height = notepad.scrollHeight + 'px'; // Set height based on scroll content

  const debouncedSave = debounce((content) => {
    return createOrUpdateFile(content);
  }, 2000);

  await debouncedSave(document.getElementById('notepad').value);

  const debouncedLoadNotes = debounce(() => {
    return loadNotes();
  }, 2000);

  await debouncedLoadNotes();
});

document.getElementById('notepad').addEventListener('keydown', function (event) {
  if (event.key === 'Tab') {
    event.preventDefault(); // Prevent default tab behavior (usually focus change)

    // Insert your desired number of spaces
    const start = this.selectionStart;
    const end = this.selectionEnd;
    this.value = this.value.substring(0, start) + "    " + this.value.substring(end); // Replace this with any indentation string you want
    this.selectionStart = this.selectionEnd = start + 4;  // Adjust the + number for desired spacing
  }
  notepad.style.overflow = 'hidden';
});

// if files-button is clicked, show the files-list by displaying files-area else hide it
document.getElementById('files-button').addEventListener('click', () => {
  const filesArea = document.getElementById('files-area');
  if (filesArea.style.display === 'block') {
    filesArea.style.display = 'none';
  } else {
    filesArea.style.display = 'block';
  }
});

document.getElementById('files-list').addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    const fileId = event.target.dataset.id;
    if (fileId !== currentFileId) { // If it's a different file
      // Remove 'selected' from the previously active item (if any)
      const previouslySelected = document.querySelector('#files-list li.selected');
      if (previouslySelected) {
        previouslySelected.classList.remove('selected');
      }

      // Add 'selected' to the newly clicked item
      event.target.classList.add('selected');

      currentFileId = fileId;
      loadFile(currentFileId);
    }
  }
});

document.getElementById('sign-out-button').addEventListener('click', () => {
  auth.signOut()
    .then(() => {
      // Signed out successfully
      showAuth();
      // Consider clearing the notepad and any other relevant UI elements
    })
    .catch((error) => {
      // Handle sign-out errors, maybe call showError(error)
    });
});

document.getElementById('new-file-button').addEventListener('click', () => {
  // Hard refresh
  location.reload(); 
}); 