import { create } from 'zustand';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface DoctorProfile {
  name: string;
  crm: string;
  uf: string;
  cpf: string;
  specialty: string;
  cbo?: string;
  phone?: string;
  email: string;
  rqe?: string;
  cnes?: string;
  signature?: string;
}

interface AuthState {
  user: User | null;
  profile: DoctorProfile | null;
  loading: boolean;
  init: () => () => void;
  updateProfile: (data: Partial<DoctorProfile>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  init: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        set({ user: null, profile: null, loading: false });
        return;
      }

      // Make authentication available to protected routes immediately.
      // Profile loading must never block a successful Firebase login.
      set({ user, loading: false });

      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        let profile: DoctorProfile;

        if (docSnap.exists()) {
          profile = docSnap.data() as DoctorProfile;
        } else {
          profile = {
            name: user.displayName || '',
            email: user.email || '',
            crm: '',
            uf: '',
            cpf: '',
            specialty: ''
          };
          await setDoc(docRef, profile);
        }

        set({ profile });
      } catch (err) {
        console.warn('Could not fetch doctor profile immediately from Firestore, using auth user info:', err);
        set({
          profile: {
            name: user.displayName || '',
            email: user.email || '',
            crm: '',
            uf: '',
            cpf: '',
            specialty: ''
          }
        });
      }
    });

    return unsubscribe;
  },
  updateProfile: async (data) => {
    const { user, profile } = get();
    if (!user) return;
    const newProfile = { ...profile, ...data } as DoctorProfile;
    await setDoc(doc(db, 'users', user.uid), newProfile, { merge: true });
    set({ profile: newProfile });
  },
  signOut: async () => {
    await auth.signOut();
  }
}));
