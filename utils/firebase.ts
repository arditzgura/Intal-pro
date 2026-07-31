import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJCx-XvZO9b-AdfGKfNq2fUX_L4sCoA04",
  authDomain: "intal-pro-fatura-8f702.firebaseapp.com",
  projectId: "intal-pro-fatura-8f702",
  storageBucket: "intal-pro-fatura-8f702.firebasestorage.app",
  messagingSenderId: "1060148073411",
  appId: "1:1060148073411:web:e55c26959b36728b96e376",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db   = getFirestore(app);
