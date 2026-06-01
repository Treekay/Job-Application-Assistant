import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";
import {
  forgotWorkflowPassword,
  loginWorkflowUser,
  registerWorkflowUser,
  resetWorkflowPassword,
  setWorkflowToken
} from "../api/workflowApi";
import type { WorkflowUser } from "../types/workflow";

type AuthMode = "login" | "register" | "forgot" | "reset";

export function AuthView({ onAuthenticated }: { onAuthenticated: (user: WorkflowUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        const payload = await loginWorkflowUser({ email, password });
        setWorkflowToken(payload.token);
        onAuthenticated(payload.user);
      }
      if (mode === "register") {
        const payload = await registerWorkflowUser({ email, password, displayName });
        setWorkflowToken(payload.token);
        onAuthenticated(payload.user);
      }
      if (mode === "forgot") {
        const payload = await forgotWorkflowPassword(email);
        setMessage(payload.message);
      }
      if (mode === "reset") {
        const payload = await resetWorkflowPassword({ token: resetToken, newPassword: password });
        setMessage(payload.message);
        setMode("login");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    }
  }

  return (
    <main className="workflowAuth">
      <section className="workflowPoster">
        <span>Job Application Workflow Platform</span>
        <h1>Track every target role from saved to outcome.</h1>
        <p>
          A .NET-backed productivity SaaS for applications, CVs, cover letters,
          reminders, match summaries, and interview deadlines.
        </p>
      </section>
      <form className="workflowAuthPanel" onSubmit={submit}>
        <div>
          <span>{mode}</span>
          <h2>{mode === "register" ? "Create account" : mode === "login" ? "Welcome back" : "Password help"}</h2>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        {mode === "register" ? (
          <label>
            Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
        ) : null}
        {mode === "reset" ? (
          <label>
            Reset token
            <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} required />
          </label>
        ) : null}
        {mode !== "forgot" ? (
          <label>
            Password
            <input
              value={password}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
        ) : null}
        <button type="submit">
          <Lock size={17} />
          {mode === "forgot" ? "Send reset email" : mode === "reset" ? "Reset password" : "Continue"}
        </button>
        {message ? <p className="workflowMessage">{message}</p> : null}
        {error ? <p className="workflowError">{error}</p> : null}
        <div className="authSwitches">
          <button type="button" onClick={() => setMode("login")}>Login</button>
          <button type="button" onClick={() => setMode("register")}>Register</button>
          <button type="button" onClick={() => setMode("forgot")}>Forgot</button>
          <button type="button" onClick={() => setMode("reset")}>Reset</button>
        </div>
      </form>
    </main>
  );
}
