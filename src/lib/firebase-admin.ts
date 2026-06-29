import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
}

let app;

try {
  if (projectId && clientEmail && privateKey) {
    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('Firebase Admin initialized successfully.');
    } else {
      app = getApp();
    }
  } else {
    console.warn(
      'Firebase config variables are missing. Firestore is disabled; falling back to mock database storage.'
    );
  }
} catch (error) {
  console.error('Firebase Admin initialization failed:', error);
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
