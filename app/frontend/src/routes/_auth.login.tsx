import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useState } from 'react';
import { z } from 'zod';
import { getMeApi, loginApi, verifyMfaApi } from '@/lib/api/auth';
import { getMyPermissionsApi } from '@/lib/api/permissions';
import { getCurrentTenantApi } from '@/lib/api/tenant';
import { useAuthStore } from '@/store/auth';
import { usePermissionsStore } from '@/store/permissions';
import { useTenantStore } from '@/store/tenant';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({
    session_expired: z.boolean().optional(),
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaRequestId, setMfaRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setUser = useAuthStore((s) => s.setUser);
  const setPermissions = usePermissionsStore((s) => s.setPermissions);
  const setTenant = useTenantStore((s) => s.setTenant);

  const fetchPostLoginData = async () => {
    try {
      const [user, perms, tenant] = await Promise.all([
        getMeApi(),
        getMyPermissionsApi(),
        getCurrentTenantApi(),
      ]);
      setUser(user, 'session-id'); // Extract session id appropriately if available
      setPermissions(
        perms.roles,
        new Set(perms.permissions),
        perms.featureFlags || {}
      );
      setTenant(tenant);

      // TODO: posthog.capture('user_logged_in', { method: 'password' })
      navigate({ to: '/dashboard' });
    } catch (e) {
      console.error('Failed to fetch post login data', e);
      setSubmitError('An error occurred during sign in. Please try again.');
    }
  };

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        const result = await loginApi(value);
        if (result.require_mfa) {
          setMfaRequired(true);
          setMfaRequestId(result.mfa_request_id);
        } else {
          await fetchPostLoginData();
        }
      } catch (e: any) {
        form.setFieldValue('password', '');
        setSubmitError(
          e?.response?.data?.message || 'Invalid email or password'
        );
      }
    },
  });

  const mfaForm = useForm({
    defaultValues: { code: '' },
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        await verifyMfaApi({ request_id: mfaRequestId, code: value.code });
        await fetchPostLoginData();
      } catch (e: any) {
        mfaForm.setFieldValue('code', '');
        setSubmitError(e?.response?.data?.message || 'Invalid or expired code');
      }
    },
  });

  return (
    <div className="w-full">
      <h3 className="text-xl font-semibold mb-6 text-text">
        Sign in to your account
      </h3>

      {search.session_expired && (
        <div className="mb-4 p-3 rounded bg-warning-subtle text-warning-foreground text-sm flex items-center gap-2">
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}

      <div aria-live="polite">
        {submitError && (
          <div className="mb-4 p-3 rounded bg-error/10 text-error-foreground text-sm flex items-center gap-2 border border-error/20">
            <span>{submitError}</span>
          </div>
        )}
      </div>

      {!mfaRequired ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field
            name="email"
            validators={{
              onChange: z.string().email('Please enter a valid email address'),
            }}
          >
            {(field) => (
              <div className="space-y-1">
                <label
                  className="text-sm font-medium text-text-subtle"
                  htmlFor={field.name}
                >
                  Email
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="email"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
                {field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-error">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: z.string().min(1, 'Password is required'),
            }}
          >
            {(field) => (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    className="text-sm font-medium text-text-subtle"
                    htmlFor={field.name}
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
                {field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-error">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <button
            type="submit"
            disabled={form.state.isSubmitting}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {form.state.isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mfaForm.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="text-sm text-text-subtle mb-4">
            Please enter the 6-digit authentication code from your authenticator
            app.
          </div>
          <mfaForm.Field
            name="code"
            validators={{
              onChange: z.string().length(6, 'Code must be exactly 6 digits'),
            }}
          >
            {(field) => (
              <div className="space-y-1">
                <label
                  className="text-sm font-medium text-text-subtle"
                  htmlFor={field.name}
                >
                  Authentication Code
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    const val = e.target.value
                      .replace(/[^0-9]/g, '')
                      .slice(0, 6);
                    field.handleChange(val);
                    if (val.length === 6) {
                      setTimeout(() => mfaForm.handleSubmit(), 100);
                    }
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full text-center tracking-widest text-2xl px-3 py-3 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                  placeholder="000000"
                />
                {field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-error text-center mt-1">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </mfaForm.Field>

          <button
            type="submit"
            disabled={mfaForm.state.isSubmitting}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mfaForm.state.isSubmitting ? 'Verifying...' : 'Verify'}
          </button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setMfaRequired(false)}
              className="text-xs text-text-subtle hover:text-text cursor-pointer hover:underline"
            >
              Return to initial login
            </button>
          </div>
        </form>
      )}

      {!mfaRequired && (
        <div className="mt-6 text-center text-sm">
          <span className="text-text-subtle">Don't have an account? </span>
          <Link
            to="/register"
            className="font-semibold text-primary hover:underline"
          >
            Register your company
          </Link>
        </div>
      )}
    </div>
  );
}
