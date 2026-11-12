import { Plus } from 'lucide-react';

const faqs = [
  {
    question: "What counties do you cover?",
    answer: "All 67 Florida counties are live, using the 2026 Florida Department of Revenue tax roll. Your plan decides how many counties you can search: Scout includes 1, Pro includes 3, and Statewide includes all 67. You can add counties to Scout and Pro."
  },
  {
    question: "What types of properties are included?",
    answer: "Every parcel in each county: residential, agricultural, commercial, industrial, and vacant land. Use the land use filters to target single-family homes, row crops, timberland, or retail, and see owner, mailing address, value, acreage, recent sales, and FEMA flood zone on each parcel."
  },
  {
    question: "Can I export the data?",
    answer: "Yes. Every plan can export your searches to CSV, including owner mailing addresses: free accounts up to 100 rows a month, Scout up to 1,000 rows a month, and Pro and Statewide unlimited."
  },
  {
    question: "Do you offer skip tracing?",
    answer: "Not yet. Owner names and mailing addresses come from public tax records, so you can mail owners today. Phone and email lookups (skip tracing) are planned but not available yet."
  },
  {
    question: "Is there a free trial?",
    answer: "You can create a free account to explore the map in one county. Paid plans start at $79 a month and add more counties, higher export limits, and the AI Analyst. You can change or cancel any time from the billing portal; for billing questions, email support@landoracle.ai."
  },
  {
    question: "Is there an AI assistant?",
    answer: "Yes. Pro and Statewide plans include an AI Analyst. Ask for what you want in plain English, like vacant land over 5 acres with an out-of-state owner, and the matching parcels appear on your map and in your results. It uses property facts only and can make mistakes, so always verify before you act."
  },
  {
    question: "Where does the data come from?",
    answer: "Ownership, value, and sales data come from the Florida Department of Revenue tax roll, and flood zones come from FEMA. It is meant for research. Always confirm ownership, liens, zoning, and flood status with the county and a title company before you buy."
  }
];

export default function FAQ() {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Common questions about LandOracle.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <details className="group">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 pr-4">
                    {faq.question}
                  </h3>
                  <div className="text-blue-600 transition-transform duration-300 group-open:rotate-45">
                    <Plus size={20} />
                  </div>
                </summary>
                <div className="px-6 pb-6 text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-200/50 dark:border-zinc-800/50 pt-4">
                  {faq.answer}
                </div>
              </details>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
