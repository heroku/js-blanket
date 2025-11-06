# Sentry PII Scrubbing Research - Findings

## Executive Summary

**Question**: Can we rely on Sentry's server-side PII scrubbing instead of
client-side scrubbing with Node Blanket?

**Answer**: **No, we cannot rely solely on Sentry's server-side scrubbing** for
the following reasons:

1. **Data already leaves your infrastructure** - Server-side scrubbing happens
   AFTER data reaches Sentry's servers
2. **Limited default coverage** - Only predefined fields are scrubbed by default
   (password, secret, credit card, etc.)
3. **Requires manual configuration** - Custom fields require UI configuration
   for each project/organization
4. **Heroku-specific fields not covered** - Fields like `heroku_oauth_token`,
   `sudo_oauth_token`, `postgres_session_nonce` are NOT in Sentry's default list
5. **Technical limitations** - Cannot scrub certain data types (objects/arrays)
   or all fields consistently

## Detailed Findings

### 1. Sentry Offers Three Scrubbing Approaches

#### A. Client-Side Scrubbing (SDK - `beforeSend` hook)

- **Where**: In your application, before data is sent to Sentry
- **How**: Using `beforeSend` and `beforeSendTransaction` hooks
- **When**: Data is scrubbed before leaving your infrastructure
- **Configuration**: Requires code changes and redeployment
- **Coverage**: Complete control over what's scrubbed

```javascript
Sentry.init({
  dsn: 'your-dsn',
  beforeSend(event) {
    // Scrub data here BEFORE it's sent
    if (event.user) {
      delete event.user.email;
    }
    return event;
  },
});
```

#### B. Server-Side Data Scrubbing (Default)

- **Where**: On Sentry's servers, after data is received
- **How**: Automatically applied to predefined sensitive fields
- **When**: After data reaches Sentry, before storage
- **Configuration**: Enabled by default, no code changes needed
- **Coverage**: Limited to predefined list

**Default Scrubbed Fields** (from Sentry docs):

```
password, secret, passwd, api_key, apikey, access_token, auth,
credentials, mysql_pwd, stripetoken, card[number], etc.
```

**Important**: This list does NOT include:

- Email addresses
- IP addresses (unless "Prevent storing of IP addresses" is enabled)
- Most Heroku-specific fields (`heroku_oauth_token`, `sudo_oauth_token`, etc.)
- Custom application fields

#### C. Advanced Data Scrubbing (Custom Rules)

- **Where**: On Sentry's servers, after data is received
- **How**: Custom rules configured in Sentry UI
- **When**: After data reaches Sentry, before storage
- **Configuration**: UI-only, no code changes, immediate effect
- **Coverage**: Custom selectors and regex patterns

Example rules:

```
[Remove] [Email Addresses] from [$string]
[Mask] [IP Addresses] from [request.env.REMOTE_ADDR]
[Hash] [Anything] from [extra.user_id]
```

### 2. Key Limitations of Server-Side Scrubbing

#### Limitation 1: Data Already Sent to Sentry

**Critical**: Server-side scrubbing happens AFTER your data has already left
your infrastructure and reached Sentry's servers (located in the US).

From the documentation:

> "filtering or scrubbing sensitive data within the SDK, so that data is _not
> sent to_ Sentry" vs "configuring server-side scrubbing to ensure Sentry does
> _not store_ data"

**Implication**: For compliance (GDPR, HIPAA, etc.), you typically need to
prevent PII from leaving your infrastructure, not just prevent storage.

#### Limitation 2: Limited Default Coverage

Server-side scrubbing only covers a predefined list. From the hashnode article
by Advena:

> "Some PII like e-mail, CPR, and address,... are not part of the Server-Side
> data scrubbing logic."

**Heroku-Specific Gap**: Our `HEROKU_FIELDS` preset includes 29 fields. Sentry's
default list covers maybe 8-10 of them.

Missing from Sentry's default:

- `heroku_oauth_token`
- `sudo_oauth_token`
- `heroku_session_nonce`
- `heroku_user_session`
- `postgres_session_nonce`
- `super_user_session_secret`
- `user_session_secret`
- `logplexUrl`
- And many more...

#### Limitation 3: Technical Constraints

From Sentry's documentation on "Known Limitations":

1. **Cannot scrub objects/arrays**: "Hashing, masking or replacing a JSON
   object, array or number (anything that is not a string) cannot be done in all
   circumstances"

2. **IP address special handling**: "Sentry's internals require that the event
   user's IP address must either be null or a valid IPv4/IPv6 address"

3. **Stack trace limitations**: "In stack traces, scrubbing works on file paths
   but not on a file's base name"

4. **Wildcard limitations**: `**` selectors only apply to default PII fields,
   not custom fields

#### Limitation 4: Configuration Overhead

- Each project/organization must be configured separately
- Rules must be created through the UI (not infrastructure-as-code)
- No way to version control scrubbing rules
- Must maintain rules across multiple Sentry projects

### 3. Recommended Architecture

Based on this research, the **Node Blanket** approach is the correct
architecture:

#### ✅ Use Client-Side Scrubbing (Node Blanket) For:

1. **Primary defense**: Prevent PII from leaving your infrastructure
2. **Complete coverage**: All Heroku-specific fields + custom fields
3. **Compliance**: Meet GDPR/HIPAA requirements
4. **Consistency**: Same scrubbing logic across all projects
5. **Version control**: Scrubbing config in code, reviewable
6. **No vendor lock-in**: Works with Sentry, Rollbar, Bugsnag, custom loggers

#### ✅ Use Server-Side Scrubbing (Sentry UI) For:

1. **Defense in depth**: Backup layer if client-side fails
2. **Emergency response**: Can add rules immediately without redeployment
3. **Discovery**: Catch PII you didn't know about
4. **Compliance audits**: Show multiple layers of protection

### 4. Real-World Example: Why Both Are Needed

From the Advena article, a developer added this code:

```javascript
const userId = window.localStorage.getItem('userId');
console.log('Current user id: ' + userId); // Accidentally logs PII
throw new Error('Sentry Frontend Error');
```

**What happens**:

1. **Without client-side scrubbing**: User ID appears in breadcrumbs → sent to
   Sentry → server-side rules might not catch it (depends on configuration)
2. **With client-side scrubbing**: User ID is scrubbed from breadcrumbs before
   sending → Never leaves infrastructure
3. **With both**: Multiple layers of protection

### 5. Cost-Benefit Analysis

| Approach                            | Setup Cost              | Ongoing Cost       | Coverage | Compliance | Flexibility |
| ----------------------------------- | ----------------------- | ------------------ | -------- | ---------- | ----------- |
| **Client-side only (Node Blanket)** | Medium (implement once) | Low (automatic)    | Complete | ✅ Full    | High        |
| **Server-side only (Sentry)**       | Low (UI config)         | High (per project) | Limited  | ⚠️ Partial | Low         |
| **Both (Recommended)**              | Medium                  | Low                | Complete | ✅ Full    | High        |

### 6. Testing Plan

To verify Sentry's server-side scrubbing capabilities, we will:

1. **Send test events** with known PII fields:
   - Default Sentry fields (`password`, `api_key`)
   - Heroku-specific fields (`heroku_oauth_token`)
   - Custom fields (`custom_secret`)

2. **Check Sentry dashboard** to see what gets scrubbed automatically

3. **Configure custom rules** for Heroku fields

4. **Compare results** to Node Blanket's scrubbing

## Conclusion

**Node Blanket is essential** because:

1. ✅ **Compliance**: Prevents PII from leaving your infrastructure (required
   for GDPR, HIPAA)
2. ✅ **Coverage**: Scrubs all Heroku-specific fields (29 fields vs ~8 in
   Sentry's default)
3. ✅ **Consistency**: Same scrubbing logic across all services (Sentry,
   Rollbar, Winston, Pino)
4. ✅ **Control**: Version-controlled, code-reviewed, testable
5. ✅ **Performance**: No extra network round-trip, scrubbing happens locally
6. ✅ **Flexibility**: Works with any error reporting or logging service

**Sentry's server-side scrubbing is useful** as:

- A backup layer (defense in depth)
- Emergency response (add rules without redeployment)
- Discovery tool (find PII you didn't know about)

**Recommendation**: Implement Node Blanket for client-side scrubbing + configure
Sentry's server-side scrubbing as a secondary layer of protection.

## References

- [Sentry Data Scrubbing Documentation](https://docs.sentry.io/security-legal-pii/scrubbing/)
- [Sentry Server-Side Scrubbing](https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/)
- [Sentry Advanced Data Scrubbing](https://docs.sentry.io/security-legal-pii/scrubbing/advanced-datascrubbing/)
- [Sentry Python Data Management](https://docs.sentry.io/platforms/python/data-management/sensitive-data/)
- [Sentry JavaScript Data Management](https://docs.sentry.io/platforms/javascript/guides/koa/data-management/sensitive-data/)
- [Removing PII from Sentry (Advena Blog)](https://advena.hashnode.dev/removing-personal-information-pii-from-sentry-error-monitoring-in-javascript)

---

**Date**: November 6, 2025 **Research**: Based on Sentry documentation and
community best practices **Next Steps**: Create test script to send events to
Sentry and verify scrubbing behavior
