// Chrisland University Exeat System — Firebase Config

const firebaseConfig = {
  apiKey: "AIzaSyBJM3QQndquKWVJ2WsU4IUi46coASDSLS8",
  authDomain: "exeat-273c7.firebaseapp.com",
  databaseURL: "https://exeat-273c7-default-rtdb.firebaseio.com",
  projectId: "exeat-273c7",
  storageBucket: "exeat-273c7.firebasestorage.app",
  messagingSenderId: "201849977834",
  appId: "1:201849977834:web:25c5757040b622601d5093",
  measurementId: "G-D0HRBX1B6T"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Action code settings for magic link
// ⚠️ IMPORTANT: Change this URL to your deployed site URL after hosting
const actionCodeSettings = {
  url: window.location.origin + '/login-student.html',
  handleCodeInApp: true
};
