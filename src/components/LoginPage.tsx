import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Lock, Plane } from 'lucide-react';
import { DEFAULT_DESIGNATION, DESIGNATION_OPTIONS } from '../data/seed';
import {
  LocalUserRecord,
  loginLocalUser,
  registerLocalUser,
} from '../services/localDb';

interface LoginPageProps {
  onAuthenticated: (user: LocalUserRecord) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState<string>(DEFAULT_DESIGNATION);
  const [email, setEmail] = useState('');
  const [station, setStation] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        const user = await loginLocalUser(identifier, password);
        onAuthenticated(user);
      } else {
        const user = await registerLocalUser({
          name: fullName,
          designation,
          email,
          station,
          employeeId,
          password,
        });
        onAuthenticated(user);
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : 'Unable to sign in.'
      );
      setSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setMode('signin');
    setIdentifier('raghav.it@aai.aero');
    setPassword('AAI@2026');
    setErrorMsg('');
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-md items-center gap-2.5 pt-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-900 text-white">
          <Plane className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
          AAI Desk — Project Tracker
        </span>
      </div>

      <main className="mx-auto my-auto w-full max-w-md py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-7 sm:p-8">
          <p className="text-xs font-medium text-slate-500">
            Airports Authority of India · IT Division
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
            {mode === 'signin' ? 'Sign in to your workspace' : 'Create executive account'}
          </h1>

          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mt-6 grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
              }}
              className={`rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'signin' ? (
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-medium text-slate-700"
                >
                  Email or Employee ID
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="raghav.it@aai.aero"
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                />
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="reg-name"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    autoFocus
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Ananya Sharma"
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-designation"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Designation
                  </label>
                  <select
                    id="reg-designation"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                  >
                    {DESIGNATION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Work Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@aai.aero"
                    className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="reg-station"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Airport / Station
                    </label>
                    <input
                      id="reg-station"
                      type="text"
                      value={station}
                      onChange={(e) => setStation(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-emp-id"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Employee ID
                    </label>
                    <input
                      id="reg-emp-id"
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-700"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signin' ? 'Enter password' : 'Minimum 6 characters'}
                  className="w-full rounded-md border border-slate-300 py-2 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
            >
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {submitting
                  ? mode === 'signin'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account & Sign In'}
              </span>
            </button>
          </form>

          {mode === 'signin' && (
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <span>
                Default login:{' '}
                <span className="font-mono text-slate-700">raghav.it@aai.aero</span>
              </span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="font-medium text-blue-900 hover:underline whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded"
              >
                Use default
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-md pb-2 text-xs text-slate-400">
        AAI Desk — Project Tracker · Stored locally in your browser database
      </footer>
    </div>
  );
}
