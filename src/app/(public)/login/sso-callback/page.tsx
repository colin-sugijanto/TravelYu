import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function LoginSsoCallbackPage() {
  return <AuthenticateWithRedirectCallback signInUrl="/login" signUpUrl="/login" />;
}
