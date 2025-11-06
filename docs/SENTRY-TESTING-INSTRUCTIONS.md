# Sentry Server-Side Scrubbing Testing Instructions

This document provides instructions for testing Sentry's server-side PII
scrubbing capabilities to verify research findings.

## Prerequisites

1. **Sentry Account**: You need access to a Sentry project
2. **Sentry DSN**: The Data Source Name (DSN) for your project
3. **Environment Setup**: `.env` file with your Sentry DSN

## Setup

### 1. Create/Configure `.env` File

Create a `.env` file in the project root with your Sentry DSN:

```bash
# .env
SENTRY_DSN=https://your-public-key@o0.ingest.sentry.io/your-project-id
```

To find your Sentry DSN:

1. Log in to [sentry.io](https://sentry.io)
2. Go to **Settings** > **Projects** > Your Project
3. Go to **Client Keys (DSN)**
4. Copy the DSN value

### 2. Verify Installation

Dependencies should already be installed:

- `@sentry/node` - Sentry SDK
- `dotenv` - Environment variable loading
- `tsx` - TypeScript execution

If not installed:

```bash
pnpm install
```

## Running the Tests

### Send Test Events to Sentry

Run the test script to send 5 different test events:

```bash
pnpm test:sentry
```

The script will send the following test events:

### Test 1: Default Sentry Fields

**Purpose**: Verify what Sentry scrubs by default

**Fields sent**:

- `password`, `secret`, `api_key`, `access_token`, `auth`, `apikey`,
  `credentials`

**Expected result**: ALL should be scrubbed/filtered by Sentry

### Test 2: Heroku-Specific Fields

**Purpose**: Verify Heroku fields are NOT scrubbed by default

**Fields sent**:

- `heroku_oauth_token`, `sudo_oauth_token`, `heroku_session_nonce`
- `heroku_user_session`, `postgres_session_nonce`
- `super_user_session_secret`, `user_session_secret`
- `logplexUrl`, `authenticity_token`

**Expected result**: Likely visible (NOT scrubbed) - requires custom rules

### Test 3: PII in Different Locations

**Purpose**: Test scrubbing across different event sections

**Data sent**:

- User context (email, IP address)
- Breadcrumbs (email, session token)
- Contexts (email, phone, SSN, address)
- Extra data (Authorization headers, cookies, API keys, passwords, credit card)

**Expected result**:

- ✅ Scrubbed: `password`, `credit_card`, cookies (partially)
- ❌ NOT scrubbed: `email`, `phone`, `ssn`, `address`, `ip_address` (unless
  configured)

### Test 4: Pattern-Based PII

**Purpose**: Test if Sentry scrubs PII embedded in strings

**Data sent**:

- Error messages containing emails, SSNs, IP addresses
- Log entries with JWT tokens, emails, SSNs
- Activity logs with credit card numbers and emails

**Expected result**:

- ✅ Scrubbed: Credit card numbers (pattern match)
- ❌ NOT scrubbed: Emails, SSNs, IPs embedded in strings (requires Advanced Data
  Scrubbing rules)

### Test 5: Nested PII

**Purpose**: Test scrubbing in deeply nested objects

**Data sent**:

- Deeply nested structures (3-4 levels deep)
- Mix of default fields (`password`, `secret`, `api_key`) and Heroku fields

**Expected result**:

- ✅ Scrubbed: `password`, `secret` (even when nested)
- ❌ NOT scrubbed: `heroku_oauth_token` (even when nested)

## Verifying Results

### 1. Wait for Events to Appear

After running the script, wait 1-2 minutes for events to appear in Sentry.

### 2. Open Sentry Dashboard

1. Go to [sentry.io](https://sentry.io)
2. Navigate to your project
3. Go to **Issues**
4. You should see 5 new issues (Test Error 1-5)

### 3. Check Each Test Event

For each test event:

1. Click on the issue
2. Scroll to **Additional Data** section
3. Check which fields show `[Filtered]` vs actual values
4. Compare with expected results above

### 4. Document Findings

Update `docs/SENTRY-PII-SCRUBBING-RESEARCH.md` with:

- Screenshots of scrubbed vs non-scrubbed fields
- Any unexpected results
- Confirmation of which fields require custom rules

## Configuring Advanced Data Scrubbing (Optional)

To test custom scrubbing rules for Heroku fields:

### 1. Navigate to Data Scrubbing Settings

1. Go to [sentry.io](https://sentry.io)
2. Navigate to **Settings** > **Projects** > Your Project
3. Go to **Security & Privacy**
4. Scroll to **Advanced Data Scrubbing**

### 2. Add Custom Rules

Click **Add Rule** and create rules for Heroku fields:

#### Example Rule 1: Scrub Heroku OAuth Token

- **Method**: Mask (or Remove)
- **Data Type**: Anything
- **Source**: `extra.**heroku_oauth_token`

#### Example Rule 2: Scrub All Heroku Session Fields

- **Method**: Mask
- **Data Type**: Anything
- **Source**: `extra.**heroku_*`

#### Example Rule 3: Scrub Emails in Strings

- **Method**: Replace
- **Data Type**: Email Addresses
- **Source**: `$string`

### 3. Re-run Tests

After adding custom rules:

```bash
pnpm test:sentry
```

Wait 1-2 minutes and check if the custom rules are working.

## Cleanup

### Delete Test Events

After testing:

1. Go to Sentry Issues
2. Click on each test issue
3. Click **Delete** or **Resolve**

### Remove Test Script (Optional)

The test script won't interfere with normal operations, but you can remove it:

```bash
rm src/sentry-scrubbing-test.ts
```

And remove the script from `package.json`:

```json
// Remove this line:
"test:sentry": "tsx src/sentry-scrubbing-test.ts",
```

## Key Takeaways

After running these tests, you should have verified:

✅ **Sentry DOES scrub by default**:

- `password`, `secret`, `api_key`, `access_token`
- Credit card numbers (pattern match)
- Cookie values (in headers)

❌ **Sentry DOES NOT scrub by default**:

- Heroku-specific fields (`heroku_oauth_token`, etc.)
- Emails (requires custom rule)
- IP addresses (requires "Prevent storing of IP addresses" setting)
- SSNs (requires custom rule)
- Phone numbers
- Addresses

⚠️ **Key Limitation**: Server-side scrubbing happens AFTER data reaches Sentry's
servers. For compliance (GDPR, HIPAA), you typically need to prevent PII from
leaving your infrastructure, which requires **client-side scrubbing** (the Node
Blanket approach).

## Conclusion

This testing confirms that:

1. **Server-side scrubbing is limited** - Only ~8-10 default fields
2. **Heroku fields are NOT covered** - Need 20+ custom rules or client-side
   scrubbing
3. **Pattern-based PII mostly NOT scrubbed** - Emails, SSNs in strings remain
   visible
4. **Custom rules help** - But require manual UI configuration per project
5. **Client-side scrubbing is essential** - For compliance and comprehensive
   coverage

**Recommendation**: Use Node Blanket for client-side scrubbing + Sentry's
server-side as a backup layer.

## Questions?

If you encounter issues:

1. Check that `SENTRY_DSN` is correctly set in `.env`
2. Verify your Sentry project is accessible
3. Check Sentry's quota limits (you might have hit the monthly limit)
4. Review Sentry's
   [Data Scrubbing Documentation](https://docs.sentry.io/security-legal-pii/scrubbing/)

---

**Date**: November 6, 2025 **Purpose**: Verify Sentry's server-side PII
scrubbing capabilities **Related**: `docs/SENTRY-PII-SCRUBBING-RESEARCH.md`
