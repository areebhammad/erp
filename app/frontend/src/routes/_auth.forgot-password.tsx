import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { forgotPasswordApi } from '@/lib/api/auth';

export const Route = createFileRoute('/_auth/forgot-password')({
    component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (countdown > 0) {
            interval = setInterval(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [countdown]);

    const form = useForm({
        defaultValues: { email: '' },
        validatorAdapter: zodValidator(),
        onSubmit: async ({ value }) => {
            try {
                await forgotPasswordApi(value);
            } catch (e) {
                // ALWAYS show success regardless of whether email exists or not
                console.error(e);
            }
            setSuccess(true);
            setCountdown(60);
        },
    });

    return (
        <div className="w-full">
            <h3 className="text-xl font-semibold mb-2 text-text">Reset your password</h3>
            <p className="text-sm text-text-subtle mb-6">Enter your email address to receive password reset instructions.</p>

            {success && (
                <div className="mb-6 p-4 rounded bg-success/10 text-success-foreground border border-success/20 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mb-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <p className="font-semibold text-sm">Check your inbox</p>
                    <p className="text-xs opacity-90 mt-1">If an account exists for that email, we've sent reset instructions.</p>
                </div>
            )}

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
                            <label className="text-sm font-medium text-text-subtle" htmlFor={field.name}>
                                Email address
                            </label>
                            <input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                type="email"
                                disabled={countdown > 0}
                                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text disabled:opacity-60"
                                placeholder="name@example.com"
                                autoComplete="email"
                                autoFocus
                            />
                            {field.state.meta.errors.length > 0 ? (
                                <p className="text-xs text-error">{field.state.meta.errors[0]}</p>
                            ) : null}
                        </div>
                    )}
                </form.Field>

                <button
                    type="submit"
                    disabled={form.state.isSubmitting || countdown > 0}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {form.state.isSubmitting ? 'Sending disabled...' : countdown > 0 ? `Resend email in ${countdown}s` : 'Send Reset Link'}
                </button>
            </form>

            <div className="mt-6 text-center text-sm">
                <span className="text-text-subtle">Remembered your password? </span>
                <Link to="/login" className="font-semibold text-primary hover:underline">
                    Sign In
                </Link>
            </div>
        </div>
    );
}
