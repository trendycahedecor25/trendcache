import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const WILLOW_AVATAR = "https://static.prod-images.emergentagent.com/jobs/bb8d70a7-15ea-4a51-916d-4d6020add402/images/f5d9020ab42e989571006f0e001a83e2817fbeb73070147d7bafbdf608d5f35d.png";
const LAST_UPDATED = "April 6, 2026";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FFF9F5]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <img src={WILLOW_AVATAR} alt="HEARD" className="w-7 h-7 rounded-full" />
          <span className="font-['Outfit'] font-bold text-lg gradient-text">HEARD</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-20" data-testid="privacy-policy-page">
        <h1 className="font-['Outfit'] text-3xl md:text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose-container space-y-8 text-slate-700 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">1. Introduction</h2>
            <p>HEARD ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and services, including our AI companion Willow.</p>
            <p className="mt-2">By using HEARD, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our services.</p>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">2. Information We Collect</h2>
            <p className="font-medium text-slate-800 mb-2">Account Information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name and email address (provided via Google sign-in)</li>
              <li>Profile picture (from your Google account)</li>
            </ul>
            <p className="font-medium text-slate-800 mb-2 mt-4">User-Generated Content:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Conversations with Willow (our AI companion)</li>
              <li>Journal entries and notes</li>
              <li>Calendar events and reminders</li>
              <li>Mood check-in data</li>
            </ul>
            <p className="font-medium text-slate-800 mb-2 mt-4">Payment Information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Payment transactions are processed securely through Stripe. We do not store your credit card number, CVV, or full billing details on our servers.</li>
              <li>We retain transaction records (amount, date, subscription status) for billing purposes.</li>
            </ul>
            <p className="font-medium text-slate-800 mb-2 mt-4">Automatically Collected:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Usage data (features used, session duration)</li>
              <li>Device and browser information</li>
            </ul>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Provide and personalize our services:</strong> Your conversations, journal entries, and mood data help Willow understand your needs and provide relevant, empathetic support.</li>
              <li><strong>Improve Willow's responses:</strong> Willow uses your conversation history and mood patterns to offer more personalized and contextual support over time.</li>
              <li><strong>Process payments:</strong> To manage your subscription and billing.</li>
              <li><strong>Communicate with you:</strong> Service updates, support, and account-related notices.</li>
              <li><strong>Ensure safety and security:</strong> Protect against fraud and abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">4. AI and Data Processing</h2>
            <p>HEARD uses artificial intelligence (powered by OpenAI's GPT technology) to provide the Willow companion experience. When you interact with Willow:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Your messages are sent to our AI provider (OpenAI) for processing and response generation.</li>
              <li>Conversation history is stored in our database to provide continuity and personalized support.</li>
              <li>Willow is NOT a licensed therapist, counselor, or medical professional. Responses are AI-generated and should not replace professional mental health care.</li>
              <li>We do not sell your conversations or personal data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">5. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Google OAuth:</strong> For secure authentication (sign-in). Google's privacy policy applies to data collected during sign-in.</li>
              <li><strong>OpenAI:</strong> For AI conversation processing. Subject to OpenAI's usage policies and data processing agreements.</li>
              <li><strong>Stripe:</strong> For payment processing. Subject to Stripe's privacy policy. We do not have access to your full payment card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">6. Data Storage and Security</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data is stored on secure, encrypted servers.</li>
              <li>We use industry-standard security measures including HTTPS encryption, secure authentication tokens, and httpOnly cookies.</li>
              <li>While we strive to protect your information, no method of electronic storage is 100% secure. We cannot guarantee absolute security.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">7. Data Retention</h2>
            <p>We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for data processing</li>
              <li>Request a copy of your data in a portable format</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, please contact us at the email provided below.</p>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">9. Children's Privacy</h2>
            <p>HEARD is intended for users aged 18 and older. We do not knowingly collect personal information from children under 13. If we discover that a child under 13 has provided us with personal information, we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of HEARD after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="font-['Outfit'] text-xl font-semibold text-slate-900 mb-3">11. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or our data practices, please contact us at:</p>
            <p className="mt-2 font-medium text-slate-800">HEARD Support<br />Email: support@heardapp.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
