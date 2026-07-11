import { loginDashboard } from "@/app/auth-actions";
import { dashboardAuthConfigured } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const configured = dashboardAuthConfigured();

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">S</div>
          <span>SlotWaala</span>
        </div>
        <p className="eyebrow">Owner access</p>
        <h1>Open your front desk.</h1>
        <p className="subtle">Enter the owner access token configured for this business.</p>
        {!configured ? (
          <div className="notice" role="alert">
            Owner access is not configured. Set <code>DASHBOARD_ACCESS_TOKEN</code> before opening the production dashboard.
          </div>
        ) : null}
        {params.error === "invalid" ? (
          <div className="notice" role="alert">That access token was not accepted.</div>
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
