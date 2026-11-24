import { expect, test } from '@playwright/test';
import { createDomstamp } from 'domstamp';
import { playwrightAdapter } from '@domstamp/playwright';

// Characterizes the real redaction boundary for the Zuub internal-DOM-retrieval
// use case (BOT-5686/5687): can a caller who does NOT know a secret value ahead
// of time (the realistic case for a payer-portal MFA/OTP code, which is generated
// server-side) still get it redacted by default, or must it be pre-listed?
//
// This is a gym scenario pack filling a gap identified in review, not a bug report
// against Domstamp: it documents current behavior with a sensitivity control so a
// future change to the default policy is caught by this suite.
test.describe('@conformance credential/OTP redaction boundary', () => {
  test('input-value secrets (password, security answer) are redacted by default', async ({ page }) => {
    await page.goto('/scenario/mfa-portal?seed=501');
    const password = 'hunter2-501';
    const securityAnswer = 'mothers-maiden-501';

    const client = createDomstamp(playwrightAdapter(), {
      defaults: {
        // Deliberately do NOT list password/securityAnswer in `text` here.
        // This is the realistic caller posture: you know you must redact
        // "whatever is in sensitive-looking fields", not the literal secret.
        data: { mode: 'redact' }
      }
    });

    const snapshot = await client.capture(page);
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(securityAnswer);
  });

  test('redaction of an input VALUE does not propagate to a duplicate text rendering of the same secret', async ({ page }) => {
    await page.goto('/scenario/mfa-portal?seed=501');
    const generatedOtp = await page.evaluate(() => (window as unknown as { __GYM_GENERATED_OTP__: string }).__GYM_GENERATED_OTP__);

    const client = createDomstamp(playwrightAdapter(), {
      defaults: { data: { mode: 'redact' } }
    });

    const snapshot = await client.capture(page);
    const otpInputNode = snapshot.documents[0]!.nodes.find(
      (node) => node.attributes.some(([name, value]) => name === 'id' && value === 'otp-input')
    );
    const otpTextNode = snapshot.documents[0]!.nodes.find(
      (node) => node.kind === 'text' && node.value === generatedOtp
    );

    // The field holding the code is correctly redacted...
    expect(otpInputNode?.state.value).toBe('[REDACTED]');
    // ...but the identical code, also shown as plain page text (e.g. a portal's
    // "resend code" confirmation banner), is a SEPARATE node the redaction policy
    // never connects to the field it mirrors. Characterized, not a surprise.
    expect(otpTextNode?.value).toBe(generatedOtp);
  });

  test('a server-rendered code shown as page TEXT (not an input value) is NOT redacted by default', async ({ page }) => {
    await page.goto('/scenario/mfa-portal?seed=502');
    const generatedOtp = await page.evaluate(() => (window as unknown as { __GYM_GENERATED_OTP__: string }).__GYM_GENERATED_OTP__);

    const client = createDomstamp(playwrightAdapter(), {
      defaults: {
        data: { mode: 'redact' }
      }
    });

    const snapshot = await client.capture(page);
    const serialized = JSON.stringify(snapshot);

    // KNOWN GAP (characterized, not a surprise if this test ever flips to failing
    // in a good way): the displayed confirmation code lives in `#otp-code` text
    // content, not an input value or a listed sensitive attribute, so the default
    // redaction policy has no way to find it without the caller supplying the
    // exact string as a `text` needle, which is impossible before capture for a
    // value the portal only reveals at capture time.
    expect(serialized).toContain(generatedOtp);
  });

  test('once the displayed code is read off the page first, it CAN be redacted as a needle', async ({ page }) => {
    await page.goto('/scenario/mfa-portal?seed=503');
    const generatedOtp = await page.evaluate(() => (window as unknown as { __GYM_GENERATED_OTP__: string }).__GYM_GENERATED_OTP__);

    // This is the mitigation: read the sensitive on-screen value via the DOM
    // BEFORE calling capture(), then feed it back in as a needle. Proves the
    // workaround is viable so it can be written into the real capture helper
    // (read known secret-bearing selectors first, then build the redact policy).
    const client = createDomstamp(playwrightAdapter(), {
      defaults: {
        data: { mode: 'redact', text: [generatedOtp] }
      }
    });

    const snapshot = await client.capture(page);
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain(generatedOtp);
  });
});
