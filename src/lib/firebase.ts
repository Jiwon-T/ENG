import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, Timestamp, addDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in Firestore, if not create
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    const isTeacherEmail = user.email === 'lizzieshere1@gmail.com';
    const role = isTeacherEmail ? 'teacher' : 'student';

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        role: role,
        createdAt: Timestamp.now()
      });
    } else if (isTeacherEmail && userDoc.data().role !== 'teacher') {
      // Force update role for the teacher email if it was previously set to student
      await setDoc(userDocRef, { role: 'teacher' }, { merge: true });
    }

    // Record attendance for today
    await recordAttendance(user.uid);

    return user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}

export async function recordAttendance(uid: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  const attendanceId = `${uid}_${today}`;
  const attendanceRef = doc(db, 'attendance', attendanceId);
  
  try {
    const attendanceDoc = await getDoc(attendanceRef);
    if (!attendanceDoc.exists()) {
      await setDoc(attendanceRef, {
        studentId: uid,
        date: today,
        status: 'present',
        teacherUid: 'system', // System recorded
        updatedAt: Timestamp.now()
      });
      console.log(`Attendance recorded for ${uid} on ${today}`);
    }
  } catch (error) {
    console.error('Failed to record attendance:', error);
  }
}

export async function saveAnalysisHistory(uid: string, text: string, result: any, folderId: string | null = null) {
  const historyRef = collection(db, 'analysisHistory');
  // Only count recent items (not in folders)
  const q = query(historyRef, where('uid', '==', uid), where('folderId', '==', null));
  
  try {
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    docs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    // Add new record
    await addDoc(historyRef, {
      uid,
      text: text,
      title: result.title,
      result: result,
      createdAt: Timestamp.now(),
      folderId: folderId
    });

    // If more than 5 recent items and we just added a recent item, delete oldest
    if (folderId === null && docs.length >= 5) {
      const toDelete = docs.slice(4);
      for (const d of toDelete) {
        await deleteDoc(doc(db, 'analysisHistory', d.id));
      }
    }
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

export async function saveGeneratorHistory(uid: string, text: string, result: any, folderId: string | null = null) {
  const historyRef = collection(db, 'generatorHistory');
  // Only count recent items (not in folders)
  const q = query(historyRef, where('uid', '==', uid), where('folderId', '==', null));
  
  try {
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    docs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    // Add new record
    await addDoc(historyRef, {
      uid,
      text: text,
      title: result.title || '변형 문제 세트',
      result: result,
      createdAt: Timestamp.now(),
      folderId: folderId
    });

    // If more than 5 recent items and we just added a recent item, delete oldest
    if (folderId === null && docs.length >= 5) {
      const toDelete = docs.slice(4);
      for (const d of toDelete) {
        await deleteDoc(doc(db, 'generatorHistory', d.id));
      }
    }
  } catch (error) {
    console.error('Failed to save generator history:', error);
  }
}

export async function createFolder(uid: string, name: string) {
  const folderRef = collection(db, 'folders');
  return await addDoc(folderRef, {
    uid,
    name,
    createdAt: Timestamp.now()
  });
}

export async function deleteFolder(folderId: string) {
  // Delete folder
  await deleteDoc(doc(db, 'folders', folderId));
  
  // Update items in folder to be "orphaned" or delete them? 
  // User said "manage files in folders", so deleting folder should probably delete contents or move them back to history.
  // Let's move them back to history (folderId = null) but they might get auto-deleted if > 5.
  // Actually, let's just delete them for simplicity in this "file management" context.
  const analysisRef = collection(db, 'analysisHistory');
  const genRef = collection(db, 'generatorHistory');
  
  const q1 = query(analysisRef, where('folderId', '==', folderId));
  const q2 = query(genRef, where('folderId', '==', folderId));
  
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  
  const deletions = [
    ...s1.docs.map(d => deleteDoc(doc(db, 'analysisHistory', d.id))),
    ...s2.docs.map(d => deleteDoc(doc(db, 'generatorHistory', d.id)))
  ];
  
  await Promise.all(deletions);
}

export async function moveToFolder(recordId: string, type: 'analysis' | 'generator', folderId: string | null) {
  const collectionName = type === 'analysis' ? 'analysisHistory' : 'generatorHistory';
  await updateDoc(doc(db, collectionName, recordId), {
    folderId: folderId
  });
}

export async function renameFolder(folderId: string, newName: string) {
  await updateDoc(doc(db, 'folders', folderId), {
    name: newName
  });
}

export async function logout() {
  await signOut(auth);
}
