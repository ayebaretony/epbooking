<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyA9bEKptoXnOyUpZN-e2bZRrt15CWNLVvY",
    authDomain: "pitchbookingsystem-6e222.firebaseapp.com",
    projectId: "pitchbookingsystem-6e222",
    storageBucket: "pitchbookingsystem-6e222.firebasestorage.app",
    messagingSenderId: "486051720706",
    appId: "1:486051720706:web:2bbb83988fc6d623c1011b",
    measurementId: "G-PT7QJYP2T1"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
