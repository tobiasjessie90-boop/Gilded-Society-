"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AgentResult, AgentService } from "../../src/agent/types";

type Health = Record<string, { ok: boolean; detail?: string }>;

const services: AgentService[] = ["notion", "github", "slack", "supabase", "openai"];

export default function AgentConsole() {
  const [service, setService] = useState<AgentService>("notion");
  const [action, setAction] = useState("product.read");
  const [target, setTarget] = useState("");
  const [approvalId, setApprovalId] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [health, setHealth] = useState<Health>({});
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/agent/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("Health request failed");
        return response.json() as Promise<Health>;
      })
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setError("Integration health could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const approvalState = useMemo(() => {
    if (!result) return "No request yet";
    if (result.status === "pending_approval") return "Approval required";
    if (approvalId) return "Approval supplied";
    return "No approval required";
  }, [approvalId, result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          action: action.trim(),
          service,
          target: target.trim() || undefined,
          input: {},
          requestedBy: "dashboard-user",
          dryRun,
          approvalId: approvalId.trim() || undefined,
        }),
      });

      const body = (await response.json()) as AgentResult & { errorCode?: string; message?: string };
      if (!response.ok && !body.status) {
        throw new Error(body.message || "Agent request failed");
      }
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>THE GILDED SOCIETY · PRODUCT FACTORY</p>
        <h1 style={styles.title}>API Agent Helper</h1>
        <p style={styles.subtitle}>
          Route controlled actions through verified connectors. Consequential changes pause for approval before execution.
        </p>
      </section>

      <div style={styles.grid}>
        <section style={styles.panel}>
          <h2 style={styles.heading}>Command</h2>
          <form onSubmit={submit} style={styles.form}>
            <label style={styles.label}>
              Service
              <select value={service} onChange={(event) => setService(event.target.value as AgentService)} style={styles.input}>
                {services.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label style={styles.label}>
              Action
              <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="product.read" style={styles.input} required />
            </label>

            <label style={styles.label}>
              Project / target
              <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Notion page ID" style={styles.input} />
            </label>

            <label style={styles.label}>
              Approval ID
              <input value={approvalId} onChange={(event) => setApprovalId(event.target.value)} placeholder="Required for consequential actions" style={styles.input} />
            </label>

            <label style={styles.checkRow}>
              <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
              Dry run — do not call the upstream service
            </label>

            <button type="submit" disabled={busy} style={styles.button}>
              {busy ? "Running…" : "Run agent"}
            </button>
          </form>
        </section>

        <aside style={styles.stack}>
          <section style={styles.panel}>
            <h2 style={styles.heading}>Integration health</h2>
            <div style={styles.healthList}>
              {services.map((item) => {
                const state = health[item];
                return (
                  <div key={item} style={styles.healthRow}>
                    <span style={{ textTransform: "capitalize" }}>{item}</span>
                    <span style={styles.muted}>{state ? (state.ok ? "Connected" : state.detail || "Unavailable") : "Checking…"}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.heading}>Approval status</h2>
            <p style={styles.statusText}>{approvalState}</p>
          </section>
        </aside>
      </div>

      <div style={styles.grid}>
        <section style={styles.panel}>
          <h2 style={styles.heading}>Latest result</h2>
          {result ? (
            <dl style={styles.resultGrid}>
              <dt>Status</dt><dd>{result.status}</dd>
              <dt>Verified</dt><dd>{result.verified ? "Yes" : "No"}</dd>
              <dt>Service</dt><dd>{result.service}</dd>
              <dt>Action</dt><dd>{result.action}</dd>
              <dt>Evidence ID</dt><dd>{result.externalId || "—"}</dd>
              <dt>Message</dt><dd>{result.message}</dd>
              <dt>Error code</dt><dd>{result.errorCode || "—"}</dd>
            </dl>
          ) : <p style={styles.muted}>Run a command to see its verified result.</p>}
          {error ? <p role="alert" style={styles.error}>{error}</p> : null}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.heading}>Recent activity</h2>
          <p style={styles.muted}>Activity history will be read from the Product Factory Activity Log in the follow-on history view. v1 writes logs server-side only.</p>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f2ede3", color: "#25231f", padding: "48px 24px 80px", fontFamily: "Georgia, 'Times New Roman', serif" },
  hero: { maxWidth: 1120, margin: "0 auto 28px", borderBottom: "1px solid #b39a65", paddingBottom: 24 },
  eyebrow: { letterSpacing: "0.18em", fontSize: 12, margin: "0 0 10px", color: "#6f624c" },
  title: { fontSize: "clamp(36px, 7vw, 68px)", lineHeight: 1, margin: 0, fontWeight: 500 },
  subtitle: { maxWidth: 720, color: "#625b50", fontSize: 17, lineHeight: 1.6, marginBottom: 0 },
  grid: { maxWidth: 1120, margin: "0 auto 20px", display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, .8fr)", gap: 20 },
  stack: { display: "grid", gap: 20, alignContent: "start" },
  panel: { background: "rgba(255,255,255,.58)", border: "1px solid #c8b991", borderRadius: 8, padding: 22, boxShadow: "0 12px 28px rgba(72,58,36,.06)" },
  heading: { fontSize: 18, margin: "0 0 18px", fontWeight: 600 },
  form: { display: "grid", gap: 15 },
  label: { display: "grid", gap: 7, fontSize: 13, letterSpacing: ".04em" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #b8aa87", borderRadius: 5, padding: "11px 12px", background: "#fffdf8", color: "#25231f", font: "inherit" },
  checkRow: { display: "flex", gap: 9, alignItems: "center", fontSize: 14, color: "#544d42" },
  button: { border: "1px solid #5b4d31", borderRadius: 5, padding: "12px 16px", background: "#403724", color: "#fffaf0", font: "inherit", cursor: "pointer" },
  healthList: { display: "grid", gap: 10 },
  healthRow: { display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #ddd2b8", paddingBottom: 8 },
  muted: { color: "#756d61", lineHeight: 1.5 },
  statusText: { margin: 0, fontSize: 18 },
  resultGrid: { display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 14px", margin: 0 },
  error: { marginTop: 16, padding: 12, border: "1px solid #9a5b51", background: "#f7e8e4", color: "#642f27" },
};
