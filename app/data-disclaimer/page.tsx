import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Data Disclaimer | Land Oracle",
  description: "About the data in Land Oracle: 2026 Florida DOR roll data, verification, and outreach compliance.",
};

const H2 = "text-2xl font-semibold text-white mb-4";
const P = "text-slate-400 leading-relaxed";

export default function DataDisclaimerPage() {
  return (
    <main className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
      <LandingHeader />
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-16">
        <h1 className="text-4xl font-bold text-white mb-8">Data Disclaimer</h1>
        <p className="text-slate-400 mb-8">Last updated: November 2026</p>

        <div className="space-y-8">
          <section>
            <h2 className={H2}>1. Where the data comes from</h2>
            <p className={P}>
              Property attributes (ownership, mailing and situs addresses, land use, just value, acreage, exemptions and recent
              sales) come from the <strong className="text-white">2026 Florida Department of Revenue property tax roll</strong> (NAL and SDF files)
              as submitted by each county property appraiser. Parcel boundaries come from county GIS data. Flood zones are FEMA National Flood
              Hazard Layer polygons. Three counties (DeSoto, Flagler, Liberty) are currently on the preliminary roll and will update when their
              final rolls are published.
            </p>
          </section>

          <section>
            <h2 className={H2}>2. Verify before transacting</h2>
            <p className={P}>
              Land Oracle is a research tool, not a title search, survey, appraisal, legal opinion or flood determination. Records may be
              incomplete, out of date, or differ from the official county record. Just value is an appraiser&apos;s estimate for tax purposes and
              is not a market value or sale price. Sales history reflects recent qualified and other recorded transfers only, not a full chain of
              title. Parcel boundaries are approximate. Some parcels created after the county GIS snapshot have attributes but no map
              geometry. <strong className="text-white">Always confirm ownership, liens, zoning, flood status, boundaries and sale details with the
              county property appraiser, the county clerk&apos;s official records, a title company and licensed professionals before making any
              offer, purchase, sale or lending decision.</strong>
            </p>
          </section>

          <section>
            <h2 className={H2}>3. Outreach compliance is your responsibility</h2>
            <p className={P}>
              Owner names and mailing addresses are public records provided for research. If you contact owners, <strong className="text-white">you are
              solely responsible</strong> for complying with all applicable laws and rules, including the Telephone Consumer Protection Act (TCPA),
              the Florida Telephone Solicitation Act, the National and Florida Do Not Call registries, CAN-SPAM, and the rules of your
              licensing authority. Land Oracle does not supply, scrub or verify phone numbers or email addresses against Do Not Call lists,
              and does not provide legal advice.
            </p>
          </section>

          <section>
            <h2 className={H2}>4. No fair-housing or discriminatory use</h2>
            <p className={P}>
              Do not use Land Oracle data to filter, rank or target people based on race, color, religion, sex, national origin, familial status,
              disability, age or any other legally protected characteristic.
            </p>
          </section>

          <section>
            <h2 className={H2}>5. No warranty</h2>
            <p className={P}>
              Data is provided &quot;as is&quot; without warranties of any kind. See our <a className="text-blue-400 underline" href="/terms">Terms of Service</a> and{" "}
              <a className="text-blue-400 underline" href="/acceptable-use">Acceptable Use Policy</a>. Questions or corrections: <a className="text-blue-400 underline" href="/contact">contact us</a>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
