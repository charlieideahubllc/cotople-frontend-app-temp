"use client";

// Requirements: AUTH-0001 AC1, AC3, AC4, AC5; AUTH-0004 AC1, AC2 (flash message display)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { SESSION_EXPIRED_STORAGE_KEY } from "@/lib/api/session-expired";

// Single generic message for any sign-in failure — never reveal whether the
// email exists (AUTH-0001 AC3).
const GENERIC_ERROR = "Invalid email or password. Please try again.";

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // AUTH-0004 AC1: show the session-expired message set by the shared API
  // interceptor (src/lib/api/session-expired.ts), then clear it so it only
  // shows once. Read must happen post-mount, not via a lazy useState
  // initializer, because sessionStorage doesn't exist during the server
  // render — reading it in the initializer would produce a client/server
  // markup mismatch on hydration.
  useEffect(() => {
    const message = window.sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY);
    if (message) {
      // One-time read of a browser-only storage value at mount, not a state-sync loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlashMessage(message);
      window.sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY);
    }
  }, []);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = "Enter your email.";
    }
    if (!password) {
      errors.password = "Enter your password.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    // AUTH-0001 AC4: block submission client-side on empty fields, no
    // network call to Supabase in that case.
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      setFormError(GENERIC_ERROR);
      return;
    }

    router.push(redirectTo);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {flashMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {flashMessage}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
