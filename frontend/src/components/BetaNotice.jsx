/** Beta disclaimer — English; shown on login & register and echoed in-app via nav banner. */
export default function BetaNotice() {
  return (
    <p className="auth-beta-notice" role="status">
      <span className="auth-beta-badge">Beta</span>
      <span className="auth-beta-notice-copy">
        This is an early release: you may run into bugs, unfinished polish, or brief outages.
        We're shaping the product with real-world feedback—thank you for helping us improve it.
      </span>
    </p>
  )
}
