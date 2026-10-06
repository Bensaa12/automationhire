// Paid downloads sold through Stripe Checkout (Garage packs and Pound Appstore apps).
// Shared by api/agent.js (checkout + download) and api/stripe/webhook.js (purchase emails).

// ─── Paid Garage packs ────────────────────────────────────────────────
// One-off downloadable products sold via Stripe Checkout Sessions.
// Add new packs here, priced one of two ways:
//   priceEnv  - env var holding a Stripe Price ID (Stripe → Products → product → Price ID), or
//   productId + unitAmount - a Stripe Product ID plus the amount in pence; checkout builds
//               the price inline, so no Price ID or env var is needed.
// Then upload the file to storagePath in the Supabase Storage bucket (storageBucket), or in
// Cloudflare R2 (r2Bucket - for files over Supabase's upload limit; see api/_r2.js).
const GARAGE_PAID_PACKS = {
  'plant-3d-cable-tray': {
    productId:     'prod_V8jSD23FMRl0aB',            // Stripe product "AutomationHire Cable Tray Catalog for AutoCAD Plant 3D"
    unitAmount:    499,                              // £4.99
    currency:      'gbp',
    returnPath:    '/garage/plant-3d-cable-tray',
    storageBucket: 'garage-paid',
    storagePath:   'plant-3d-cable-tray/AutomationHire_CableTrayPack_v1.0.0.zip',
  },
  // Pound Appstore — £1 desktop apps
  'hirecast': {
    productId:     'prod_VKhoYJZcIPvvR0',            // Stripe product "HireCast"
    unitAmount:    100,                              // £1.00
    currency:      'gbp',
    returnPath:    '/pound-appstore/hirecast',
    r2Bucket:      'hirecast-downloads',             // Cloudflare R2 (file is 120 MB; Supabase free caps at 50 MB)
    storagePath:   'hirecast/HireCast-Setup-1.2.5.exe',
    licensePrefix: 'HC1',                            // buyers get an offline licence key (api/_license.js)
    licenseKeyEnv: 'HIRECAST_LICENSE_PRIVATE_KEY',
  },
  // Same installer - the Pro licence key unlocks the webcam features.
  'hirecast-pro': {
    productId:     'prod_VLpGrrNCw4rd2a',            // Stripe product "HireCast Pro"
    unitAmount:    999,                              // £9.99
    upgradeAmount: 899,                              // £8.99 with a valid HireCast Standard key
    currency:      'gbp',
    returnPath:    '/pound-appstore/hirecast-pro',
    r2Bucket:      'hirecast-downloads',
    storagePath:   'hirecast/HireCast-Setup-1.2.5.exe',
    licensePrefix: 'HC1',
    licenseKeyEnv: 'HIRECAST_LICENSE_PRIVATE_KEY',
    edition:       'pro',
  },
  // HireSign — sign PDF, Word and image documents. One installer; the key decides Basic or Pro.
  'hiresign': {
    productId:     'prod_VLqgDIUtoNKjA8',            // Stripe product "HireSign"
    unitAmount:    100,                              // £1.00
    currency:      'gbp',
    returnPath:    '/pound-appstore/hiresign',
    r2Bucket:      'hirecast-downloads',
    storagePath:   'hiresign/HireSign-Setup-1.0.0.exe',
    licensePrefix: 'HS1',
    licenseKeyEnv: 'HIRESIGN_LICENSE_PRIVATE_KEY',
  },
  'hiresign-pro': {
    productId:     'prod_VLqgK47wZrZ4lW',            // Stripe product "HireSign Pro"
    unitAmount:    999,                              // £9.99
    upgradeAmount: 899,                              // £8.99 with a valid HireSign (£1) key
    upgradeFromName: 'HireSign',
    currency:      'gbp',
    returnPath:    '/pound-appstore/hiresign-pro',
    r2Bucket:      'hirecast-downloads',
    storagePath:   'hiresign/HireSign-Setup-1.0.0.exe',
    licensePrefix: 'HS1',
    licenseKeyEnv: 'HIRESIGN_LICENSE_PRIVATE_KEY',
    edition:       'pro',
  },
  // HireConvert — video, audio and photo converter. One installer; the key decides Basic or Pro.
  // No productId yet: Stripe Checkout creates the product inline from `productName`.
  'hireconvert': {
    productName:   'HireConvert',
    unitAmount:    100,                              // £1.00
    currency:      'gbp',
    returnPath:    '/pound-appstore/hireconvert',
    r2Bucket:      'hirecast-downloads',
    storagePath:   'hireconvert/HireConvert-Setup-1.0.0.exe',
    licensePrefix: 'HX1',
    licenseKeyEnv: 'HIRECONVERT_LICENSE_PRIVATE_KEY',
  },
  'hireconvert-pro': {
    productName:   'HireConvert Pro',
    unitAmount:    999,                              // £9.99
    upgradeAmount: 899,                              // £8.99 with a valid HireConvert (£1) key
    upgradeFromName: 'HireConvert',
    currency:      'gbp',
    returnPath:    '/pound-appstore/hireconvert-pro',
    r2Bucket:      'hirecast-downloads',
    storagePath:   'hireconvert/HireConvert-Setup-1.0.0.exe',
    licensePrefix: 'HX1',
    licenseKeyEnv: 'HIRECONVERT_LICENSE_PRIVATE_KEY',
    edition:       'pro',
  },
  // HirePDF — merge, split, rearrange and compress PDFs. One installer; the key decides Basic or Pro.
  'hirepdf': {
    productName:   'HirePDF',
    unitAmount:    100,                              // £1.00
    currency:      'gbp',
    returnPath:    '/pound-appstore/hirepdf',
    r2Bucket:      'hirecast-downloads',
    storagePath:   'hirepdf/HirePDF-Setup-1.0.0.exe',
    licensePrefix: 'HP1',
    licenseKeyEnv: 'HIREPDF_LICENSE_PRIVATE_KEY',
  },
  'hirepdf-pro': {
    productName:   'HirePDF Pro',
    unitAmount:    999,                              // £9.99
    upgradeAmount: 899,                              // £8.99 with a valid HirePDF (£1) key
    upgradeFromName: 'HirePDF',
    currency:      'gbp',
    returnPath:    '/pound-appstore/hirepdf-pro',
    r2Bucket:      'hirecast-downloads',
    storagePath:   'hirepdf/HirePDF-Setup-1.0.0.exe',
    licensePrefix: 'HP1',
    licenseKeyEnv: 'HIREPDF_LICENSE_PRIVATE_KEY',
    edition:       'pro',
  },
};

module.exports = GARAGE_PAID_PACKS;
