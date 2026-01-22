'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService, AuthChallenge } from '../lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const authService = AuthService.getInstance();
      const result = await authService.login(username, password);
      
      if (result.success) {
        // Redirect to home page on success
        router.push('/');
      } else if (result.challenge) {
        // Show password change form
        setChallenge(result.challenge);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password requirements
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number');
      return;
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setError('Password must contain at least one special character');
      return;
    }

    setLoading(true);

    try {
      const authService = AuthService.getInstance();
      await authService.completeNewPasswordChallenge(newPassword, challenge!.session);
      
      // Redirect to home page on success
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set new password.');
    } finally {
      setLoading(false);
    }
  };

  // Password change form
  if (challenge?.challengeName === 'NEW_PASSWORD_REQUIRED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-yellow-100 rounded-full mb-4">
              <span className="text-4xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Set New Password</h1>
            <p className="text-gray-600">Please create a new password to continue</p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Enter new password"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Confirm new password"
                required
                disabled={loading}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Password Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>At least 8 characters</li>
                <li>Uppercase letter (A-Z)</li>
                <li>Lowercase letter (a-z)</li>
                <li>Number (0-9)</li>
                <li>Special character (!@#$%^&*)</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Setting password...
                </span>
              ) : (
                'Set Password & Continue'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setNewPassword('');
                setConfirmPassword('');
                setError('');
              }}
              className="w-full text-gray-600 py-2 text-sm hover:text-gray-800 transition"
            >
              ← Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">NASWA Assistant</h1>
          <p className="text-gray-600">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your username"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
