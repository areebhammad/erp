/**
 * Forgot Password Page
 *
 * Allows users to request a password reset link via email.
 * Implements security best practices with non-specific responses.
 */

import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	// State
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [cooldownSeconds, setCooldownSeconds] = useState(0);

	// Cooldown timer
	useEffect(() => {
		if (cooldownSeconds > 0) {
			const timer = setInterval(() => {
				setCooldownSeconds((prev) => prev - 1);
			}, 1000);
			return () => clearInterval(timer);
		}
	}, [cooldownSeconds]);

	// Form
	const form = useForm({
		defaultValues: {
			email: "",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setIsSubmitting(true);

			try {
				const apiClient = getApiClient();
				await apiClient.post("/api/v1/auth/forgot-password", {
					email: value.email,
				});

				// Always show success message (security: don't reveal if email exists)
				setIsSuccess(true);
				setCooldownSeconds(60); // 60 second cooldown
			} catch (err) {
				// Even on error, show success message for security
				// Only show actual error for network/server issues
				if (err instanceof ApiError && err.status >= 500) {
					setError("An unexpected error occurred. Please try again later.");
				} else {
					// For 4xx errors, still show success (security)
					setIsSuccess(true);
					setCooldownSeconds(60);
				}
			} finally {
				setIsSubmitting(false);
			}
		},
	});

	// Validate email
	const validateEmail = (value: string): string | undefined => {
		const result = z.string().email().safeParse(value);
		return result.success ? undefined : "Please enter a valid email address";
	};

	// Success state
	if (isSuccess) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<div className="w-full max-w-md space-y-8 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
						<CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">
							Check your email
						</h1>
						<p className="mt-2 text-muted-foreground">
							If this email is registered, you will receive a reset link
							shortly.
						</p>
					</div>
					<div className="space-y-4">
						<Button
							variant="outline"
							className="w-full"
							disabled={cooldownSeconds > 0}
							onClick={() => {
								setIsSuccess(false);
								form.reset();
							}}
						>
							{cooldownSeconds > 0
								? `Resend available in ${cooldownSeconds}s`
								: "Send another link"}
						</Button>
						<Link
							to="/login"
							className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to login
						</Link>
					</div>
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
						Forgot password?
					</h1>
					<p className="mt-2 text-muted-foreground">
						Enter your email and we'll send you a reset link
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
						<p className="text-sm">{error}</p>
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

					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Sending...
							</>
						) : (
							"Send reset link"
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
