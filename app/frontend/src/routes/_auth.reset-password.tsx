import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useState } from 'react';
import { z } from 'zod';
import { resetPasswordApi } from '@/lib/api/auth';
import { useUIStore } from '@/store/ui';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: z.object({
    token: z.string().optional(),
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const addNotification = useUIStore((s) => s.addNotification);

  const form = useForm({
    defaultValues: {
      password: '',
      confirm_password: '',
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: z
        .object({
          password: z
            .string()
            .min(12, 'Password must be at least 12 characters'),
        })
        .and(
          z.object({
            password: z.string(),
            confirm_password: z.string(),
          })
        )
        .refine((data) => data.password === data.confirm_password, {
          message: "Passwords don't match",
          path: ['confirm_password'],
        }),
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      if (!search.token) {
        setLinkExpired(true);
        return;
      }
      try {
        await resetPasswordApi({
          token: search.token,
          new_password: value.password,
        });
        addNotification({
          id: Math.random().toString(36).substring(7),
          title: 'Success',
          message: 'Your password has been reset successfully. Please sign in.',
          type: 'success',
          timestamp: new Date().toISOString(),
          read: false,
        });
        navigate({ to: '/login' });
      } catch (e: any) {
        const resStatus = e?.response?.status;
        if (resStatus === 400 || resStatus === 410 || resStatus === 401) {
          setLinkExpired(true);
        } else {
          setSubmitError(
            e?.response?.data?.message || 'Failed to reset password'
          );
        }
      }
    },
  });

  if (linkExpired || !search.token) {
    return (
      <div className="w-full text-center">
        <h3 className="text-xl font-semibold mb-2 text-text">Link Expired</h3>
        <p className="text-sm text-text-subtle mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          to="/forgot-password"
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary inline-flex justify-center"
        >
          Request new link
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-xl font-semibold mb-6 text-text">
        Create new password
      </h3>

      <div aria-live="polite">
        {submitError && (
          <div className="mb-4 p-3 rounded bg-error/10 text-error-foreground text-sm flex items-center gap-2 border border-error/20">
            <span>{submitError}</span>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="password">
          {(field) => {
            const val = field.state.value;
            let strength = 0;
            if (val.length >= 12) strength++;
            if (/[A-Z]/.test(val)) strength++;
            if (/[a-z]/.test(val)) strength++;
            if (/[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;

            return (
              <div className="space-y-1">
                <label
                  className="text-sm font-medium text-text-subtle"
                  htmlFor={field.name}
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id={field.name}
                    name={field.name}
                    type={showPassword ? 'text' : 'password'}
                    value={val}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {val.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={`h-1 flex-1 rounded-full ${idx <= strength ? 'bg-primary' : 'bg-surface-overlay'}`}
                      ></div>
                    ))}
                  </div>
                )}
                {field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-error">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        <form.Field name="confirm_password">
          {(field) => (
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-text-subtle"
                htmlFor={field.name}
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id={field.name}
                  name={field.name}
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  title={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
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
          {form.state.isSubmitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
