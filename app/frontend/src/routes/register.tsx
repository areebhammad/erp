/**
 * Register Page
 *
 * Handles new tenant + admin user registration with password strength
 * enforcement and GST validation.
 */

import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useAuthStore, useIsAuthenticated } from "@/store/auth";

// GST number regex (Indian GST format)
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Password requirements
const PASSWORD_REQUIREMENTS = {
	minLength: 12,
	hasUppercase: /[A-Z]/,
	hasLowercase: /[a-z]/,
	hasDigit: /[0-9]/,
	hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
};

// Validation schema - used for reference, actual validation done in form validators
// Schema kept for documentation purposes
// const registerSchema = z.object({
//     companyName: z.string().min(2, 'Company name must be at least 2 characters'),
//     fullName: z.string().min(2, 'Full name must be at least 2 characters'),
//     email: z.string().email('Please enter a valid email address'),
//     password: z.string().min(12, 'Password must be at least 12 characters'),
//     confirmPassword: z.string(),
//     gstin: z.string().optional(),
// }).refine((data) => data.password === data.confirmPassword, {
//     message: "Passwords don't match",
//     path: ['confirmPassword'],
// });

export const Route = createFileRoute("/register")({
	component: RegisterPage,
});

/**
 * Check password strength
 */
function checkPasswordStrength(password: string): {
	score: number;
	checks: {
		minLength: boolean;
		hasUppercase: boolean;
		hasLowercase: boolean;
		hasDigit: boolean;
		hasSpecial: boolean;
	};
} {
	const checks = {
		minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
		hasUppercase: PASSWORD_REQUIREMENTS.hasUppercase.test(password),
		hasLowercase: PASSWORD_REQUIREMENTS.hasLowercase.test(password),
		hasDigit: PASSWORD_REQUIREMENTS.hasDigit.test(password),
		hasSpecial: PASSWORD_REQUIREMENTS.hasSpecial.test(password),
	};

	const score = Object.values(checks).filter(Boolean).length;

	return { score, checks };
}

/**
 * Password strength indicator component
 */
function PasswordStrengthIndicator({ password }: { password: string }) {
	const { score, checks } = useMemo(
		() => checkPasswordStrength(password),
		[password],
	);

	const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
	const strengthColors = [
		"bg-red-500",
		"bg-orange-500",
		"bg-yellow-500",
		"bg-lime-500",
		"bg-green-500",
	];

	if (!password) return null;

	return (
		<div className="mt-2 space-y-2">
			{/* Strength bar */}
			<div className="flex gap-1">
				{[0, 1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className={cn(
							"h-1 flex-1 rounded-full transition-colors",
							i < score ? strengthColors[score - 1] : "bg-muted",
						)}
					/>
				))}
			</div>
			<p className="text-xs text-muted-foreground">
				Password strength: {strengthLabels[score - 1] || "Very Weak"}
			</p>

			{/* Requirements checklist */}
			<ul className="space-y-1 text-xs">
				<li
					className={cn(
						"flex items-center gap-1",
						checks.minLength ? "text-green-600" : "text-muted-foreground",
					)}
				>
					{checks.minLength ? (
						<Check className="h-3 w-3" />
					) : (
						<X className="h-3 w-3" />
					)}
					At least 12 characters
				</li>
				<li
					className={cn(
						"flex items-center gap-1",
						checks.hasUppercase ? "text-green-600" : "text-muted-foreground",
					)}
				>
					{checks.hasUppercase ? (
						<Check className="h-3 w-3" />
					) : (
						<X className="h-3 w-3" />
					)}
					One uppercase letter
				</li>
				<li
					className={cn(
						"flex items-center gap-1",
						checks.hasLowercase ? "text-green-600" : "text-muted-foreground",
					)}
				>
					{checks.hasLowercase ? (
						<Check className="h-3 w-3" />
					) : (
						<X className="h-3 w-3" />
					)}
					One lowercase letter
				</li>
				<li
					className={cn(
						"flex items-center gap-1",
						checks.hasDigit ? "text-green-600" : "text-muted-foreground",
					)}
				>
					{checks.hasDigit ? (
						<Check className="h-3 w-3" />
					) : (
						<X className="h-3 w-3" />
					)}
					One number
				</li>
				<li
					className={cn(
						"flex items-center gap-1",
						checks.hasSpecial ? "text-green-600" : "text-muted-foreground",
					)}
				>
					{checks.hasSpecial ? (
						<Check className="h-3 w-3" />
					) : (
						<X className="h-3 w-3" />
					)}
					One special character
				</li>
			</ul>
		</div>
	);
}

function RegisterPage() {
	const navigate = useNavigate();
	const { setUser } = useAuthStore();
	const isAuthenticated = useIsAuthenticated();

	// State
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/" });
		}
	}, [isAuthenticated, navigate]);

	// Registration form
	const form = useForm({
		defaultValues: {
			companyName: "",
			fullName: "",
			email: "",
			password: "",
			confirmPassword: "",
			gstin: "",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setIsSubmitting(true);

			// Check password strength
			const { score } = checkPasswordStrength(value.password);
			if (score < 5) {
				setError("Please ensure your password meets all requirements.");
				setIsSubmitting(false);
				return;
			}

			// Check password match
			if (value.password !== value.confirmPassword) {
				setError("Passwords don't match.");
				setIsSubmitting(false);
				return;
			}

			try {
				const apiClient = getApiClient();
				const response = await apiClient.post("/api/v1/auth/register", {
					company_name: value.companyName,
					full_name: value.fullName,
					email: value.email,
					password: value.password,
					gstin: value.gstin || undefined,
				});

				// Success - set auth and redirect to dashboard
				setUser(response.data.user, response.data.session_id);

				// Track registration event
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
					).posthog.capture("tenant_registered", { plan: "free" });
				}

				// TODO: Create onboarding route and redirect there
				navigate({ to: "/" });
			} catch (err) {
				if (err instanceof ApiError) {
					if (err.status === 409) {
						setError(
							"This email is already registered. Please log in or reset your password.",
						);
					} else if (err.status === 400) {
						setError(err.message || "Please check your input and try again.");
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

	// Get current password for strength indicator using form.Subscribe
	const [currentPassword, setCurrentPassword] = useState("");

	// Validators
	const validateRequired = (
		value: string,
		fieldName: string,
	): string | undefined => {
		if (!value || value.trim().length < 2) {
			return `${fieldName} must be at least 2 characters`;
		}
		return undefined;
	};

	const validateEmail = (value: string): string | undefined => {
		const result = z.string().email().safeParse(value);
		return result.success ? undefined : "Please enter a valid email address";
	};

	const validateGstin = (value: string): string | undefined => {
		if (!value) return undefined; // Optional field
		if (!GST_REGEX.test(value)) {
			return "Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)";
		}
		return undefined;
	};

	const validateConfirmPassword = (value: string): string | undefined => {
		if (value !== currentPassword) {
			return "Passwords don't match";
		}
		return undefined;
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<div className="w-full max-w-md space-y-8">
				{/* Logo/Header */}
				<div className="text-center">
					<h1 className="text-3xl font-bold tracking-tight">
						Create your account
					</h1>
					<p className="mt-2 text-muted-foreground">
						Start your free trial today
					</p>
				</div>

				{/* Error message */}
				{error && (
					<div
						className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
						role="alert"
						aria-live="polite"
					>
						<AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
						<div className="text-sm">
							<p>{error}</p>
							{error.includes("already registered") && (
								<a
									href={`/login?email=${encodeURIComponent(form.getFieldValue("email"))}`}
									className="mt-1 block text-primary underline"
								>
									Go to login
								</a>
							)}
						</div>
					</div>
				)}

				{/* Registration Form */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-5"
				>
					{/* Company Name */}
					<form.Field
						name="companyName"
						validators={{
							onChange: ({ value }) => validateRequired(value, "Company name"),
						}}
					>
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="companyName">Company name</Label>
								<Input
									id="companyName"
									type="text"
									autoComplete="organization"
									placeholder="Acme Inc."
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={
										field.state.meta.errors.length > 0 ? "true" : undefined
									}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive" role="alert">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>

					{/* Full Name */}
					<form.Field
						name="fullName"
						validators={{
							onChange: ({ value }) => validateRequired(value, "Full name"),
						}}
					>
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="fullName">Your full name</Label>
								<Input
									id="fullName"
									type="text"
									autoComplete="name"
									placeholder="John Doe"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={
										field.state.meta.errors.length > 0 ? "true" : undefined
									}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive" role="alert">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>

					{/* Email */}
					<form.Field
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
									aria-invalid={
										field.state.meta.errors.length > 0 ? "true" : undefined
									}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive" role="alert">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>

					{/* Password */}
					<form.Field name="password">
						{(field) => {
							// Update currentPassword state when field value changes
							if (field.state.value !== currentPassword) {
								setCurrentPassword(field.state.value);
							}
							return (
								<div className="space-y-2">
									<Label htmlFor="password">Password</Label>
									<div className="relative">
										<Input
											id="password"
											type={showPassword ? "text" : "password"}
											autoComplete="new-password"
											placeholder="••••••••••••"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className="pr-10"
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
									<PasswordStrengthIndicator password={field.state.value} />
								</div>
							);
						}}
					</form.Field>

					{/* Confirm Password */}
					<form.Field
						name="confirmPassword"
						validators={{
							onChange: ({ value }) => validateConfirmPassword(value),
						}}
					>
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirm password</Label>
								<div className="relative">
									<Input
										id="confirmPassword"
										type={showConfirmPassword ? "text" : "password"}
										autoComplete="new-password"
										placeholder="••••••••••••"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										className="pr-10"
										aria-invalid={
											field.state.meta.errors.length > 0 ? "true" : undefined
										}
									/>
									<button
										type="button"
										onClick={() => setShowConfirmPassword(!showConfirmPassword)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										aria-label={
											showConfirmPassword ? "Hide password" : "Show password"
										}
									>
										{showConfirmPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive" role="alert">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>

					{/* GST Number (Optional) */}
					<form.Field
						name="gstin"
						validators={{
							onChange: ({ value }) => validateGstin(value),
						}}
					>
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="gstin">
									GST Number{" "}
									<span className="text-muted-foreground">(optional)</span>
								</Label>
								<Input
									id="gstin"
									type="text"
									placeholder="22AAAAA0000A1Z5"
									value={field.state.value}
									onChange={(e) =>
										field.handleChange(e.target.value.toUpperCase())
									}
									onBlur={field.handleBlur}
									aria-invalid={
										field.state.meta.errors.length > 0 ? "true" : undefined
									}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive" role="alert">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>

					{/* Terms */}
					<p className="text-xs text-muted-foreground">
						By creating an account, you agree to our{" "}
						<a href="/terms" className="text-primary hover:underline">
							Terms of Service
						</a>{" "}
						and{" "}
						<a href="/privacy" className="text-primary hover:underline">
							Privacy Policy
						</a>
						.
					</p>

					{/* Submit button */}
					<Button
						type="submit"
						className="w-full"
						disabled={
							isSubmitting || checkPasswordStrength(currentPassword).score < 5
						}
					>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Creating account...
							</>
						) : (
							"Create account"
						)}
					</Button>

					{/* Login link */}
					<p className="text-center text-sm text-muted-foreground">
						Already have an account?{" "}
						<a href="/login" className="text-primary hover:underline">
							Sign in
						</a>
					</p>
				</form>
			</div>
		</div>
	);
}
