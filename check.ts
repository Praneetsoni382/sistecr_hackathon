import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseConfig from "./artifacts/api-server/src/firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  const docRef = doc(db, "legacy_land_records", "LR-000105");
  const snap = await getDoc(docRef);
  console.log(snap.data());
}

check().then(() => process.exit(0)).catch(console.error);
