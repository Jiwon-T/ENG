import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, recordAttendance } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../types';

export async function profileLoader(user: FirebaseUser): Promise<UserProfile | null> {
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);
  
  const isTeacherEmail = user.email === 'lizzieshere1@gmail.com';
  let profileData: UserProfile;

  if (!userDoc.exists()) {
    profileData = {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || '사용자',
      photoURL: user.photoURL || undefined,
      role: isTeacherEmail ? 'teacher' : 'student',
      createdAt: Timestamp.now(),
      isNameSet: false
    };
    await setDoc(userDocRef, profileData);
  } else {
    profileData = userDoc.data() as UserProfile;
    // Force role update if needed
    if (isTeacherEmail && profileData.role !== 'teacher') {
      profileData.role = 'teacher';
      await setDoc(userDocRef, { role: 'teacher' }, { merge: true });
    }
  }

  // Background attendance check
  recordAttendance(user.uid).catch(e => console.error('Silent attendance failed:', e));

  return profileData;
}
