/**
 * api/_gee-auth.js
 * ─────────────────────────────────────────────────────────────
 * GEE Service Account Authentication Helper
 *
 * SECURITY:
 *   Credentials are read ONLY from environment variables.
 *   This file never receives secrets from the frontend.
 *   Never commit credential values — set them in Vercel dashboard only.
 *
 * Required Vercel environment variables:
 *   GEE_SERVICE_ACCOUNT_EMAIL   e.g. agrimonitor@change-krishi-bot.iam.gserviceaccount.com
 *   GEE_PRIVATE_KEY             Full PEM private key string from service account JSON
 *                                (include -----BEGIN/END RSA PRIVATE KEY----- lines)
 *
 * Usage:
 *   const { authenticateGEE } = require('./_gee-auth');
 *   await authenticateGEE();
 *   // GEE is now ready for computations
 */

const ee = require('@google/earthengine');

let _initialized = false;

/**
 * Authenticates and initializes the GEE Node.js client using the service account
 * credentials stored in Vercel environment variables.
 *
 * Idempotent: subsequent calls in the same execution context reuse the session.
 *
 * @throws {Error} if credentials are missing or GEE authentication fails
 */
async function authenticateGEE() {
  // Reuse within the same function cold start
  if (_initialized) return;

  const email = process.env.GEE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GEE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      'GEE credentials missing. Set GEE_SERVICE_ACCOUNT_EMAIL and GEE_PRIVATE_KEY in Vercel environment variables.'
    );
  }

  // Vercel sometimes escapes newlines in env vars — restore them
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const credentials = {
    type: 'service_account',
    client_email: email,
    private_key: privateKey,
  };

  // Authenticate via private key
  await new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(credentials, resolve, (err) =>
      reject(new Error('GEE authentication failed: ' + err))
    );
  });

  // Initialize EE client
  await new Promise((resolve, reject) => {
    ee.initialize(
      null,  // tile base (default)
      null,  // api base (default)
      resolve,
      (err) => reject(new Error('GEE initialization failed: ' + err))
    );
  });

  _initialized = true;
}

module.exports = { authenticateGEE };
