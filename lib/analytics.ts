// lib/analytics.ts

type EventProps = {
  action: string;
  category: string;
  label: string;
  value?: number;
};

export const event = ({ action, category, label, value }: EventProps) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Property search event
export const trackPropertySearch = ({ county, acreageMin, acreageMax, resultsCount }: { county: string[], acreageMin: number, acreageMax: number, resultsCount: number }) => {
  event({
    action: 'property_search',
    category: 'Search',
    label: `${county.join(',')} | ${acreageMin}-${acreageMax} acres`,
    value: resultsCount
  });
};

// Property view event
export const trackPropertyView = ({ parcelId, county, acreage, ownerState }: { parcelId: string, county: string, acreage: number | string, ownerState?: string }) => {
  event({
    action: 'property_view',
    category: 'Engagement',
    label: `${county} - ${parcelId}`,
    value: typeof acreage === 'string' ? parseFloat(acreage) : acreage
  });
};

// Property export event
export const trackPropertyExport = ({ format, count, userTier }: { format: string, count: number, userTier: string }) => {
  event({
    action: 'property_export',
    category: 'Conversion',
    label: `${format} | ${userTier}`,
    value: count
  });
};

// Filter applied event
export const trackFilterApplied = ({ filterType, filterValue }: { filterType: string, filterValue: string }) => {
  event({
    action: 'filter_applied',
    category: 'Search',
    label: `${filterType}: ${filterValue}`
  });
};

// Trial signup event
export const trackTrialStart = ({ tier, trialDays }: { tier: string, trialDays: number }) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trial_start', {
      currency: 'USD',
      tier: tier,
      trial_days: trialDays
    });
  }
};

// Purchase event
export const trackPurchase = ({ transactionId, tier, value }: { transactionId: string, tier: string, value: number }) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'purchase', {
      transaction_id: transactionId,
      value: value,
      currency: 'USD',
      tier: tier
    });
  }
};

// CRM action event
export const trackCRMAction = ({ action, parcelId }: { action: string, parcelId: string }) => {
  event({
    action: `crm_${action}`,
    category: 'CRM',
    label: parcelId
  });
};

// Appraiser link click
export const trackAppraiserLink = ({ county, parcelId }: { county: string, parcelId: string }) => {
  event({
    action: 'appraiser_link_click',
    category: 'External',
    label: `${county} - ${parcelId}`
  });
};

// Login Event
export const trackLogin = ({ userId, tier }: { userId: string, tier: string }) => {
  event({
    action: 'login',
    category: 'User',
    label: tier
  });
  // Also set config if supported, but distinct event is good for funnel
};

// View Paywall
export const trackViewPaywall = ({ trigger }: { trigger: string }) => {
  event({
    action: 'view_paywall',
    category: 'Engagement',
    label: trigger
  });
};

// Begin Checkout (Upgrade Click)
export const trackBeginCheckout = ({ tier }: { tier: string }) => {
  event({
    action: 'begin_checkout',
    category: 'Conversion',
    label: tier
  });
};
