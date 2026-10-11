import { useState, type FormEvent } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { BrandMark } from "./BrandMark";
import { PitchLines } from "./PitchLines";
import { sendResetLink, signIn } from "./auth.service";
import { friendlyAuthError, validateLogin, type LoginErrors } from "./validation";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    setFormError(null);
    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      await signIn(email, password);
      // On success the auth listener moves the person on, so there is nothing more to do here.
    } catch (error) {
      setFormError(friendlyAuthError((error as { code?: string }).code));
      setSubmitting(false);
    }
  }

  async function onForgotPassword() {
    setFormError(null);
    setNotice(null);
    const errors = validateLogin(email, "x");
    if (errors.email) {
      setFieldErrors({ email: "Enter your email above, then choose “Forgot password?”." });
      return;
    }
    setFieldErrors({});
    try {
      await sendResetLink(email);
    } catch (error) {
      const code = (error as { code?: string }).code;
      // Anything except a connection problem gets the same answer, so the page never reveals which emails have accounts.
      if (code === "auth/network-request-failed" || code === "auth/too-many-requests") {
        setFormError(friendlyAuthError(code));
        return;
      }
    }
    setNotice("If an account exists for that email, a password reset link is on its way.");
  }

  return (
    <main className="grid min-h-screen bg-page lg:grid-cols-[1fr_1.35fr]">
      {/* Brand panel: desktop only */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-8 text-white lg:flex">
        <PitchLines />
        <p className="relative text-sm font-semibold">Palace Sports</p>
        <h2 className="relative max-w-xs text-4xl font-bold leading-tight">Run every pitch with confidence.</h2>
        <p className="relative text-xs">Internal staff portal</p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <BrandMark />
            <p className="text-lg font-semibold">Palace Sports</p>
          </div>

          <Card className="w-full p-6 sm:p-8">
            <h1 className="text-heading font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Sign in to manage today’s pitches.</p>

            <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={fieldErrors.email}
              />
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="flex size-8 items-center justify-center rounded-md text-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                }
              />

              {formError ? (
                <div role="alert" className="flex items-center gap-2 rounded-lg bg-danger-tint px-3 py-2.5 text-xs text-danger">
                  <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                  {formError}
                </div>
              ) : null}
              {notice ? (
                <div role="status" className="rounded-lg bg-sidebar px-3 py-2.5 text-xs text-primary">
                  {notice}
                </div>
              ) : null}

              <Button type="submit" loading={submitting} className="w-full">
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button type="button" onClick={() => void onForgotPassword()} className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </button>
            </div>
            <p className="mt-6 text-center text-xs text-muted">Internal staff portal · AED</p>
          </Card>
        </div>
      </section>
    </main>
  );
}
