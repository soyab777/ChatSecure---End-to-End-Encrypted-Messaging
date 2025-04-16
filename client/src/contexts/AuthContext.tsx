import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Auth,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  getAuth
} from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  auth: Auth;
  currentUser: User | null;
  signup: (email: string, password: string) => Promise<UserCredential>;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  enrollMFA: (phoneNumber: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function signup(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  async function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    return signOut(auth);
  }

  async function enrollMFA(phoneNumber: string) {
    if (!currentUser) throw new Error('No user logged in');
    
    const multiFactorSession = await multiFactor(currentUser).getSession();
    const phoneAuthProvider = new PhoneAuthProvider(auth);
    
    const verificationId = await phoneAuthProvider.verifyPhoneNumber({
      phoneNumber,
      session: multiFactorSession
    });
    
    // Store the verificationId in localStorage for later use
    localStorage.setItem('mfaVerificationId', verificationId);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    auth,
    currentUser,
    signup,
    login,
    logout,
    enrollMFA
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
