import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotForm } from '@/components/auth/password-forms';

export const metadata = { title: 'Forgot Password — FoodSphere AI' };

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send you a reset link.">
      <ForgotForm />
    </AuthShell>
  );
}
