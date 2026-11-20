import { ForgotPasswordPage } from "../../account/pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forgot your password?" };

export default function Page() {
  return <ForgotPasswordPage kind="family" />;
}
