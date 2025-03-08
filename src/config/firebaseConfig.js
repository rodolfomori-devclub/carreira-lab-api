// firebaseConfig.js
import 'dotenv/config';

export default {
    apiKey: process.env.FIREBASE_API_KEY,               // Substitua com seus dados reais
    authDomain:process.env.FIREBASE_AUTH_DOMAIN,     
    projectId:process.env.FIREBASE_PROJECT_ID,     
    storageBucket:process.env.FIREBASE_STORAGE_BUCKET,     
    messagingSenderId:process.env.FIREBASE_MESSAGING_SENDER_ID,     
    appId:process.env.FIREBASE_APP_ID,     
  };

