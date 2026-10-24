import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, Timestamp, addDoc, getDocs, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Memory cache only (the default): a device copy (IndexedDB) can't be cleared reliably while other tabs are open, and
// would outlive the session on a shared device.
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

export async function ensureUserDocExists(user: FirebaseUser, name?: string, deferAttendance = false) {
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);
  const isTeacherEmail = user.email === 'lizzieshere1@gmail.com';
  let profile = userDoc.exists() ? userDoc.data() : {
    uid: user.uid, email: user.email, name: name || user.displayName || '사용자',
    photoURL: user.photoURL, role: isTeacherEmail ? 'teacher' : 'student',
    createdAt: Timestamp.now(), isNameSet: !!name,
  };
  if (!userDoc.exists()) await setDoc(userDocRef, profile);
  else if (isTeacherEmail && profile.role !== 'teacher') {
    await setDoc(userDocRef, { role: 'teacher' }, { merge: true });
    profile = { ...profile, role: 'teacher' };
  }
  if (deferAttendance) void recordAttendance(user.uid);
  else await recordAttendance(user.uid);
  return profile;
}

export async function signUpWithEmail(email: string, password: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Profile sync will be handled by onAuthStateChanged in App.tsx
    return result.user;
  } catch (error: any) {
    // Only log unexpected errors
    if (error?.code !== 'auth/email-already-in-use') {
      console.error('Error signing up helper:', error?.code || 'unknown'); // the code only: auth errors can carry the email
    }
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Profile sync will be handled by onAuthStateChanged in App.tsx
    return result.user;
  } catch (error: any) {
    if (
      error?.code !== 'auth/user-not-found' && 
      error?.code !== 'auth/wrong-password' &&
      error?.code !== 'auth/invalid-credential'
    ) {
      console.error('Error signing in helper:', error?.code || 'unknown');
    }
    throw error;
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error resetting password helper:', error?.code || 'unknown');
    throw error;
  }
}

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Profile sync will be handled by onAuthStateChanged in App.tsx
    return result.user;
  } catch (error: any) {
    console.error('Firebase Google Login Error:', { code: error?.code, isIframe: window.self !== window.top });
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

export async function recordStudySession(data: {
  uid: string;
  wordbookId: string;
  wordbookTitle?: string;
  wordbookType?: string;
  type: 'quiz' | 'flashcard' | 'match' | 'conjugation' | 'test';
  category?: 'word' | 'grammar' | 'exam' | 'sentence';
  duration: number; // in seconds
  score?: number;
  totalItems?: number;
  dayStart?: number;
  dayEnd?: number;
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
    // Recursive function to remove undefined values and clean arrays
    const cleanObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj
          .filter(item => item !== undefined)
          .map(item => cleanObject(item));
      } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Timestamp)) {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) {
            newObj[key] = cleanObject(obj[key]);
          }
        });
        return newObj;
      }
      return obj;
    };

    // Sanitize incorrect answers so no unsupported values reach Firestore
    const sanitizedIncorrect = Array.isArray(data.incorrectAnswers) 
      ? data.incorrectAnswers.map(ans => ({
          word: String(ans.word || ''),
          meaning: String(ans.meaning || ''),
          userChoice: String(ans.userChoice || ''),
          correctAnswer: String(ans.correctAnswer || ''),
          choices: Array.isArray(ans.choices) ? ans.choices.filter(c => c !== undefined && c !== null).map(String) : [],
          quizSentence: ans.quizSentence ? String(ans.quizSentence) : ''
        }))
      : undefined;

    const safeDuration = typeof data.duration === 'number' && !isNaN(data.duration)
      ? Math.max(1, Math.floor(data.duration))
      : 1;

    const safeScore = typeof data.score === 'number' && !isNaN(data.score)
      ? data.score
      : 0;

    const safeTotal = typeof data.totalItems === 'number' && !isNaN(data.totalItems)
      ? data.totalItems
      : 0;

    const docData = cleanObject({
      uid: data.uid,
      wordbookId: data.wordbookId,
      wordbookTitle: (data.wordbookTitle || '단어장').slice(0, 450),
      wordbookType: data.wordbookType || undefined,
      type: data.type,
      category: data.category === 'sentence' ? 'word' : data.category || 'word', // the rules allow word, grammar, exam
      duration: safeDuration,
      score: safeScore,
      totalItems: safeTotal,
      dayStart: typeof data.dayStart === 'number' && !isNaN(data.dayStart) ? data.dayStart : undefined,
      dayEnd: typeof data.dayEnd === 'number' && !isNaN(data.dayEnd) ? data.dayEnd : undefined,
      incorrectAnswers: sanitizedIncorrect,
      createdAt: Timestamp.now()
    });

    const docRef = await addDoc(sessionRef, docData);
    // 학생 학습 알림: the teachers who turned it on hear about it (never in the student's way)
    void import('./studyDonePing').then(m => m.pingStudyDone(docRef.id)).catch(() => undefined);
    console.log(`[StudySession] Recorded successfully: ID=${docRef.id}, type=${data.type}, category=${docData.category}, score=${safeScore}/${safeTotal}, duration=${safeDuration}s`);
    return docRef.id;
  } catch (error) {
    console.error('[StudySession] Failed to record study session:', error, data);
    throw error;
  }
}
