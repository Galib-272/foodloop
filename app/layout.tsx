import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { MotionProvider } from '@/components/motion';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FoodSphere AI — Food Waste Zero',
  description:
    'FoodSphere AI helps businesses predict surplus food, connect with suitable recipient organizations, and coordinate food rescue before edible food goes to waste.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MotionProvider>
          {children}
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
