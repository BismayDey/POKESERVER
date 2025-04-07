import { create } from 'zustand';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface UserProfile {
  uid: string;
  email: string;
  username: string;
  wins: number;
  losses: number;
  pokemonHealth: { [key: string]: number };
  battleHistory: {
    date: string;
    opponent: string;
    result: 'win' | 'loss';
    pokemon: string;
  }[];
  favoritePokemons: string[];
  totalBattles: number;
  winStreak: number;
  highestWinStreak: number;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updatePokemonHealth: (pokemonId: string, health: number) => Promise<void>;
  addBattleResult: (result: { opponent: string; result: 'win' | 'loss'; pokemon: string }) => Promise<void>;
  addFavoritePokemon: (pokemonName: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  signUp: async (email: string, password: string, username: string) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        username,
        wins: 0,
        losses: 0,
        pokemonHealth: {},
        battleHistory: [],
        favoritePokemons: [],
        totalBattles: 0,
        winStreak: 0,
        highestWinStreak: 0
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      set({ user, profile, error: null });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      const profile = docSnap.data() as UserProfile;
      set({ user, profile, error: null });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email!,
          username: user.displayName || 'Trainer',
          wins: 0,
          losses: 0,
          pokemonHealth: {},
          battleHistory: [],
          favoritePokemons: [],
          totalBattles: 0,
          winStreak: 0,
          highestWinStreak: 0
        };
        await setDoc(docRef, profile);
        set({ user, profile, error: null });
      } else {
        const profile = docSnap.data() as UserProfile;
        set({ user, profile, error: null });
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      set({ user: null, profile: null, error: null });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updateProfile: async (data: Partial<UserProfile>) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    try {
      const updatedProfile = { ...profile, ...data };
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      set({ profile: updatedProfile });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updatePokemonHealth: async (pokemonId: string, health: number) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    try {
      const updatedHealth = { ...profile.pokemonHealth, [pokemonId]: health };
      await updateDoc(doc(db, 'users', user.uid), {
        pokemonHealth: updatedHealth
      });
      set({ profile: { ...profile, pokemonHealth: updatedHealth } });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  addBattleResult: async (result: { opponent: string; result: 'win' | 'loss'; pokemon: string }) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    try {
      const battleEntry = {
        ...result,
        date: new Date().toISOString()
      };

      const winStreak = result.result === 'win' ? profile.winStreak + 1 : 0;
      const highestWinStreak = Math.max(winStreak, profile.highestWinStreak);

      await updateDoc(doc(db, 'users', user.uid), {
        battleHistory: arrayUnion(battleEntry),
        [result.result === 'win' ? 'wins' : 'losses']: profile[result.result === 'win' ? 'wins' : 'losses'] + 1,
        totalBattles: profile.totalBattles + 1,
        winStreak,
        highestWinStreak
      });

      set({
        profile: {
          ...profile,
          battleHistory: [...profile.battleHistory, battleEntry],
          [result.result === 'win' ? 'wins' : 'losses']: profile[result.result === 'win' ? 'wins' : 'losses'] + 1,
          totalBattles: profile.totalBattles + 1,
          winStreak,
          highestWinStreak
        }
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  addFavoritePokemon: async (pokemonName: string) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    try {
      const updatedFavorites = [...profile.favoritePokemons, pokemonName];
      await updateDoc(doc(db, 'users', user.uid), {
        favoritePokemons: updatedFavorites
      });
      set({ profile: { ...profile, favoritePokemons: updatedFavorites } });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  }
}));

// Initialize auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    const profile = docSnap.data() as UserProfile;
    useAuthStore.setState({ user, profile, loading: false });
  } else {
    useAuthStore.setState({ user: null, profile: null, loading: false });
  }
});