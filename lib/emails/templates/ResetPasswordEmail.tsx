export default function ResetPasswordEmail({ appName = "EaziWage", link }: { appName?: string; link: string }) {
  return (
    <html>
      <body style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", margin: 0 }}>
        <div style={{ padding: 24, background: "#f7faf9" }}>
          <div style={{ maxWidth: 600, margin: "0 auto", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: 24, background: "#0f766e", color: "#fff" }}>
              <h1 style={{ margin: 0, fontSize: 20 }}>{appName}</h1>
            </div>

            <div style={{ padding: 24 }}>
              <h2 style={{ marginTop: 0 }}>Reset your password</h2>
              <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>

              <p style={{ textAlign: "center", marginTop: 24 }}>
                <a href={link} style={{
                  background: "#059669",
                  color: "#fff",
                  textDecoration: "none",
                  padding: "12px 20px",
                  borderRadius: 6,
                  display: "inline-block",
                }}>Reset password</a>
              </p>

              <p style={{ color: "#6b7280", fontSize: 14 }}>
                If you didn&apos;t request this, ignore this email. This link expires in 30 minutes.
              </p>

              <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />
              <p style={{ color: "#9ca3af", fontSize: 12 }}>© {new Date().getFullYear()} {appName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
