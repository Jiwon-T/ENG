import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, Timestamp, addDoc, getDocs, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';
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

export async function ensureUserDocExists(user: FirebaseUser, name?: string) {
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);
  
  const isTeacherEmail = user.email === 'lizzieshere1@gmail.com';
  const role = isTeacherEmail ? 'teacher' : 'student';

  if (!userDoc.exists()) {
    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email,
      name: name || user.displayName || '사용자',
      photoURL: user.photoURL,
      role: role,
      createdAt: Timestamp.now(),
      isNameSet: !!name 
    });
  } else if (isTeacherEmail && userDoc.data().role !== 'teacher') {
    await setDoc(userDocRef, { role: 'teacher' }, { merge: true });
  }

  // Record attendance for today
  await recordAttendance(user.uid);
}

export async function signUpWithEmail(email: string, password: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await ensureUserDocExists(result.user, '사용자');
    return result.user;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Already exists in Firestore, just ensure attendance
    await recordAttendance(result.user.uid);
    return result.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDocExists(result.user);
    return result.user;
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
  } catch (error: any) {
    // Ignore permission denied errors for recordAttendance as it's a background task
    if (error?.code !== 'permission-denied') {
      console.error('Failed to record attendance:', error);
    }
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

export async function saveAssignment(studentUid: string, teacherUid: string, content: string) {
  const assignmentRef = collection(db, 'assignments');
  const q = query(assignmentRef, where('studentUid', '==', studentUid), orderBy('createdAt', 'desc'));
  
  try {
    // Add new assignment
    await addDoc(assignmentRef, {
      studentUid,
      teacherUid,
      content,
      createdAt: Timestamp.now(),
      isNew: true
    });

    // Fetch existing to enforce limit
    const snapshot = await getDocs(q);
    if (snapshot.docs.length >= 10) {
      const allDocs = snapshot.docs;
      if (allDocs.length >= 10) {
        const toDelete = allDocs.slice(9); // Keep 0-8, delete 9 and beyond
        for (const d of toDelete) {
          await deleteDoc(doc(db, 'assignments', d.id));
        }
      }
    }
  } catch (error) {
    console.error('Failed to save assignment:', error);
  }
}

export async function updateAssignment(id: string, content: string) {
  try {
    await updateDoc(doc(db, 'assignments', id), {
      content,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Failed to update assignment:', error);
    throw error;
  }
}

export async function deleteAssignment(id: string) {
  try {
    await deleteDoc(doc(db, 'assignments', id));
  } catch (error) {
    console.error('Failed to delete assignment:', error);
    throw error;
  }
}

export async function markIncorrectAnswerReviewed(sessionId: string, word: string) {
  const sessionRef = doc(db, 'studySessions', sessionId);
  try {
    const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists()) return;
    
    const data = sessionDoc.data();
    const incorrectAnswers = data.incorrectAnswers || [];
    
    const updated = incorrectAnswers.map((ans: any) => {
      if (ans.word === word) {
        return { ...ans, isReviewed: true };
      }
      return ans;
    });
    
    await updateDoc(sessionRef, { incorrectAnswers: updated });
  } catch (error) {
    console.error('Failed to mark incorrect answer as reviewed:', error);
    throw error;
  }
}
export async function recordStudySession(data: {
  uid: string;
  wordbookId: string;
  wordbookTitle: string;
  type: 'quiz' | 'flashcard' | 'match' | 'conjugation';
  category: 'word' | 'grammar';
  duration: number; // in seconds
  score?: number;
  totalItems?: number;
  incorrectAnswers?: {
    word: string;
    meaning: string;
    userChoice: string;
    correctAnswer: string;
    choices?: string[];
    quizSentence?: string;
  }[];
}) {
  const sessionRef = collection(db, 'studySessions');
  try {
    const docData: any = {
      ...data,
      createdAt: Timestamp.now()
    };
    
    // Remove undefined fields
    Object.keys(docData).forEach(key => {
      if (docData[key] === undefined) {
        delete docData[key];
      }
    });

    await addDoc(sessionRef, docData);
    console.log(`Study session recorded: ${data.type} for ${data.duration}s`);
  } catch (error) {
    console.error('Failed to record study session:', error);
  }
}
