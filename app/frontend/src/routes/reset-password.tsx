/**
 * Reset Password Page
 *
 * Allows users to set a new password using a reset token from email.
 */

import { useForm } from "@tanstack/react-form";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Check,
	Eye,
	EyeOff,
	Loader2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

// Password requirements (same as register)
const PASSWORD_REQUIREMENTS = {
	minLength: 12,
	hasUppercase: /[A-Z]/,
	hasLowercase: /[a-z]/,
	hasDigit: /[0-9]/,
	hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
};

interface ResetPasswordSearchParams {
	token?: string;
}

export const Route = createFileRoute("/reset-password")({
	validateSearch: (
		search: Record<string, unknown>,
	): ResetPasswordSearchParams => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	component: ResetPasswordPage,
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

function ResetPasswordPage() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/reset-password" });
	const token = search.token;

	// State
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");

	// Form - must be called before any early returns (React hooks rules)
	const form = useForm({
		defaultValues: {
			password: "",
			confirmPassword: "",
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
				await apiClient.post("/api/v1/auth/reset-password", {
					token,
					password: value.password,
				});

				// Success - redirect to login with success message
				navigate({
					to: "/login",
					search: {
						redirect: undefined,
						session_expired: undefined,
						email: undefined,
					},
				});

				// Show toast (would need toast system)
				// For now, we'll rely on the login page to show a success message
			} catch (err) {
				if (err instanceof ApiError) {
					if (err.status === 400 || err.status === 410) {
						setError(
							"This reset link has expired or already been used. Please request a new one.",
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

	// Validators
	const validateConfirmPassword = (value: string): string | undefined => {
		if (value !== currentPassword) {
			return "Passwords don't match";
		}
		return undefined;
	};

	// No token - show error (after all hooks are called)
	if (!token) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<div className="w-full max-w-md space-y-8 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
						<AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">
							Invalid reset link
						</h1>
						<p className="mt-2 text-muted-foreground">
							This password reset link is invalid or missing. Please request a
							new one.
						</p>
					</div>
					<Link to="/forgot-password">
						<Button className="w-full">Request new reset link</Button>
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md space-y-8">
				{/* Header */}
				<div className="text-center">
					<h1 className="text-3xl font-bold tracking-tight">
						Reset your password
					</h1>
					<p className="mt-2 text-muted-foreground">
						Enter your new password below
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
							{error.includes("expired") && (
								<Link
									to="/forgot-password"
									className="mt-1 block text-primary underline"
								>
									Request a new reset link
								</Link>
							)}
						</div>
					</div>
				)}

				{/* Form */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-6"
				>
					{/* Password */}
					<form.Field name="password">
						{(field) => {
							if (field.state.value !== currentPassword) {
								setCurrentPassword(field.state.value);
							}
							return (
								<div className="space-y-2">
									<Label htmlFor="password">New password</Label>
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
								<Label htmlFor="confirmPassword">Confirm new password</Label>
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
								Resetting password...
							</>
						) : (
							"Reset password"
						)}
					</Button>

					<Link
						to="/login"
						className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to login
					</Link>
				</form>
			</div>
		</div>
	);
}
