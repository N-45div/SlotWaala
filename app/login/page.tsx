import { enterDemoDashboard, loginDashboard } from "@/app/auth-actions";
import { dashboardAuthConfigured, demoAccessConfigured } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const configured = dashboardAuthConfigured();
  const demoConfigured = demoAccessConfigured();

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">S</div>
          <span>SlotWaala</span>
        </div>
        <p className="eyebrow">Owner access</p>
        <h1>Open your front desk.</h1>
        <p className="subtle">Use the owner token for full control, or the judge token for a read-only product tour.</p>
        {!configured ? (
          <div className="notice" role="alert">
            Set <code>DASHBOARD_ACCESS_TOKEN</code> or <code>DEMO_ACCESS_TOKEN</code> before opening the production dashboard.
          </div>
        ) : null}
        {params.error === "invalid" ? (
          <div className="notice" role="alert">That access token was not accepted.</div>
        ) : null}
        {params.error === "demo-unavailable" ? (
          <div className="notice" role="alert">The judge preview is not configured yet.</div>
        ) : null}
        {demoConfigured ? (
          <form action={enterDemoDashboard} className="demo-login-form">
            <button className="mini-button demo-button" type="submit">View judge demo</button>
            <p>Read-only access to the live queue, conversation review, availability, and Mesh trace.</p>
          </form>
        ) : null}
        <form action={loginDashboard} className="login-form">
          <label htmlFor="accessToken">Access token</label>
          <input autoComplete="current-password" id="accessToken" name="accessToken" required type="password" />
          <button className="mini-button approve" disabled={!configured} type="submit">Enter dashboard</button>
        </form>
      </section>
    </main>
  );
}
