/**
 * Login Page
 *
 * Handles user authentication with email/password and optional MFA.
 * Implements security best practices including rate limiting UI,
 * non-specific error messages, and accessibility.
 */

import { useForm } from "@tanstack/react-form";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore, useIsAuthenticated } from "@/store/auth";

// Validation schemas
const loginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

const mfaSchema = z.object({
	code: z.string().length(6, "Please enter a 6-digit code"),
});

// Search params type
interface LoginSearchParams {
	redirect?: string;
	session_expired?: string;
	email?: string;
}

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): LoginSearchParams => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
		session_expired:
			typeof search.session_expired === "string"
				? search.session_expired
				: undefined,
		email: typeof search.email === "string" ? search.email : undefined,
	}),
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/login" });
	const { setUser } = useAuthStore();
	const isAuthenticated = useIsAuthenticated();

	// State
	const [showPassword, setShowPassword] = useState(false);
	const [mfaRequired, setMfaRequired] = useState(false);
	const [mfaToken, setMfaToken] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLocked, setIsLocked] = useState(false);
	const [lockCountdown, setLockCountdown] = useState(0);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Refs
	const passwordRef = useRef<HTMLInputElement>(null);
	const mfaInputRef = useRef<HTMLInputElement>(null);

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: search.redirect || "/" });
		}
	}, [isAuthenticated, navigate, search.redirect]);

	// Lock countdown timer
	useEffect(() => {
		if (lockCountdown > 0) {
			const timer = setInterval(() => {
				setLockCountdown((prev) => {
					if (prev <= 1) {
						setIsLocked(false);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
			return () => clearInterval(timer);
		}
	}, [lockCountdown]);

	// Login form
	const loginForm = useForm({
		defaultValues: {
			email: search.email || "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setIsSubmitting(true);

			try {
				const apiClient = getApiClient();
				const response = await apiClient.post("/api/v1/auth/login", {
					email: value.email,
					password: value.password,
				});

				// Check if MFA is required
				if (response.data.mfa_required) {
					setMfaRequired(true);
					setMfaToken(response.data.mfa_token);
					// Focus MFA input after render
					setTimeout(() => mfaInputRef.current?.focus(), 100);
					setIsSubmitting(false);
					return;
				}

				// Success - set auth and redirect
				setUser(response.data.user, response.data.session_id);

				// Track login event
				if (
					typeof window !== "undefined" &&
					(
						window as unknown as {
							posthog?: {
								capture: (
									event: string,
									props: Record<string, unknown>,
								) => void;
							};
						}
					).posthog
				) {
					(
						window as unknown as {
							posthog: {
								capture: (
									event: string,
									props: Record<string, unknown>,
								) => void;
							};
						}
					).posthog.capture("user_logged_in", { method: "password" });
				}

				navigate({ to: search.redirect || "/" });
			} catch (err) {
				if (err instanceof ApiError) {
					if (err.status === 401) {
						setError("The email or password you entered is incorrect.");
						// Clear and focus password field
						loginForm.setFieldValue("password", "");
						passwordRef.current?.focus();
					} else if (err.status === 429 || err.status === 423) {
						setIsLocked(true);
						setLockCountdown(15 * 60); // 15 minutes
						setError(
							"Too many failed attempts. Your account has been temporarily locked. Please try again in 15 minutes or contact support.",
						);
					} else {
						setError("An unexpected error occurred. Please try again.");
					}
				} else {
					setError("An unexpected error occurred. Please try again.");
				}
			} finally {
				setIsSubmitting(false);
			}
		},
	});

	// MFA form
	const mfaForm = useForm({
		defaultValues: {
			code: "",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setIsSubmitting(true);

			try {
				const apiClient = getApiClient();
				const response = await apiClient.post("/api/v1/auth/mfa/verify", {
					mfa_token: mfaToken,
					totp_code: value.code,
				});

				// Success - set auth and redirect
				setUser(response.data.user, response.data.session_id);

				// Track login event
				if (
					typeof window !== "undefined" &&
					(
						window as unknown as {
							posthog?: {
								capture: (
									event: string,
									props: Record<string, unknown>,
								) => void;
							};
						}
					).posthog
				) {
					(
						window as unknown as {
							posthog: {
								capture: (
									event: string,
									props: Record<string, unknown>,
								) => void;
							};
						}
					).posthog.capture("user_logged_in", { method: "password_mfa" });
				}

				navigate({ to: search.redirect || "/" });
			} catch (err) {
				if (err instanceof ApiError) {
					if (err.status === 401) {
						setError("Invalid verification code. Please try again.");
						mfaForm.setFieldValue("code", "");
						mfaInputRef.current?.focus();
					} else if (err.status === 410) {
						setError(
							"Your verification session has expired. Please log in again.",
						);
						setMfaRequired(false);
						setMfaToken(null);
					} else {
						setError("An unexpected error occurred. Please try again.");
					}
				} else {
					setError("An unexpected error occurred. Please try again.");
				}
			} finally {
				setIsSubmitting(false);
			}
		},
	});

	const formatCountdown = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Validate email
	const validateEmail = (value: string): string | undefined => {
		const result = loginSchema.shape.email.safeParse(value);
		return result.success ? undefined : result.error.issues[0]?.message;
	};

	// Validate password
	const validatePassword = (value: string): string | undefined => {
		const result = loginSchema.shape.password.safeParse(value);
		return result.success ? undefined : result.error.issues[0]?.message;
	};

	// Validate MFA code
	const validateMfaCode = (value: string): string | undefined => {
		const result = mfaSchema.shape.code.safeParse(value);
		return result.success ? undefined : result.error.issues[0]?.message;
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md space-y-8">
				{/* Logo/Header */}
				<div className="text-center">
					<h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
					<p className="mt-2 text-muted-foreground">
						Sign in to your account to continue
					</p>
				</div>

				{/* Session expired banner */}
				{search.session_expired === "true" && (
					<div
						className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
						role="alert"
					>
						<Info className="h-5 w-5 flex-shrink-0" />
						<p className="text-sm">
							Your session has expired. Please sign in again.
						</p>
					</div>
				)}

				{/* Error message */}
				{error && (
					<div
						className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
						role="alert"
						aria-live="polite"
					>
						<AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
						<p className="text-sm">{error}</p>
					</div>
				)}

				{/* Login Form */}
				{!mfaRequired ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							loginForm.handleSubmit();
						}}
						className="space-y-6"
					>
						{/* Email field */}
						<loginForm.Field
							name="email"
							validators={{
								onChange: ({ value }) => validateEmail(value),
							}}
						>
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor="email">Email address</Label>
									<Input
										id="email"
										type="email"
										autoComplete="email"
										placeholder="you@company.com"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										disabled={isLocked}
										aria-invalid={
											field.state.meta.errors.length > 0 ? "true" : undefined
										}
										aria-describedby={
											field.state.meta.errors.length > 0
												? "email-error"
												: undefined
										}
									/>
									{field.state.meta.errors.length > 0 && (
										<p
											id="email-error"
											className="text-sm text-destructive"
											role="alert"
										>
											{field.state.meta.errors[0]}
										</p>
									)}
								</div>
							)}
						</loginForm.Field>

						{/* Password field */}
						<loginForm.Field
							name="password"
							validators={{
								onChange: ({ value }) => validatePassword(value),
							}}
						>
							{(field) => (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label htmlFor="password">Password</Label>
										<a
											href="/forgot-password"
											className="text-sm text-primary hover:underline"
										>
											Forgot password?
										</a>
									</div>
									<div className="relative">
										<Input
											ref={passwordRef}
											id="password"
											type={showPassword ? "text" : "password"}
											autoComplete="current-password"
											placeholder="••••••••"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											disabled={isLocked}
											className="pr-10"
											aria-invalid={
												field.state.meta.errors.length > 0 ? "true" : undefined
											}
											aria-describedby={
												field.state.meta.errors.length > 0
													? "password-error"
													: undefined
											}
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											aria-label={
												showPassword ? "Hide password" : "Show password"
											}
										>
											{showPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
									{field.state.meta.errors.length > 0 && (
										<p
											id="password-error"
											className="text-sm text-destructive"
											role="alert"
										>
											{field.state.meta.errors[0]}
										</p>
									)}
								</div>
							)}
						</loginForm.Field>

						{/* Submit button */}
						<Button
							type="submit"
							className="w-full"
							disabled={isLocked || isSubmitting}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Signing in...
								</>
							) : isLocked ? (
								`Locked (${formatCountdown(lockCountdown)})`
							) : (
								"Sign in"
							)}
						</Button>

						{/* Register link */}
						<p className="text-center text-sm text-muted-foreground">
							Don't have an account?{" "}
							<a href="/register" className="text-primary hover:underline">
								Create one
							</a>
						</p>
					</form>
				) : (
					/* MFA Form */
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							mfaForm.handleSubmit();
						}}
						className="space-y-6"
					>
						<div className="text-center">
							<h2 className="text-xl font-semibold">
								Two-factor authentication
							</h2>
							<p className="mt-2 text-sm text-muted-foreground">
								Enter the 6-digit code from your authenticator app
							</p>
						</div>

						<mfaForm.Field
							name="code"
							validators={{
								onChange: ({ value }) => validateMfaCode(value),
							}}
						>
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor="mfa-code" className="sr-only">
										Verification code
									</Label>
									<Input
										ref={mfaInputRef}
										id="mfa-code"
										type="text"
										inputMode="numeric"
										pattern="[0-9]*"
										maxLength={6}
										autoComplete="one-time-code"
										placeholder="000000"
										value={field.state.value}
										onChange={(e) => {
											const value = e.target.value.replace(/\D/g, "");
											field.handleChange(value);
										}}
										onBlur={field.handleBlur}
										className="text-center text-2xl tracking-widest"
										aria-invalid={
											field.state.meta.errors.length > 0 ? "true" : undefined
										}
										aria-describedby={
											field.state.meta.errors.length > 0
												? "mfa-error"
												: undefined
										}
									/>
									{field.state.meta.errors.length > 0 && (
										<p
											id="mfa-error"
											className="text-center text-sm text-destructive"
											role="alert"
										>
											{field.state.meta.errors[0]}
										</p>
									)}
								</div>
							)}
						</mfaForm.Field>

						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Verifying...
								</>
							) : (
								"Verify"
							)}
						</Button>

						<button
							type="button"
							onClick={() => {
								setMfaRequired(false);
								setMfaToken(null);
								setError(null);
							}}
							className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
						>
							← Back to login
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
