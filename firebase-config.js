// Identifies the Gym Quest project on Firebase (https://firebase.google.com), which stores each
// signed-in person's data. These values are public by design and ship to every visitor; what
// keeps one person's workouts private is the security rule in `firestore.rules`, which only
// lets a signed-in person read and write their own record.
export const firebaseConfig = {
  apiKey: "AIzaSyDQrbx8ulIqpu5eMmrmyPViyExPCcGAEI0",
  authDomain: "gym-quest-7ce92.firebaseapp.com",
  projectId: "gym-quest-7ce92",
  storageBucket: "gym-quest-7ce92.firebasestorage.app",
  messagingSenderId: "795837141187",
  appId: "1:795837141187:web:e7563f48b4de1588155276",
};
