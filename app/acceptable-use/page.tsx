import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";

export default function AcceptableUsePage() {
  return (
    <main className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
      <LandingHeader />
      
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-16">
        <h1 className="text-4xl font-bold text-white mb-8">Acceptable Use Policy</h1>
        <p className="text-slate-400 mb-8">Last updated: January 25, 2026</p>
        
        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Purpose</h2>
            <p className="text-slate-400 leading-relaxed">
              This Acceptable Use Policy governs your use of Land Oracle&apos;s property intelligence platform 
              and data. This policy is designed to protect Land Oracle, our users, and property owners 
              from inappropriate or harmful use of the platform.
            </p>
            <p className="text-slate-400 leading-relaxed mt-4">
              <strong className="text-white">Violation of this policy may result in suspension or 
              termination of your account without refund.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Permitted Uses</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              Land Oracle property data and intelligence tools may be used for:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li><strong className="text-white">Commercial Real Estate Research:</strong> Identifying potential investment opportunities, 
              analyzing market trends, conducting feasibility studies</li>
              <li><strong className="text-white">Development Planning:</strong> Researching sites for truck parking facilities, warehouses, 
              logistics centers, or other commercial developments</li>
              <li><strong className="text-white">Due Diligence:</strong> Preliminary property research as part of acquisition analysis 
              (must be verified with official records)</li>
              <li><strong className="text-white">Market Analysis:</strong> Studying property characteristics, zoning patterns, and ownership 
              trends in specific geographic areas</li>
              <li><strong className="text-white">Portfolio Management:</strong> Tracking and analyzing properties of interest or under 
              consideration</li>
              <li><strong className="text-white">Business Development:</strong> Identifying potential clients, partners, or acquisition targets 
              in the commercial real estate sector</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Prohibited Uses</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              You may NOT use Land Oracle for any of the following purposes:
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.1 Harassment and Privacy Violations</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Stalking, harassing, or threatening property owners or residents</li>
              <li>Unsolicited contact with property owners for non-commercial purposes</li>
              <li>Researching individuals for personal reasons unrelated to legitimate real estate business</li>
              <li>Compiling personal information about individuals for any non-business purpose</li>
              <li>Any use that violates an individual&apos;s reasonable expectation of privacy</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.2 Fraudulent or Deceptive Practices</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Misrepresenting yourself or your business when contacting property owners</li>
              <li>Using data to create fraudulent listings or property advertisements</li>
              <li>Title fraud, deed fraud, or any form of property-related scams</li>
              <li>Creating false or misleading market reports</li>
              <li>Impersonating government officials, county assessors, or other authorities</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.3 Illegal Activities</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Any activity that violates federal, state, or local laws or regulations</li>
              <li>Money laundering or financing of illegal activities through property transactions</li>
              <li>Facilitating illegal land use or zoning violations</li>
              <li>Tax evasion schemes or fraudulent property valuations</li>
              <li>Discrimination in housing or real estate practices (Fair Housing Act violations)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.4 Data Scraping and Redistribution</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Systematic downloading, scraping, or copying of large portions of the database</li>
              <li>Using automated tools (bots, scrapers) to extract data beyond normal platform use</li>
              <li>Reselling, redistributing, or republishing Land Oracle data without authorization</li>
              <li>Creating competing products or services using our data</li>
              <li>Sharing account credentials to allow unauthorized access</li>
              <li>Circumventing access controls, rate limits, or usage restrictions</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.5 Spam and Unwanted Commercial Communications</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Mass unsolicited email ("spam") to property owners</li>
              <li>Aggressive cold-calling or text messaging campaigns</li>
              <li>Door-to-door solicitation based solely on Land Oracle data without proper licensing</li>
              <li>Violating the CAN-SPAM Act, TCPA, or state-specific marketing laws</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.6 System Abuse</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Attempting to hack, breach, or circumvent security measures</li>
              <li>Introducing malware, viruses, or malicious code</li>
              <li>Overloading systems with excessive requests (DDoS attacks)</li>
              <li>Reverse engineering, decompiling, or disassembling platform software</li>
              <li>Exploiting bugs or vulnerabilities for unauthorized access or advantage</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.7 Misuse of Property Data</h3>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Making investment decisions based solely on Land Oracle data without independent verification</li>
              <li>Representing Land Oracle analysis as official appraisals or professional opinions</li>
              <li>Using outdated or unverified data for legal proceedings or official documentation</li>
              <li>Claiming that zoning, development potential, or property characteristics shown on Land Oracle 
              constitute official determinations (they do not—verify with authorities)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Responsible Contact with Property Owners</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              If you use Land Oracle data to identify and contact property owners for legitimate business purposes, 
              you must:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li>Comply with all applicable laws including CAN-SPAM, TCPA, and state-specific regulations</li>
              <li>Clearly identify yourself and your company</li>
              <li>Provide accurate contact information and honor opt-out requests immediately</li>
              <li>Respect "Do Not Contact" preferences and cease contact when requested</li>
              <li>Maintain appropriate licensing (real estate license, business license, etc.) where required</li>
              <li>Be truthful about your intentions and the nature of your interest in their property</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              <strong className="text-white">We reserve the right to terminate accounts that generate complaints 
              from property owners about harassment or inappropriate contact.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Export and Usage Limits</h2>
            <p className="text-slate-400 leading-relaxed">
              Depending on your subscription tier, you may have limits on:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Number of property records that can be exported or downloaded</li>
              <li>Number of searches performed per month</li>
              <li>Number of saved properties or lists</li>
              <li>Access to API or bulk data features</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              Exceeding these limits through circumvention or abuse violates this policy. Contact us if you 
              need higher limits for legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Reporting Violations</h2>
            <p className="text-slate-400 leading-relaxed">
              If you become aware of any violation of this Acceptable Use Policy, please report it to us at:
            </p>
            <p className="text-slate-400 mt-4">
              Email: abuse@landoracle.ai<br />
              Subject: "AUP Violation Report"
            </p>
            <p className="text-slate-400 leading-relaxed mt-4">
              Include relevant details such as account username, description of the violation, and any 
              supporting evidence.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Enforcement</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              Violation of this Acceptable Use Policy may result in:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2">
              <li><strong className="text-white">Warning:</strong> First-time or minor violations may receive a written warning</li>
              <li><strong className="text-white">Temporary Suspension:</strong> Serious violations may result in account suspension pending investigation</li>
              <li><strong className="text-white">Permanent Termination:</strong> Severe or repeated violations will result in permanent account 
              termination without refund</li>
              <li><strong className="text-white">Legal Action:</strong> We reserve the right to pursue legal remedies for violations that cause 
              harm to Land Oracle, our users, or third parties</li>
              <li><strong className="text-white">Cooperation with Authorities:</strong> We will cooperate with law enforcement regarding 
              illegal activities</li>
            </ul>
            <p className="text-slate-400 leading-relaxed mt-4">
              We have sole discretion to determine whether a violation has occurred and what action to take.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Fair Housing Compliance</h2>
            <p className="text-slate-400 leading-relaxed">
              All users must comply with the Fair Housing Act and state/local fair housing laws. You may not 
              use Land Oracle data to:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Discriminate based on race, color, religion, sex, handicap, familial status, or national origin</li>
              <li>Target or exclude communities based on protected characteristics</li>
              <li>Engage in predatory practices targeting vulnerable populations</li>
              <li>Facilitate housing discrimination by third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Professional Licensing Requirements</h2>
            <p className="text-slate-400 leading-relaxed">
              Land Oracle does not verify professional licensing. If your jurisdiction requires specific 
              licenses for your intended use of property data (real estate license, appraiser license, etc.), 
              you are solely responsible for:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-2 mt-4">
              <li>Obtaining and maintaining required licenses</li>
              <li>Operating within the scope of your license</li>
              <li>Complying with professional standards and ethics requirements</li>
              <li>Understanding the limitations of unlicensed activity in your area</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-slate-400 leading-relaxed">
              We may update this Acceptable Use Policy at any time. Changes will be posted with a new 
              "Last updated" date. Continued use of Land Oracle after changes constitutes acceptance of 
              the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Questions and Contact</h2>
            <p className="text-slate-400 leading-relaxed">
              If you have questions about acceptable use or need clarification on whether a specific use 
              case is permitted, please contact us before proceeding:
            </p>
            <p className="text-slate-400 mt-4">
              Land Oracle / Fortune Oracle Media LLC<br />
              Jacksonville, Florida<br />
              Email: compliance@landoracle.ai
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </main>
  );
}
