import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
      <LandingHeader />
      
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-16">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <p className="text-slate-400 mb-8">Last updated: January 25, 2026</p>
        
        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Agreement to Terms</h2>
            <p className="text-slate-400 leading-relaxed">
              By accessing or using Land Oracle&apos;s property intelligence platform and services, you agree 
              to be bound by these Terms of Service. If you do not agree to these terms, please do not 
              use our platform. Land Oracle is operated by Fortune Oracle Media LLC.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Services</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              Land Oracle provides property intelligence data and analysis tools for commercial real 
              estate investment research, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Parcel data aggregation and visualization for North Florida counties</li>
              <li>Truck parking development opportunity identification</li>
              <li>Zoning, ownership, and property characteristic analysis</li>
              <li>Geospatial mapping and proximity analysis tools</li>
              <li>Market intelligence reports and data exports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Informational Purposes Only</h2>
            <p className="text-slate-400 leading-relaxed">
              <strong className="text-white">All property data, analysis, and reports provided by Land Oracle 
              are for informational and research purposes only.</strong> The platform does not provide legal, 
              financial, investment, or real estate advice. You should:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Conduct independent due diligence on any property of interest</li>
              <li>Consult with qualified professionals (attorneys, surveyors, engineers, financial advisors)</li>
              <li>Verify all data with official county records and authorities</li>
              <li>Obtain professional title searches and surveys before any transaction</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              Investment decisions made based on Land Oracle data are solely your responsibility.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Data Accuracy and Limitations</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              While we strive to provide accurate and up-to-date property information, Land Oracle makes 
              no warranties regarding:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li><strong className="text-white">Data Accuracy:</strong> Property data is sourced from public records and third-party providers. 
              Errors, omissions, or outdated information may exist.</li>
              <li><strong className="text-white">Completeness:</strong> Not all properties or data fields may be included in our database.</li>
              <li><strong className="text-white">Currency:</strong> Property records are updated periodically but may not reflect the most recent 
              transactions, zoning changes, or property modifications.</li>
              <li><strong className="text-white">Interpretation:</strong> Zoning classifications, land use designations, and development potential 
              assessments are subject to local regulations and official interpretation.</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              <strong className="text-white">You acknowledge that property data can change at any time,</strong> and 
              official county records are the authoritative source for all property information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. User Accounts and Access</h2>
            <p className="text-slate-400 leading-relaxed">
              To access certain features, you may need to create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security and confidentiality of your account credentials</li>
              <li>Notify us immediately of any unauthorized account access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              We reserve the right to suspend or terminate accounts that violate these terms or engage 
              in prohibited activities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Acceptable Use - See Acceptable Use Policy</h2>
            <p className="text-slate-400 leading-relaxed">
              Your use of Land Oracle is subject to our Acceptable Use Policy. You may not use the 
              platform or data for any unlawful purpose or in any way that violates applicable laws 
              or regulations. See our complete Acceptable Use Policy for details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Intellectual Property</h2>
            <p className="text-slate-400 leading-relaxed">
              The Land Oracle platform, including its design, features, software, and proprietary 
              analysis tools, are owned by Fortune Oracle Media LLC and protected by intellectual 
              property laws. While underlying property data may be publicly available, our aggregation, 
              processing, and analysis methods are proprietary. You may not:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Reproduce, modify, or create derivative works of the platform</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Remove or modify any proprietary notices or labels</li>
              <li>Use Land Oracle branding without written permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Subscription and Payment Terms</h2>
            <p className="text-slate-400 leading-relaxed">
              Certain features require paid subscriptions. By subscribing, you agree to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Pay all applicable fees for your selected subscription tier</li>
              <li>Automatic renewal unless you cancel before the renewal date</li>
              <li>Price changes with 30 days advance notice</li>
              <li>Our refund policy as outlined in our separate Refund Policy</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              We use third-party payment processors and do not store credit card information directly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-slate-400 leading-relaxed">
              <strong className="text-white">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong>
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Land Oracle and Fortune Oracle Media LLC shall not be liable for any investment 
              losses, missed opportunities, or damages arising from your use of property data or platform features</li>
              <li>We make no guarantees regarding development potential, permitting success, or investment returns</li>
              <li>Our total liability shall not exceed the amount you paid for services in the 12 months 
              prior to the claim</li>
              <li>We are not liable for indirect, incidental, special, consequential, or punitive damages</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              Some jurisdictions do not allow certain liability limitations, so these may not apply to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Indemnification</h2>
            <p className="text-slate-400 leading-relaxed">
              You agree to indemnify and hold harmless Land Oracle and Fortune Oracle Media LLC from 
              any claims, damages, or expenses arising from:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Your use or misuse of the platform</li>
              <li>Your violation of these terms</li>
              <li>Your violation of any third-party rights</li>
              <li>Investment decisions made based on platform data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Third-Party Links and Content</h2>
            <p className="text-slate-400 leading-relaxed">
              Land Oracle may contain links to third-party websites, county records systems, or external 
              data sources. We are not responsible for the content, accuracy, or practices of these 
              third-party sites.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Modifications to Service and Terms</h2>
            <p className="text-slate-400 leading-relaxed">
              We reserve the right to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Modify, suspend, or discontinue any feature of the platform</li>
              <li>Update these Terms of Service at any time (changes effective upon posting)</li>
              <li>Change subscription pricing with 30 days notice</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              Your continued use after changes constitutes acceptance of modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Termination</h2>
            <p className="text-slate-400 leading-relaxed">
              We may terminate or suspend your access immediately, without notice, for conduct that 
              violates these terms or is harmful to other users, us, or third parties. Upon termination, 
              your right to use the platform ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">14. Governing Law and Dispute Resolution</h2>
            <p className="text-slate-400 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the State 
              of Florida, without regard to its conflict of law provisions. Any disputes shall be 
              resolved through:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Good faith negotiation between the parties</li>
              <li>Binding arbitration in Jacksonville, Florida (if negotiation fails)</li>
              <li>Class action waiver - disputes must be brought individually</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">15. Severability</h2>
            <p className="text-slate-400 leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision 
              shall be limited or eliminated to the minimum extent necessary, and the remaining provisions 
              shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">16. Contact Information</h2>
            <p className="text-slate-400 leading-relaxed">
              For questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-slate-400 mt-4">
              Land Oracle / Fortune Oracle Media LLC<br />
              Jacksonville, Florida<br />
              Email: legal@landoracle.ai
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </main>
  );
}
