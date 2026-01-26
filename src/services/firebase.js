import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: "AIzaSyAj_5TqOMRSNVm4G0wmE3HgrHEIS7LkkE8",
  authDomain: "cs-hub-8c032.firebaseapp.com",
  projectId: "cs-hub-8c032",
  storageBucket: "cs-hub-8c032.firebasestorage.app",
  messagingSenderId: "534500351748",
  appId: "1:534500351748:web:c0b7305aed3c538ece3a51"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
