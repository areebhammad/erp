import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { useState } from 'react';
import { z } from 'zod';
import { registerApi } from '@/lib/api/auth';

export const Route = createFileRoute('/_auth/register')({
    component: RegisterPage,
});

function RegisterPage() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const form = useForm({
        defaultValues: {
            company_name: '',
            full_name: '',
            email: '',
            gstin: '',
            password: '',
            confirm_password: '',
        },
        validatorAdapter: zodValidator(),
        validators: {
            onChange: z.object({
                company_name: z.string().min(1, 'Company Name is required'),
                full_name: z.string().min(1, 'Full Name is required'),
                email: z.string().email('Please enter a valid email address'),
                gstin: z.string().optional().refine(v => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v), 'Invalid GSTIN format'),
                password: z.string().min(12, 'Password must be at least 12 characters'),
            }).and(z.object({
                company_name: z.string(),
                full_name: z.string(),
                email: z.string(),
                gstin: z.string().optional(),
                password: z.string(),
                confirm_password: z.string(),
            })).refine(data => data.password === data.confirm_password, {
                message: "Passwords don't match",
                path: ["confirm_password"],
            }),
        },
        onSubmit: async ({ value }) => {
            setSubmitError(null);
            try {
                await registerApi(value);
                // TODO: posthog.capture('tenant_registered');
                navigate({ to: '/dashboard' }); // Mocking onboarding for now
            } catch (e: any) {
                setSubmitError(e?.response?.data?.message || 'Failed to register');
            }
        },
    });

    return (
        <div className="w-full">
            <h3 className="text-xl font-semibold mb-6 text-text">Register your company</h3>

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
                <form.Field name="company_name">
                    {(field) => (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-text-subtle" htmlFor={field.name}>Company Name</label>
                            <input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                autoFocus
                                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                                placeholder="Acme Corp"
                            />
                            {field.state.meta.errors.length > 0 ? (
                                <p className="text-xs text-error">{field.state.meta.errors[0]}</p>
                            ) : null}
                        </div>
                    )}
                </form.Field>

                <form.Field name="full_name">
                    {(field) => (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-text-subtle" htmlFor={field.name}>Full Name</label>
                            <input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                                placeholder="Jane Doe"
                            />
                            {field.state.meta.errors.length > 0 ? (
                                <p className="text-xs text-error">{field.state.meta.errors[0]}</p>
                            ) : null}
                        </div>
                    )}
                </form.Field>

                <form.Field name="email">
                    {(field) => (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-text-subtle" htmlFor={field.name}>Email address</label>
                            <input
                                id={field.name}
                                name={field.name}
                                type="email"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text"
                                placeholder="jane@example.com"
                            />
                            {field.state.meta.errors.length > 0 ? (
                                <p className="text-xs text-error">{field.state.meta.errors[0]}</p>
                            ) : null}
                        </div>
                    )}
                </form.Field>

                <form.Field name="gstin">
                    {(field) => (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-text-subtle" htmlFor={field.name}>GSTIN (Optional)</label>
                            <input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface text-text uppercase"
                                placeholder="22AAAAA0000A1Z5"
                            />
                            {field.state.meta.errors.length > 0 ? (
                                <p className="text-xs text-error">{field.state.meta.errors[0]}</p>
                            ) : null}
                        </div>
                    )}
                </form.Field>

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
                                <label className="text-sm font-medium text-text-subtle" htmlFor={field.name}>Password</label>
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
                                        title={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text cursor-pointer"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                {val.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                        {[1, 2, 3, 4, 5].map(idx => (
                                            <div key={idx} className={`h-1 flex-1 rounded-full ${idx <= strength ? 'bg-primary' : 'bg-surface-overlay'}`}></div>
                                        ))}
                                    </div>
                                )}
                                {field.state.meta.errors.length > 0 ? (
                                    <p className="text-xs text-error">{field.state.meta.errors[0]}</p>
                                ) : null}
                            </div>
                        );
                    }}
                </form.Field>

                <form.Field name="confirm_password">
                    {(field) => (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-text-subtle" htmlFor={field.name}>Confirm Password</label>
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
                                    title={showConfirmPassword ? "Hide password" : "Show password"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text cursor-pointer"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            {field.state.meta.errors.length > 0 ? (
                                <p className="text-xs text-error">{field.state.meta.errors[0]}</p>
                            ) : null}
                        </div>
                    )}
                </form.Field>

                <button
                    type="submit"
                    disabled={form.state.isSubmitting}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {form.state.isSubmitting ? 'Registering...' : 'Register'}
                </button>
            </form>

            <div className="mt-6 text-center text-sm">
                <span className="text-text-subtle">Already have an account? </span>
                <Link to="/login" className="font-semibold text-primary hover:underline">
                    Sign In
                </Link>
            </div>
        </div>
    );
}
