import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Branding State
    const [branding, setBranding] = useState({
        title: 'Eastern WordTest',
        subtitle: '이스턴 영어 공부방'
    });

    useEffect(() => {
        const fetchBranding = async () => {
            const params = new URLSearchParams(location.search);
            const academyId = params.get('academy') || localStorage.getItem('academyId');

            if (academyId) {
                try {
                    const docRef = doc(db, 'academies', academyId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.settings) {
                            setBranding({
                                title: data.settings.loginTitle || 'Eastern WordTest',
                                subtitle: data.settings.loginSubtitle || '이스턴 영어 공부방'
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error fetching branding:", error);
                }
            }
        };
        fetchBranding();
    }, [location]);

    const getEmail = (id) => {
        return id.includes('@') ? id : `${id}@wordtest.com`;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const email = getEmail(username);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            let userData;

            if (userDoc.exists()) {
                userData = userDoc.data();
            } else {
                // Auto-recover: Create missing Firestore document
                userData = {
                    username: email,
                    name: email.split('@')[0],
                    role: 'student', // Default to student
                    createdAt: new Date().toISOString(),
                    current_word_index: 0,
                    words_per_session: 10,
                    book_name: '기본',
                    study_days: '1,2,3,4,5',
                    academyId: 'academy_default' // Default academy for recovered users
                };
            }

            // Special case for the developer/owner to get admin access if needed
            if (email.includes('stp282')) {
                userData.role = 'super_admin'; // Grant Super Admin
                // Ensure this is updated in Firestore
                await setDoc(doc(db, 'users', user.uid), { role: 'super_admin' }, { merge: true });
            }

            // If it was a new user, save the full data
            if (!userDoc.exists()) {
                await setDoc(doc(db, 'users', user.uid), userData);
            }

            localStorage.setItem('token', await user.getIdToken());
            localStorage.setItem('role', userData.role);
            localStorage.setItem('username', userData.username);
            localStorage.setItem('name', userData.name);
            localStorage.setItem('userId', user.uid);
            localStorage.setItem('academyId', userData.academyId || 'academy_default');

            if (userData.role === 'admin') {
                navigate('/admin');
            } else if (userData.role === 'super_admin') {
                navigate('/super-admin');
            } else {
                // Update last_login for students
                if (userDoc.exists()) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        last_login: new Date().toISOString().split('T')[0]
                    });
                }
                navigate('/student');
            }
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('아이디 또는 비밀번호가 올바르지 않습니다.');
            } else {
                setError('로그인 중 오류가 발생했습니다: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
            <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-2xl shadow-xl">
                <div className="flex flex-col items-center mb-2">
                    <div className="mb-6 text-center transform hover:scale-105 transition-transform duration-300">
                        <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tighter mb-2 drop-shadow-sm">
                            {branding.title}
                        </h1>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-600 tracking-wide">
                            {branding.subtitle}
                        </h2>
                    </div>
                    <p className="text-gray-500 text-sm">
                        로그인하여 학습을 시작하세요.
                    </p>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">아이디</label>
                        <input
                            type="text"
                            required
                            placeholder="예: student1"
                            className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                        <input
                            type="password"
                            required
                            placeholder="비밀번호 입력"
                            className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all font-medium flex justify-center items-center"
                    >
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>
            </div>
        </div>
    );
}
