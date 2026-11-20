import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { ensureTotpSecret, otpauthUrl, platformState } from "../../../../lib/platform";
import { PlatformSolo } from "../../chrome";
import { SetupTwoStepForm } from "../../forms";

export const metadata = { title: "Turn on two-step sign-in", referrer: "no-referrer" };

export default async function TwoStepSetup() {
  const { admin } = await platformState();
  if (!admin) redirect("/platform/sign-in");
  if (admin.totpOn) redirect(admin.verified ? "/platform" : "/platform/two-step");
  const secret = await ensureTotpSecret(admin.userId);
  if (!secret) redirect("/platform/sign-in");
  const url = otpauthUrl(secret, admin.email);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const pretty = secret.match(/.{1,4}/g)!.join(" ");
  return (
    <>
      <PlatformSolo signedIn />
      <main id="main" className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>Turn on two-step sign-in</h1>
          <p className="lead">It is required for every Super Admin. You need an authenticator app on your phone, like Google Authenticator, Microsoft Authenticator or 1Password.</p>
          <ol>
            <li>In the app, add an account and scan this code.</li>
          </ol>
          <img className="pf-qr" alt="QR code to add FAMITENLY to your authenticator app" src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={200} height={200} />
          <p>If you cannot scan it, type this key in the app instead:</p>
          <p className="pf-secret">{pretty}</p>
          <ol start={2}>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <SetupTwoStepForm />
        </div>
      </main>
    </>
  );
}
