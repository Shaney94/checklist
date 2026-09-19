"use client";
import { useState, type FormEvent } from "react";
import Dialog from "../../components/Dialog";
import type { User } from "./types";
import { request, message } from "./api";
export default function Account({ user }: { user: User }) {
  const [mode, setMode] = useState<"account" | "invite" | "sent" | null>(null),
    [email, setEmail] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  function open(mode: "account" | "invite") {
    setMode(mode);
    setStatus("");
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const result = await request<{ sent: boolean }>("/api/account", {
        action: "invite",
        email: email.trim(),
      });
      if (!result.sent) throw Error("Invitation could not be confirmed.");
      setMode("sent");
      setEmail("");
    } catch (e) {
      setStatus(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await request("/api/account", { action: "logout" });
      try {
        localStorage.setItem("turnli-signout", String(Date.now()));
      } catch {}
      document.body.classList.add("session-checking");
      location.replace("/");
    } catch (e) {
      setStatus(message(e));
      setBusy(false);
    }
  }
  return (
    <>
      <div className="header-account">
        {user.canInvite && (
          <button
            className="back invite-customers"
            onClick={() => open("invite")}
          >
            Invite customers
          </button>
        )}
        <button
          className="back profile-button"
          title={user.email}
          aria-label={"Signed in as " + user.email + ". View account"}
          onClick={() => open("account")}
        >
          <span className="profile-avatar" aria-hidden="true">
            {user.email[0].toUpperCase()}
          </span>
          <span>Account</span>
        </button>
      </div>
      <Dialog
        id="accountDialog"
        title={
          mode === "invite"
            ? "Invite a customer"
            : mode === "sent"
              ? "Invitation sent"
              : "Your account"
        }
        open={!!mode}
        onClose={() => setMode(null)}
      >
        {mode === "invite" ? (
          <form onSubmit={invite}>
            <label className="field">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="off"
                required
                placeholder="customer@email.com"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              Send invite
            </button>
          </form>
        ) : (
          <div id="accountSuccess">
            <p>
              {mode === "sent"
                ? "Your customer will receive an email inviting them to join Turnli."
                : "Signed in as " + user.email + "."}
            </p>
            <a href="/?reset=1&next=%2Fapp">Set or change password</a>
          </div>
        )}
        <p role="status">{status}</p>
        <div className="dialog-actions">
          <button className="back" onClick={() => setMode(null)}>
            Close
          </button>
          <button
            className="back"
            disabled={busy}
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </Dialog>
    </>
  );
}
