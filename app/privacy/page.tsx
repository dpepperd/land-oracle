import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
      <LandingHeader />
      
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-16">
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        <p className="text-slate-400 mb-8">Last updated: January 25, 2026</p>
        
        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="text-slate-400 leading-relaxed">
              Fortune Oracle Media LLC ("we," "us," or "our") operates Land Oracle, a property intelligence 
              platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your 
              information when you use our platform.
            </p>
            <p className="text-slate-400 leading-relaxed mt-4">
              <strong className="text-white">By using Land Oracle, you agree to the collection and use of 
              information in accordance with this policy.</strong> If you do not agree with our policies 
              and practices, do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1 Personal Information You Provide</h3>
            <p className="text-slate-400 leading-relaxed mb-4">
              When you create an account or use our services, we may collect:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li><strong className="text-white">Account Information:</strong> Name, email address, phone number, company name</li>
              <li><strong className="text-white">Payment Information:</strong> Billing address, payment method details (processed by third-party payment processors)</li>
              <li><strong className="text-white">Profile Information:</strong> Investment preferences, areas of interest, saved searches</li>
              <li><strong className="text-white">Communications:</strong> Messages, support inquiries, feedback you send us</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2 Usage and Activity Data</h3>
            <p className="text-slate-400 leading-relaxed mb-4">
              We automatically collect information about how you interact with our platform:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li><strong className="text-white">Search Activity:</strong> Properties searched, filters applied, geographic areas of interest</li>
              <li><strong className="text-white">Platform Usage:</strong> Features accessed, reports generated, data exports, saved properties</li>
              <li><strong className="text-white">Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
              <li><strong className="text-white">Log Data:</strong> Access times, pages viewed, links clicked, session duration</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3 Cookies and Tracking Technologies</h3>
            <p className="text-slate-400 leading-relaxed">
              We use cookies, web beacons, and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Maintain your session and remember your preferences</li>
              <li>Analyze platform usage and improve functionality</li>
              <li>Provide personalized content and recommendations</li>
              <li>Measure marketing campaign effectiveness</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              You can control cookies through your browser settings, though some platform features may 
              not function properly without them.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.4 Property Research Data</h3>
            <p className="text-slate-400 leading-relaxed">
              We may aggregate and analyze patterns in how users search for and interact with property 
              data (without personally identifying individuals) to improve our platform and provide 
              market insights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              We use collected information for the following purposes:
            </p>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.1 Platform Operation and Improvement</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Provide access to property data and intelligence tools</li>
              <li>Process subscriptions and manage your account</li>
              <li>Personalize your experience and saved searches</li>
              <li>Improve platform features, algorithms, and user interface</li>
              <li>Develop new features and services</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.2 Communication and Support</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Respond to inquiries and provide customer support</li>
              <li>Send platform updates, new feature announcements, and service notifications</li>
              <li>Provide market insights and property alerts (if opted in)</li>
              <li>Send promotional communications (with your consent)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.3 Security and Compliance</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Detect, prevent, and address fraud and security issues</li>
              <li>Monitor and enforce our Terms of Service and Acceptable Use Policy</li>
              <li>Comply with legal obligations and respond to legal requests</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.4 Analytics and Research</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Analyze aggregated usage patterns and trends</li>
              <li>Generate market intelligence reports (anonymized data)</li>
              <li>Measure marketing effectiveness and ROI</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. How We Share Your Information</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.1 Service Providers</h3>
            <p className="text-slate-400 leading-relaxed">
              We work with third-party service providers who perform services on our behalf:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Payment processors (Stripe, PayPal)</li>
              <li>Cloud hosting and infrastructure (AWS, Cloudflare)</li>
              <li>Analytics platforms (Google Analytics)</li>
              <li>Email and communication services</li>
              <li>Customer support tools</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              These providers have access only to information needed to perform their functions and are 
              obligated to maintain confidentiality.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.2 Business Transfers</h3>
            <p className="text-slate-400 leading-relaxed">
              If we are involved in a merger, acquisition, sale of assets, or bankruptcy, your information 
              may be transferred to the acquiring entity.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.3 Legal Requirements</h3>
            <p className="text-slate-400 leading-relaxed">
              We may disclose information if required to do so by law or in response to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Court orders or legal process</li>
              <li>Government or regulatory requests</li>
              <li>Protection of our rights, property, or safety</li>
              <li>Prevention of fraud or security threats</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.4 Aggregated or Anonymized Data</h3>
            <p className="text-slate-400 leading-relaxed">
              We may share aggregated or anonymized data that cannot reasonably be used to identify you, 
              such as market trend reports or usage statistics.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Property Data Privacy</h2>
            <p className="text-slate-400 leading-relaxed">
              <strong className="text-white">Property data displayed on Land Oracle is sourced from public 
              records.</strong> This includes ownership information, parcel details, and assessment data 
              that is already publicly available through county records offices.
            </p>
            <p className="text-slate-400 leading-relaxed mt-4">
              If you are a property owner and have privacy concerns about publicly available property 
              information displayed on our platform, please contact us. Note that we display information 
              from official public records and do not remove data that is legally public, but we can 
              discuss specific concerns.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Security</h2>
            <p className="text-slate-400 leading-relaxed">
              We implement reasonable security measures to protect your information, including:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security assessments and updates</li>
              <li>Limited employee access to personal information</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              <strong className="text-white">However, no method of transmission or storage is 100% secure.</strong> 
              We cannot guarantee absolute security of your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Data Retention</h2>
            <p className="text-slate-400 leading-relaxed">
              We retain your information for as long as necessary to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Provide our services and maintain your account</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce agreements</li>
              <li>Conduct legitimate business operations</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              When you close your account, we will delete or anonymize your personal information within 
              90 days, unless retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Your Privacy Rights</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              Depending on your location, you may have the following rights:
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.1 Access and Portability</h3>
            <p className="text-slate-400 leading-relaxed">
              Request access to the personal information we hold about you and receive a copy in a 
              portable format.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.2 Correction and Update</h3>
            <p className="text-slate-400 leading-relaxed">
              Request correction of inaccurate or incomplete personal information.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.3 Deletion</h3>
            <p className="text-slate-400 leading-relaxed">
              Request deletion of your personal information, subject to legal retention requirements.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.4 Opt-Out</h3>
            <p className="text-slate-400 leading-relaxed">
              Opt out of marketing communications (unsubscribe links provided in emails).
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">8.5 California Residents (CCPA)</h3>
            <p className="text-slate-400 leading-relaxed">
              California residents have additional rights under the California Consumer Privacy Act, including:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Right to know what personal information is collected</li>
              <li>Right to know if personal information is sold or disclosed</li>
              <li>Right to opt-out of the sale of personal information (we do not sell)</li>
              <li>Right to non-discrimination for exercising CCPA rights</li>
            </ul>

            <p className="text-slate-400 leading-relaxed mt-6">
              To exercise any of these rights, please contact us at privacy@landoracle.ai. We will 
              respond within 30 days of receiving your request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Children's Privacy</h2>
            <p className="text-slate-400 leading-relaxed">
              Land Oracle is not intended for users under the age of 18. We do not knowingly collect 
              personal information from children. If you believe we have collected information from a 
              child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. International Users</h2>
            <p className="text-slate-400 leading-relaxed">
              Land Oracle is operated in the United States and primarily serves U.S.-based users. If you 
              access our platform from outside the United States, your information may be transferred to, 
              stored, and processed in the United States where data protection laws may differ from your 
              jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Third-Party Links</h2>
            <p className="text-slate-400 leading-relaxed">
              Our platform may contain links to third-party websites, including county property records 
              systems. We are not responsible for the privacy practices of these external sites. We 
              encourage you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to This Privacy Policy</h2>
            <p className="text-slate-400 leading-relaxed">
              We may update this Privacy Policy periodically to reflect changes in our practices or legal 
              requirements. We will notify you of significant changes by:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Posting the updated policy with a new "Last updated" date</li>
              <li>Sending email notification for material changes</li>
              <li>Displaying a prominent notice on our platform</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              Your continued use of Land Oracle after changes become effective constitutes acceptance 
              of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Contact Us</h2>
            <p className="text-slate-400 leading-relaxed">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data 
              practices, please contact us:
            </p>
            <p className="text-slate-400 mt-4">
              Land Oracle / Fortune Oracle Media LLC<br />
              Attention: Privacy Officer<br />
              Jacksonville, Florida<br />
              Email: privacy@landoracle.ai
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </main>
  );
}
