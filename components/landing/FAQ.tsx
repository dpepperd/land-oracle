import { Plus } from 'lucide-react';

const faqs = [
  {
    question: "What counties do you cover?",
    answer: "We are currently live in Baker County, FL with full data coverage. We are rapidly expanding to surrounding North Florida counties including Columbia, Union, and Nassau. Check back weekly for updates!"
  },
  {
    question: "What types of properties are included?",
    answer: "We index every parcel in the county—Residential, Agricultural, Commercial, Industrial, and Vacant Land. Use our Land Use filters to specifically target Single Family Homes, Row Crops, Timberland, or Retail potential."
  },
  {
    question: "Can I export the data?",
    answer: "Yes! Pro and Enterprise plans allow CSV exports of your searches, including owner mailing addresses, facilitating direct mail campaigns."
  },
  {
    question: "Do you offer skip tracing?",
    answer: "We provide partial contact info (phone/email) where available in public records. For deep skip tracing, we integrate with third-party providers (coming soon)."
  },
  {
    question: "Is there a free trial?",
    answer: "Absolutely. You can explore the map and see basic data for free. Advanced filtering and ownership details require a subscription, but we offer a 14-day money-back guarantee."
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
