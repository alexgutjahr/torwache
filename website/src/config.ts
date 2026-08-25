const contactEmails = {
  general: 'hello@torwache.com',
  privacy: 'privacy@torwache.com',
  security: 'security@torwache.com',
} as const;

export const site = {
  name: 'torwache',
  url: 'https://torwache.com',
  tagline: 'Dead-simple website blocking for Chrome',
  description:
    'Dead-simple website blocking for Chrome. Put a domain on the list and it stops opening. No accounts, no tracking, no nonsense.',
  repositoryUrl: 'https://github.com/alexgutjahr/torwache',
  releasesUrl: 'https://github.com/alexgutjahr/torwache/releases',
  issuesUrl: 'https://github.com/alexgutjahr/torwache/issues',

  // Add the published listing URL here. Until then, StoreLink renders an honest
  // coming-soon state instead of sending visitors to an unrelated extension.
  chromeWebStoreUrl: null as string | null,

  contacts: contactEmails,

  legal: {
    operatorName: 'iconic.one GmbH',
    representedBy: 'Alexander Gutjahr',
    streetAddress: 'Scanbox #09285, Ehrenbergstr. 16a',
    locality: '10245 Berlin',
    postalCode: '10245',
    addressLocality: 'Berlin',
    country: 'Germany',
    countryCode: 'DE',
    email: contactEmails.general,
    vatId: 'DE283990873',

    registerCourt: 'Amtsgericht Potsdam',
    registerNumber: 'HRB 35727',
  },
} as const;

const requiredLegalFields = [
  'operatorName',
  'representedBy',
  'streetAddress',
  'locality',
  'country',
  'email',
  'vatId',
  'registerCourt',
  'registerNumber',
] as const;

export const isImprintComplete = requiredLegalFields.every((field) => {
  const value = site.legal[field];
  return typeof value === 'string' && value.trim().length > 0;
});
