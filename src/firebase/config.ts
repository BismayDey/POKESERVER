import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC_Mp7e6cpyDBHH1KM0OLa48lKDRWAnTTI",
  authDomain: "pokemon-b6bbd.firebaseapp.com",
  projectId: "pokemon-b6bbd",
  storageBucket: "pokemon-b6bbd.firebasestorage.app",
  messagingSenderId: "446127636337",
  appId: "1:446127636337:web:5bd6892f040d2ee6ec80d0"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);