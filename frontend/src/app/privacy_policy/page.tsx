//site_turing_CrutchMasters_team-s/frontend/src/app/privacy-policy/page.tsx
"use client";
 
import Link from "next/link";
import { useTheme } from "@/hooks/useTheme";
 
export default function PrivacyPolicyPage() {
  const { dark } = useTheme();
 
  return (
    <div className="min-h-screen bg-(--bg) text-(--t1) font-sans transition-colors duration-300 relative overflow-hidden">
      {/* Watermark */}
      <div className={`fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity ${dark ? "opacity-10" : "opacity-5"}`}>
        <img
          src="/logo_background1.png"
          alt=""
          className={`w-[min(800px,90vw)] h-[min(800px,90vw)] object-contain blur-sm ${dark ? "invert" : ""}`}
        />
      </div>
 
      {/* Back button */}
      <Link
        href="/"
        className="fixed top-6 left-6 sm:top-8 sm:left-8 text-(--t2) hover:text-blue-600 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 z-20"
      >
        <span>←</span> Back
      </Link>
 
      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-24 sm:py-32">
        <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter mb-2 text-(--t1)">
          Privacy Policy
        </h1>
        <p className="text-(--t2) text-xs font-bold uppercase tracking-widest mb-12">
          Last updated: June 2025
        </p>
 
        <div className="flex flex-col gap-10 text-sm leading-relaxed text-(--t1)">
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              1. Information We Collect
            </h2>
            <p className="text-(--t2)">
              We collect information you provide directly to us when you create an account, including your username, login handle, email address, and password. We may also collect usage data such as pages visited, actions taken, and session duration to improve our services.
            </p>
          </section>
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              2. How We Use Your Information
            </h2>
            <p className="text-(--t2)">
              Your information is used to create and manage your account, authenticate your identity, communicate with you about updates and security, and improve the quality and performance of our platform. We do not sell your personal data to third parties.
            </p>
          </section>
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              3. Data Storage & Security
            </h2>
            <p className="text-(--t2)">
              Your data is stored securely using industry-standard encryption. We use Supabase for authentication and database management, which complies with modern security standards. Access tokens are stored locally in your browser and are used solely for session management.
            </p>
          </section>
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              4. Cookies & Local Storage
            </h2>
            <p className="text-(--t2)">
              We use cookies and local storage to maintain your session and preferences. These are essential for the functioning of the platform. You may clear them at any time through your browser settings, though this will log you out of your account.
            </p>
          </section>
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              5. Third-Party Services
            </h2>
            <p className="text-(--t2)">
              We use third-party services including Supabase (authentication and database) and Render (backend hosting). These services have their own privacy policies and data handling practices. We encourage you to review them independently.
            </p>
          </section>
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              6. Your Rights
            </h2>
            <p className="text-(--t2)">
              You have the right to access, correct, or delete your personal data at any time. To request deletion of your account and associated data, please contact us through the platform or via email. We will process your request within 30 days.
            </p>
          </section>
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              7. Changes to This Policy
            </h2>
            <p className="text-(--t2)">
              We may update this Privacy Policy from time to time. Significant changes will be communicated via email or a notice on the platform. Continued use of the service after changes constitutes your acceptance of the updated policy.
            </p>
          </section>
 
          <section>
            <h2 className="text-base font-black uppercase tracking-widest mb-3 text-blue-600">
              8. Contact
            </h2>
            <p className="text-(--t2)">
              If you have any questions about this Privacy Policy or how we handle your data, please contact us at{" "}
              <a href="mailto:support@yourdomain.com" className="text-blue-600 hover:underline font-bold">
                support@yourdomain.com
              </a>
              .
            </p>
          </section>
 
        </div>
 
        <div className="mt-16 pt-8 border-t border-(--brd) text-center">
          <Link
            href="/register"
            className="text-[10px] font-black text-(--t2) hover:text-blue-600 uppercase tracking-[0.3em] transition-all"
          >
            ← Back to Register
          </Link>
        </div>
      </div>
    </div>
  );
}
